import type { WorkersEnv } from '@coreberg/workers-shared';
import { createDb, recordAiUsage } from '@coreberg/workers-shared';
import { configFromEnv, generateContent } from '../gemini';
import { learningPrompt } from '../prompts';
import { calcCostCents, type ModelId } from '../pricing';

export async function runLearningLoop(
  env: WorkersEnv,
  input: {
    projectId: string;
    month: string;
    data: {
      articles: { id: string; title: string; html?: string | null; published_at?: string | null }[];
      monitoring: { article_id: string; engine: string; cited: boolean; position?: number | null }[];
    };
  },
): Promise<{ patterns: unknown; promptDiff: unknown }> {
  const db = createDb(env);
  const cfg = configFromEnv(env);

  const countByArticle = new Map<string, number>();
  for (const m of input.data.monitoring) {
    if (m.cited) {
      countByArticle.set(m.article_id, (countByArticle.get(m.article_id) ?? 0) + 1);
    }
  }

  const articles = input.data.articles.map((a) => ({
    id: a.id,
    title: a.title,
    html_excerpt: (a.html ?? '').slice(0, 1500),
    cited_count: countByArticle.get(a.id) ?? 0,
  }));

  const t0 = Date.now();
  const res = await generateContent<{ patterns: unknown; prompt_diff: unknown }>(cfg, {
    model: learningPrompt.model,
    systemInstruction: learningPrompt.systemPrompt,
    thinkingLevel: learningPrompt.thinkingLevel,
    responseMimeType: 'application/json',
    responseSchema: learningPrompt.schema,
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: learningPrompt.buildUserPrompt({ month: input.month, articles }),
          },
        ],
      },
    ],
    maxOutputTokens: 8000,
  });

  await recordAiUsage(db, {
    project_id: input.projectId,
    step: 'learning',
    model: learningPrompt.model,
    input_tokens: res.usage.inputTokens,
    output_tokens: res.usage.outputTokens,
    thinking_tokens: res.usage.thinkingTokens,
    cost_cents: calcCostCents(learningPrompt.model as ModelId, res.usage),
    latency_ms: Date.now() - t0,
  });

  return {
    patterns: res.json?.patterns ?? {},
    promptDiff: res.json?.prompt_diff ?? {},
  };
}
