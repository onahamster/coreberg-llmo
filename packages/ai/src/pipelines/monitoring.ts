import type { WorkersEnv, MonitoringQueueMessage } from '@coreberg/workers-shared';
import { createDb, recordAiUsage } from '@coreberg/workers-shared';
import { configFromEnv, generateContent } from '../gemini';
import { monitoringPrompt } from '../prompts';
import { calcCostCents, type ModelId } from '../pricing';

export interface CitationCheckResult {
  cited: boolean;
  position: number | null;
  snippet: string;
  competitorDomains: string[];
  raw: unknown;
}

/**
 * 各エンジンに問い合わせ → 引用判定
 * 実 API 呼び出しは次レイヤーで実装。今レイヤーではモックで返し、判定だけ走らせる。
 */
export async function runCitationCheck(
  env: WorkersEnv,
  msg: MonitoringQueueMessage,
): Promise<CitationCheckResult> {
  const db = createDb(env);
  const cfg = configFromEnv(env);

  const { data: project } = await db
    .from('projects')
    .select('site_url')
    .eq('id', msg.projectId)
    .single();

  const { data: sq } = await db
    .from('subqueries')
    .select('text')
    .eq('id', msg.subqueryId)
    .single();

  const targetDomain = project?.site_url ? new URL(project.site_url).hostname : '';
  const query = sq?.text ?? '';

  // 実エンジン呼び出しは次レイヤー。ここではフォールバックで空応答
  const engineResult = await callEngine(env, msg.engine, query);

  const t0 = Date.now();
  const res = await generateContent<{
    cited: boolean;
    position?: number;
    snippet?: string;
    competitor_domains?: string[];
  }>(cfg, {
    model: monitoringPrompt.model,
    systemInstruction: monitoringPrompt.systemPrompt,
    thinkingLevel: monitoringPrompt.thinkingLevel,
    responseMimeType: 'application/json',
    responseSchema: monitoringPrompt.schema,
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: monitoringPrompt.buildUserPrompt({
              targetDomain,
              engine: msg.engine,
              answer: engineResult.answer,
              citations: engineResult.citations,
            }),
          },
        ],
      },
    ],
  });

  await recordAiUsage(db, {
    user_id: null,
    project_id: msg.projectId,
    article_id: msg.articleId,
    step: 'monitoring',
    model: monitoringPrompt.model,
    input_tokens: res.usage.inputTokens,
    output_tokens: res.usage.outputTokens,
    cost_cents: calcCostCents(monitoringPrompt.model as ModelId, res.usage),
    latency_ms: Date.now() - t0,
  });

  return {
    cited: res.json?.cited ?? false,
    position: res.json?.position ?? null,
    snippet: res.json?.snippet ?? '',
    competitorDomains: res.json?.competitor_domains ?? [],
    raw: { engineResult, judge: res.json },
  };
}

async function callEngine(
  env: WorkersEnv,
  engine: MonitoringQueueMessage['engine'],
  query: string,
): Promise<{ answer: string; citations: string[] }> {
  // 次レイヤーで OpenAI / Perplexity / SerpAPI / Gemini を実装する
  // 今は空応答を返し、Step 8 のパイプラインだけ通せる状態を維持
  return { answer: '', citations: [] };
}
