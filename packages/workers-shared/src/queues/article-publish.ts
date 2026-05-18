import type { MessageBatch } from "@cloudflare/workers-types";
import { publishArticleJob } from "../wordpress/publisher";
import type { WorkersEnv } from "../env";

export interface PublishMessage {
  articleId: string;
  projectId: string;
  scheduledAt?: string;
}

export async function handleArticlePublishQueue(
  batch: MessageBatch<PublishMessage>,
  env: WorkersEnv,
): Promise<void> {
  for (const msg of batch.messages) {
    try {
      await publishArticleJob(env, msg.body);
      msg.ack();
    } catch (err) {
      console.error("publish failed", {
        articleId: msg.body.articleId,
        error: (err as Error).message,
        attempts: msg.attempts,
      });
      // Retry up to 5 times; after that send to DLQ
      if (msg.attempts >= 5) {
        msg.ack(); // give up; DLQ defined in wrangler.toml will capture via dead_letter_queue
      } else {
        msg.retry({ delaySeconds: Math.min(60 * msg.attempts, 600) });
      }
    }
  }
}
