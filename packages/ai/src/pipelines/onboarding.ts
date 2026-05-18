import type { WorkersEnv } from '@coreberg/workers-shared';
import { configFromEnv, generateContent } from '../gemini';
import {
  siteAnalysisPrompt,
  competitorPrompt,
  citationLandscapePrompt,
} from '../prompts';
import { calcCostCents, type ModelId } from '../pricing';
import { recordAiUsage, createDb } from '@coreberg/workers-shared';

export async function runAuditStep0(
  env: WorkersEnv,
  input: { siteUrl: string; projectId: string; userId: string },
) {
  // robots.txt, llms.txt, Schema, PageSpeed の取得。
  // ここでは構造化スタブを返し、詳細は次レイヤーで実装。
  const robotsTxt = await fetchTextSafe(`${normalizeOrigin(input.siteUrl)}/robots.txt`);
  const llmsTxt = await fetchTextSafe(`${normalizeOrigin(input.siteUrl)}/llms.txt`);

  const aiBots = ['GPTBot', 'ClaudeBot', 'PerplexityBot', 'Google-Extended', 'OAI-SearchBot', 'CCBot'];
  const robotsResult = aiBots.map((bot) => ({
    bot,
    allowed: robotsTxt ? isBotAllowed(robotsTxt, bot) : true,
  }));

  return {
    audited_at: new Date().toISOString(),
    robots: { exists: robotsTxt !== null, bots: robotsResult },
    llms_txt: { exists: llmsTxt !== null },
    schema: { status: 'pending', notes: '次レイヤーで実装' },
    core_web_vitals: { status: 'pending' },
  };
}

export async function runSiteAnalysis(
  env: WorkersEnv,
  input: { siteUrl: string; userId: string; projectId: string; targetAudience?: string; targetLocale?: 'ja' | 'en' },
) {
  const cfg = configFromEnv(env);
  const t0 = Date.now();
  const res = await generateContent(cfg, {
    model: siteAnalysisPrompt.model,
    systemInstruction: siteAnalysisPrompt.systemPrompt,
    thinkingLevel: siteAnalysisPrompt.thinkingLevel,
    responseMimeType: 'application/json',
    responseSchema: siteAnalysisPrompt.schema,
    tools: [{ urlContext: {} }, { googleSearch: {} }],
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: siteAnalysisPrompt.buildUserPrompt({
              siteUrl: input.siteUrl,
              targetAudience: input.targetAudience,
              targetLocale: input.targetLocale ?? 'ja',
            }),
          },
        ],
      },
    ],
  });
  const cost = calcCostCents(siteAnalysisPrompt.model as ModelId, {
    inputTokens: res.usage.inputTokens,
    outputTokens: res.usage.outputTokens,
  });
  await recordAiUsage(createDb(env), {
    user_id: input.userId,
    project_id: input.projectId,
    step: 'site_analysis',
    model: siteAnalysisPrompt.model,
    input_tokens: res.usage.inputTokens,
    output_tokens: res.usage.outputTokens,
    thinking_tokens: res.usage.thinkingTokens,
    cost_cents: cost,
    latency_ms: Date.now() - t0,
  });
  return res.json ?? { structured_profile: '', industry: '', value_proposition: '', tone: '' };
}

export async function runCompetitorAnalysis(
  env: WorkersEnv,
  input: { siteUrl: string; userId: string; projectId: string; targetLocale: 'ja' | 'en' },
) {
  const cfg = configFromEnv(env);
  const t0 = Date.now();
  const res = await generateContent(cfg, {
    model: competitorPrompt.model,
    systemInstruction: competitorPrompt.systemPrompt,
    thinkingLevel: competitorPrompt.thinkingLevel,
    responseMimeType: 'application/json',
    responseSchema: competitorPrompt.schema,
    tools: [{ googleSearch: {} }],
    contents: [
      {
        role: 'user',
        parts: [{ text: competitorPrompt.buildUserPrompt(input) }],
      },
    ],
  });
  await recordAiUsage(createDb(env), {
    user_id: input.userId,
    project_id: input.projectId,
    step: 'competitor',
    model: competitorPrompt.model,
    input_tokens: res.usage.inputTokens,
    output_tokens: res.usage.outputTokens,
    thinking_tokens: res.usage.thinkingTokens,
    cost_cents: calcCostCents(competitorPrompt.model as ModelId, res.usage),
    latency_ms: Date.now() - t0,
  });
  return res.json ?? { competitors: [], coverage_map: { covered: [], uncovered: [] } };
}

export async function runCitationLandscape(
  env: WorkersEnv,
  input: {
    siteUrl: string;
    userId: string;
    projectId: string;
    targetLocale: 'ja' | 'en';
    targetAudience?: string;
  },
) {
  const cfg = configFromEnv(env);
  const t0 = Date.now();
  const res = await generateContent(cfg, {
    model: citationLandscapePrompt.model,
    systemInstruction: citationLandscapePrompt.systemPrompt,
    thinkingLevel: citationLandscapePrompt.thinkingLevel,
    responseMimeType: 'application/json',
    responseSchema: citationLandscapePrompt.schema,
    tools: [{ googleSearch: {} }],
    contents: [
      {
        role: 'user',
        parts: [{ text: citationLandscapePrompt.buildUserPrompt(input) }],
      },
    ],
  });
  await recordAiUsage(createDb(env), {
    user_id: input.userId,
    project_id: input.projectId,
    step: 'citation_landscape',
    model: citationLandscapePrompt.model,
    input_tokens: res.usage.inputTokens,
    output_tokens: res.usage.outputTokens,
    thinking_tokens: res.usage.thinkingTokens,
    cost_cents: calcCostCents(citationLandscapePrompt.model as ModelId, res.usage),
    latency_ms: Date.now() - t0,
  });
  return (
    res.json ?? {
      user_questions: [],
      cited_domains: [],
      baseline_summary: '',
    }
  );
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------
async function fetchTextSafe(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'Coreberg-LLMO/1.0' } });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

function normalizeOrigin(url: string): string {
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.host}`;
  } catch {
    return url.replace(/\/+$/, '');
  }
}

function isBotAllowed(robots: string, bot: string): boolean {
  // 非常に単純なパーサ。完全準拠は次レイヤーで強化
  const lines = robots.split(/\r?\n/);
  let currentAgent: string | null = null;
  let allowedForBot: boolean | null = null;
  for (const raw of lines) {
    const line = raw.split('#')[0]?.trim() ?? '';
    if (!line) continue;
    const [k, ...rest] = line.split(':');
    const key = k?.trim().toLowerCase() ?? '';
    const val = rest.join(':').trim();
    if (key === 'user-agent') {
      currentAgent = val;
    } else if (
      key === 'disallow' &&
      (currentAgent?.toLowerCase() === bot.toLowerCase() || currentAgent === '*')
    ) {
      if (val === '/') allowedForBot = false;
    } else if (
      key === 'allow' &&
      (currentAgent?.toLowerCase() === bot.toLowerCase() || currentAgent === '*')
    ) {
      if (val === '/' || val === '') allowedForBot = true;
    }
  }
  return allowedForBot !== false;
}
