import type { MessageBatch } from '@cloudflare/workers-types';
import type { WorkersEnv, MonitoringQueueMessage } from '../env';
import { createDb } from '../db';
import { runCitationCheck } from '@coreberg/ai/pipelines/monitoring';

export async function monitoringQueueHandler(
  batch: MessageBatch<MonitoringQueueMessage>,
  env: WorkersEnv,
): Promise<void> {
  const db = createDb(env);

  for (const message of batch.messages) {
    const msg = message.body;
    try {
      const result = await runCitationCheck(env, msg);

      await db.from('citation_monitoring').insert({
        article_id: msg.articleId,
        subquery_id: msg.subqueryId,
        engine: msg.engine,
        cited: result.cited,
        position: result.position,
        snippet: result.snippet,
        competitor_domains: result.competitorDomains,
        raw_response_jsonb: result.raw,
      });

      message.ack();
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e);
      console.error('monitoring queue error', msg.articleId, msg.engine, errMsg);
      message.retry({ delaySeconds: 120 });
    }
  }
}
