import type { Workflow, Queue } from '@cloudflare/workers-types';
import type { ArticleQueueMessage } from '@coreberg/workers-shared';

export interface CloudflareBindings {
  ONBOARDING_WORKFLOW: Workflow;
  GENERATION_WORKFLOW: Workflow;
  ARTICLE_QUEUE: Queue<ArticleQueueMessage>;
}

/**
 * Next.js Route Handler / Server Action から Cloudflare バインディングを取得する。
 * 開発時 (next dev) ではバインディングが無いので、null を返してフォールバックする。
 */
export async function getBindings(): Promise<CloudflareBindings | null> {
  try {
    const { getCloudflareContext } = await import('@opennextjs/cloudflare');
    const ctx = getCloudflareContext();
    return ctx.env as unknown as CloudflareBindings;
  } catch {
    return null;
  }
}
