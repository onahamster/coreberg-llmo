import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from 'cloudflare:workers';
import type { WorkersEnv } from '../env';
import { createDb } from '../db';
import { runLearningLoop } from '@coreberg/ai/pipelines/learning';

export interface LearningParams {
  projectId: string;
  /** 対象月 (YYYY-MM-01) */
  month: string;
}

/**
 * 月次学習ループ Workflow (Step 9)
 */
export class LearningWorkflow extends WorkflowEntrypoint<WorkersEnv, LearningParams> {
  async run(event: WorkflowEvent<LearningParams>, step: WorkflowStep) {
    const { projectId, month } = event.payload;
    const db = createDb(this.env);

    const data = await step.do('load-month-articles', async () => {
      const startDate = `${month.slice(0, 7)}-01T00:00:00Z`;
      const next = nextMonthIso(month);
      const { data: articles } = await db
        .from('articles')
        .select('id,title,html,plan_id,published_at,project_id')
        .eq('project_id', projectId)
        .gte('published_at', startDate)
        .lt('published_at', next);
      const articleIds = (articles ?? []).map((a) => a.id);
      const { data: monitoring } = await db
        .from('citation_monitoring')
        .select('article_id,engine,cited,position')
        .in('article_id', articleIds);
      return { articles: articles ?? [], monitoring: monitoring ?? [] };
    });

    const insight = await step.do(
      'analyze-patterns',
      { retries: { limit: 2, delay: '1 minute', backoff: 'exponential' }, timeout: '15 minutes' },
      () => runLearningLoop(this.env, { projectId, month, data }) as any,
    ) as any;

    await step.do('save-insight', async () => {
      const { error } = await db.from('learning_insights').upsert(
        {
          project_id: projectId,
          month: `${month.slice(0, 7)}-01`,
          patterns_jsonb: insight.patterns,
          prompt_diff_jsonb: insight.promptDiff,
          applied: false,
        },
        { onConflict: 'project_id,month' },
      );
      if (error) throw new Error(error.message);
    });

    return { ok: true };
  }
}

function nextMonthIso(month: string): string {
  const d = new Date(`${month.slice(0, 7)}-01T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + 1);
  return d.toISOString();
}
