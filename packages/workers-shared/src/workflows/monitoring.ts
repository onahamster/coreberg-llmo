import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from 'cloudflare:workers';
import type { WorkersEnv, MonitoringQueueMessage } from '../env';
import { createDb } from '../db';

export interface MonitoringParams {
  /** null なら全プロジェクト */
  projectId?: string;
  /** 引用チェック対象のエンジン */
  engines: ('chatgpt' | 'perplexity' | 'gemini' | 'google_ai_overview')[];
}

/**
 * 日次 Citation Monitoring Workflow
 * Step 8 を担当
 */
export class MonitoringWorkflow extends WorkflowEntrypoint<WorkersEnv, MonitoringParams> {
  async run(event: WorkflowEvent<MonitoringParams>, step: WorkflowStep) {
    const { projectId, engines } = event.payload;
    const db = createDb(this.env);

    const targets = await step.do('load-targets', async () => {
      let q = db
        .from('articles')
        .select('id,project_id,plan_id,article_plans!inner(subquery_id)')
        .eq('status', 'published')
        .is('deleted_at', null);
      if (projectId) q = q.eq('project_id', projectId);
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      return (data ?? []).map((a) => ({
        articleId: a.id,
        projectId: a.project_id,
        subqueryId: (a as unknown as { article_plans: { subquery_id: string } }).article_plans
          .subquery_id,
      }));
    });

    await step.do('enqueue-checks', async () => {
      const messages: MonitoringQueueMessage[] = [];
      for (const t of targets) {
        for (const engine of engines) {
          messages.push({
            kind: 'monitoring.check',
            articleId: t.articleId,
            subqueryId: t.subqueryId,
            projectId: t.projectId,
            engine,
            scheduledFor: new Date().toISOString(),
          });
        }
      }
      for (let i = 0; i < messages.length; i += 100) {
        await this.env.MONITORING_QUEUE.sendBatch(
          messages.slice(i, i + 100).map((body) => ({ body })),
        );
      }
    });

    return { ok: true, enqueued: targets.length * engines.length };
  }
}
