import type { WorkersEnv } from '@coreberg/workers-shared';
import { configFromEnv, generateContent } from '../gemini';
import {
  subqueryFanoutPrompt,
  citationScorePrompt,
  clusteringPrompt,
  articlePlanPrompt,
} from '../prompts';
import { calcCostCents, type ModelId } from '../pricing';
import { createDb, recordAiUsage } from '@coreberg/workers-shared';

// ---------------------------------------------------------------------------
// Step 3
// ---------------------------------------------------------------------------
export async function generateSubqueries(
  env: WorkersEnv,
  input: { contextFile: unknown; generationRunId: string; projectId: string; userId: string },
): Promise<{ pattern: string; text: string }[]> {
  const cfg = configFromEnv(env);
  const t0 = Date.now();
  const res = await generateContent<{
    items: { pattern: string; text: string }[];
  }>(cfg, {
    model: subqueryFanoutPrompt.model,
    systemInstruction: subqueryFanoutPrompt.systemPrompt,
    thinkingLevel: subqueryFanoutPrompt.thinkingLevel,
    responseMimeType: 'application/json',
    responseSchema: subqueryFanoutPrompt.schema,
    contents: [
      {
        role: 'user',
        parts: [{ text: subqueryFanoutPrompt.buildUserPrompt({ contextFile: input.contextFile }) }],
      },
    ],
    maxOutputTokens: 16000,
  });

  await recordAiUsage(createDb(env), {
    user_id: input.userId,
    project_id: input.projectId,
    generation_run_id: input.generationRunId,
    step: 'subquery_fanout',
    model: subqueryFanoutPrompt.model,
    input_tokens: res.usage.inputTokens,
    output_tokens: res.usage.outputTokens,
    thinking_tokens: res.usage.thinkingTokens,
    cost_cents: calcCostCents(subqueryFanoutPrompt.model as ModelId, res.usage),
    latency_ms: Date.now() - t0,
  });

  return res.json?.items ?? [];
}

// ---------------------------------------------------------------------------
// Step 4B Scoring
// ---------------------------------------------------------------------------
export async function scoreSubqueries(
  env: WorkersEnv,
  input: {
    contextFile: unknown;
    subqueries: { id: string; text: string; pattern: string }[];
    userId: string;
    projectId: string;
  },
): Promise<
  {
    id: string;
    citation_likelihood: number;
    competitor_weakness: number;
    topic_contribution: number;
    citation_score: number;
  }[]
> {
  const cfg = configFromEnv(env);

  // 入力が大きいのでバッチ分割
  const batches = chunk(input.subqueries, 35);
  const out: Awaited<ReturnType<typeof scoreSubqueries>> = [];

  for (const batch of batches) {
    const t0 = Date.now();
    const res = await generateContent<{
      scores: {
        id: string;
        citation_likelihood: number;
        competitor_weakness: number;
        topic_contribution: number;
      }[];
    }>(cfg, {
      model: citationScorePrompt.model,
      systemInstruction: citationScorePrompt.systemPrompt,
      thinkingLevel: citationScorePrompt.thinkingLevel,
      responseMimeType: 'application/json',
      responseSchema: citationScorePrompt.schema,
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: citationScorePrompt.buildUserPrompt({
                contextFile: input.contextFile,
                subqueries: batch,
              }),
            },
          ],
        },
      ],
    });

    await recordAiUsage(createDb(env), {
      user_id: input.userId,
      project_id: input.projectId,
      step: 'scoring',
      model: citationScorePrompt.model,
      input_tokens: res.usage.inputTokens,
      output_tokens: res.usage.outputTokens,
      thinking_tokens: res.usage.thinkingTokens,
      cost_cents: calcCostCents(citationScorePrompt.model as ModelId, res.usage),
      latency_ms: Date.now() - t0,
    });

    for (const s of res.json?.scores ?? []) {
      const score = 0.5 * s.citation_likelihood + 0.3 * s.competitor_weakness + 0.2 * s.topic_contribution;
      out.push({
        id: s.id,
        citation_likelihood: clamp(s.citation_likelihood),
        competitor_weakness: clamp(s.competitor_weakness),
        topic_contribution: clamp(s.topic_contribution),
        citation_score: Math.round(score * 100) / 100,
      });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Step 4C/4D Clustering & 30 件選定
// ---------------------------------------------------------------------------
export async function clusterAndSelect(
  env: WorkersEnv,
  input: {
    contextFile: unknown;
    scored: {
      id: string;
      citation_likelihood: number;
      competitor_weakness: number;
      topic_contribution: number;
      citation_score: number;
    }[];
    targetCount: number;
    userId: string;
    projectId: string;
  },
): Promise<{
  clusters: { name: string; subquery_ids: string[]; pillar_subquery_id: string }[];
  items: {
    subqueryId: string;
    clusterIndex: number;
    citationLikelihood: number;
    competitorWeakness: number;
    topicContribution: number;
    citationScore: number;
  }[];
}> {
  const cfg = configFromEnv(env);

  // subqueries の text を取りに行く
  const db = createDb(env);
  const { data: rows } = await db
    .from('subqueries')
    .select('id,text,pattern')
    .in(
      'id',
      input.scored.map((s) => s.id),
    );

  const enriched = (rows ?? []).map((r) => {
    const s = input.scored.find((x) => x.id === r.id)!;
    return {
      id: r.id,
      text: r.text,
      pattern: r.pattern,
      citation_score: s.citation_score,
    };
  });

  const t0 = Date.now();
  const res = await generateContent<{
    clusters: { name: string; subquery_ids: string[]; pillar_subquery_id: string }[];
    selected_ids: string[];
  }>(cfg, {
    model: clusteringPrompt.model,
    systemInstruction: clusteringPrompt.systemPrompt,
    thinkingLevel: clusteringPrompt.thinkingLevel,
    responseMimeType: 'application/json',
    responseSchema: clusteringPrompt.schema,
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: clusteringPrompt.buildUserPrompt({
              scored: enriched,
              targetCount: input.targetCount,
            }),
          },
        ],
      },
    ],
  });

  await recordAiUsage(db, {
    user_id: input.userId,
    project_id: input.projectId,
    step: 'clustering',
    model: clusteringPrompt.model,
    input_tokens: res.usage.inputTokens,
    output_tokens: res.usage.outputTokens,
    cost_cents: calcCostCents(clusteringPrompt.model as ModelId, res.usage),
    latency_ms: Date.now() - t0,
  });

  const clusters = res.json?.clusters ?? [];
  const selectedSet = new Set(res.json?.selected_ids ?? []);

  // selected_ids が targetCount に満たない場合はスコア順で補完
  if (selectedSet.size < input.targetCount) {
    const remaining = [...input.scored]
      .sort((a, b) => b.citation_score - a.citation_score)
      .filter((s) => !selectedSet.has(s.id));
    for (const r of remaining) {
      if (selectedSet.size >= input.targetCount) break;
      selectedSet.add(r.id);
    }
  }

  const items: ReturnType<typeof clusterAndSelect> extends Promise<infer R>
    ? R['items']
    : never = [];
  for (const id of selectedSet) {
    const score = input.scored.find((s) => s.id === id);
    if (!score) continue;
    const clusterIndex = clusters.findIndex((c) => c.subquery_ids.includes(id));
    items.push({
      subqueryId: id,
      clusterIndex: clusterIndex >= 0 ? clusterIndex : 0,
      citationLikelihood: score.citation_likelihood,
      competitorWeakness: score.competitor_weakness,
      topicContribution: score.topic_contribution,
      citationScore: score.citation_score,
    });
  }

  return { clusters, items };
}

// ---------------------------------------------------------------------------
// Step 5 記事プラン生成
// ---------------------------------------------------------------------------
export async function generateArticlePlans(
  env: WorkersEnv,
  input: {
    contextFile: unknown;
    selected: { id: string; text: string; pattern: string }[];
    userId: string;
    projectId: string;
    generationRunId: string;
  },
): Promise<{ subqueryId: string; plan: ArticlePlan }[]> {
  const cfg = configFromEnv(env);
  const db = createDb(env);
  const results: { subqueryId: string; plan: ArticlePlan }[] = [];

  // 並列度は 5 程度に抑える（Workflow ステップ内で fan-out）
  const concurrency = 5;
  for (let i = 0; i < input.selected.length; i += concurrency) {
    const batch = input.selected.slice(i, i + concurrency);
    const out = await Promise.all(
      batch.map(async (sq) => {
        const t0 = Date.now();
        const res = await generateContent<ArticlePlan>(cfg, {
          model: articlePlanPrompt.model,
          systemInstruction: articlePlanPrompt.systemPrompt,
          thinkingLevel: articlePlanPrompt.thinkingLevel,
          responseMimeType: 'application/json',
          responseSchema: articlePlanPrompt.schema,
          contents: [
            {
              role: 'user',
              parts: [
                {
                  text: articlePlanPrompt.buildUserPrompt({
                    contextFile: input.contextFile,
                    subquery: sq,
                    relatedSubqueries: input.selected
                      .filter((s) => s.id !== sq.id)
                      .slice(0, 8)
                      .map((s) => ({ id: s.id, text: s.text })),
                  }),
                },
              ],
            },
          ],
          maxOutputTokens: 8000,
        });

        await recordAiUsage(db, {
          user_id: input.userId,
          project_id: input.projectId,
          generation_run_id: input.generationRunId,
          step: 'article_plan',
          model: articlePlanPrompt.model,
          input_tokens: res.usage.inputTokens,
          output_tokens: res.usage.outputTokens,
          thinking_tokens: res.usage.thinkingTokens,
          cost_cents: calcCostCents(articlePlanPrompt.model as ModelId, res.usage),
          latency_ms: Date.now() - t0,
        });

        return {
          subqueryId: sq.id,
          plan: res.json ?? createFallbackPlan(sq.text),
        };
      }),
    );
    results.push(...out);
  }

  return results;
}

export interface ArticlePlan {
  title: string;
  lead: string;
  sections: { h2: string; h3s?: string[]; target_chars?: number; self_contained_note?: string }[];
  statistics: { claim: string; source_url?: string }[];
  expert_citations: { name: string; title?: string; quote: string; source_url?: string }[];
  comparison_table?: boolean;
  internal_links?: string[];
  target_subquery_ids?: string[];
}

function createFallbackPlan(text: string): ArticlePlan {
  return {
    title: text,
    lead: `${text}について、結論から要点を整理する。`,
    sections: [
      { h2: `${text}とは`, target_chars: 150 },
      { h2: '主要な観点と注意点', target_chars: 160 },
      { h2: 'よくある誤解', target_chars: 140 },
      { h2: '実践ステップ', target_chars: 170 },
      { h2: 'まとめ', target_chars: 120 },
    ],
    statistics: [],
    expert_citations: [],
  };
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n * 100) / 100));
}
