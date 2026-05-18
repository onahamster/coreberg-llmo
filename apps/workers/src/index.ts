import type {
  ExportedHandler,
  ScheduledEvent,
  MessageBatch,
} from '@cloudflare/workers-types';
import type {
  WorkersEnv,
  ArticleQueueMessage,
  MonitoringQueueMessage,
} from '@coreberg/workers-shared';
import {
  OnboardingWorkflow,
  GenerationWorkflow,
  MonitoringWorkflow,
  LearningWorkflow,
  MetricsRefreshWorkflow,
  ProgressAggregator,
  articleQueueHandler,
  monitoringQueueHandler,
  bootstrap,
  withSentry,
} from '@coreberg/workers-shared';
import { createDb } from '@coreberg/workers-shared';

export { OnboardingWorkflow, GenerationWorkflow, MonitoringWorkflow, LearningWorkflow, MetricsRefreshWorkflow };
export { ProgressAggregator };

const handler: ExportedHandler<WorkersEnv, ArticleQueueMessage | MonitoringQueueMessage> = {
  /**
   * HTTP: Worker への直接アクセスは管理者向け診断用に最小限のヘルスチェックだけ
   */
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/health') {
      return Response.json({ ok: true, ts: new Date().toISOString() });
    }
    return new Response('not found', { status: 404 });
  },

  /**
   * Queue consumer: queue 名で振り分け (Sentry / Structured Logging wrapped)
   */
  async queue(batch, env): Promise<void> {
    const { logger } = bootstrap(env);
    return withSentry(async () => {
      logger.info('queue.received', { queue: batch.queue, size: batch.messages.length });
      if (batch.queue === 'coreberg-articles') {
        await articleQueueHandler(batch as MessageBatch<ArticleQueueMessage>, env);
      } else if (batch.queue === 'coreberg-monitoring') {
        await monitoringQueueHandler(batch as MessageBatch<MonitoringQueueMessage>, env);
      }
      await logger.flushNow();
    }, { queue: batch.queue });
  },

  /**
   * Cron Triggers (Sentry / Structured Logging wrapped)
   *  - 17:00 UTC (= 02:00 JST 翌日) → 日次 Citation Monitoring
   *  - 18:00 UTC 月初 (= 03:00 JST 月初翌日) → 学習ループ + 月次生成
   *  - */5 * * * * → SLO / AI Cost Materialized View Refresh & dependency pings
   */
  async scheduled(event: ScheduledEvent, env, ctx) {
    const { logger } = bootstrap(env);
    return withSentry(async () => {
      logger.info('cron.fired', { cron: event.cron });
      const cron = event.cron;
      const db = createDb(env);

      if (cron === '0 17 * * *') {
        // 日次 monitoring
        const instance = await env.MONITORING_WORKFLOW.create({
          params: {
            engines: ['chatgpt', 'perplexity', 'gemini', 'google_ai_overview'],
          },
        });
        logger.info('monitoring.workflow_started', { instanceId: instance.id });
        return;
      }

      if (cron === '0 18 1 * *') {
        // 月次: 学習ループ → 翌月の生成
        const { data: projects } = await db
          .from('projects')
          .select('id,user_id,monthly_article_count')
          .eq('status', 'active')
          .is('deleted_at', null);

        const month = new Date();
        month.setUTCDate(1);
        month.setUTCHours(0, 0, 0, 0);
        const prevMonth = new Date(month);
        prevMonth.setUTCMonth(prevMonth.getUTCMonth() - 1);

        for (const p of projects ?? []) {
          // 学習ループ (前月分)
          ctx.waitUntil(
            env.LEARNING_WORKFLOW.create({
              params: { projectId: p.id, month: prevMonth.toISOString().slice(0, 10) },
            }).then((i) => logger.info('learning.workflow_started', { projectId: p.id, instanceId: i.id })),
          );

          // 当月の generation_run を作成
          const monthIso = month.toISOString().slice(0, 10);
          const { data: run, error: re } = await db
            .from('generation_runs')
            .upsert(
              { project_id: p.id, month: monthIso, status: 'pending' },
              { onConflict: 'project_id,month' },
            )
            .select('id')
            .single();
          if (re || !run) continue;

          ctx.waitUntil(
            env.GENERATION_WORKFLOW.create({
              params: {
                projectId: p.id,
                userId: p.user_id,
                generationRunId: run.id,
                monthlyArticleCount: p.monthly_article_count,
              },
            }).then((i) =>
              db.from('generation_runs').update({ workflow_instance_id: i.id }).eq('id', run.id),
            ),
          );
        }
      }

      if (cron === '*/5 * * * *') {
        // 5分毎のメトリクス/SLOデータ/コスト監視バッチ
        const instance = await env.METRICS_REFRESH_WORKFLOW.create({ params: {} });
        logger.info('metrics_refresh.workflow_started', { instanceId: instance.id });
        return;
      }

      await logger.flushNow();
    }, { cron: event.cron });
  },
};

export default handler;
