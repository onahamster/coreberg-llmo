import type { MessageBatch } from '@cloudflare/workers-types';
import type { WorkersEnv, ArticleQueueMessage } from '../env';
import { createDb } from '../db';
import {
  runArticleDraft,
  runStructureCheck,
  runFactVerification,
  runHtmlSchema,
  runImageGeneration,
} from '@coreberg/ai/pipelines/article';

const STEP_ORDER: ArticleQueueMessage['startStep'][] = [
  'draft',
  'check',
  'fact',
  'html',
  'image',
];

/**
 * Step 6.1 〜 6.5 を直列に実行するキューコンシューマ
 * 各サブステップを別メッセージに分割し、5 分制限を回避する
 */
export async function articleQueueHandler(
  batch: MessageBatch<ArticleQueueMessage>,
  env: WorkersEnv,
): Promise<void> {
  const db = createDb(env);

  for (const message of batch.messages) {
    const msg = message.body;
    try {
      // article 存在チェック
      const { data: article, error } = await db
        .from('articles')
        .select('id,plan_id,project_id,status')
        .eq('id', msg.articleId)
        .maybeSingle();
      if (error || !article) {
        message.ack();
        continue;
      }
      // 既に published or failed なら完了扱い
      if (['completed', 'failed', 'published'].includes(article.status)) {
        message.ack();
        continue;
      }

      // 現在ステップを実行
      switch (msg.startStep) {
        case 'draft':
          await db.from('articles').update({ status: 'drafting' }).eq('id', msg.articleId);
          await runArticleDraft(env, msg);
          await enqueueNext(env, msg, 'check');
          break;

        case 'check':
          await db.from('articles').update({ status: 'checking' }).eq('id', msg.articleId);
          await runStructureCheck(env, msg);
          await enqueueNext(env, msg, 'fact');
          break;

        case 'fact':
          await db.from('articles').update({ status: 'fact_checking' }).eq('id', msg.articleId);
          await runFactVerification(env, msg);
          await enqueueNext(env, msg, 'html');
          break;

        case 'html':
          await db.from('articles').update({ status: 'finalizing' }).eq('id', msg.articleId);
          await runHtmlSchema(env, msg);
          await enqueueNext(env, msg, 'image');
          break;

        case 'image':
          await runImageGeneration(env, msg);
          await db
            .from('articles')
            .update({ status: 'completed' })
            .eq('id', msg.articleId);
          break;
      }

      message.ack();
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e);
      console.error('article queue error', msg.articleId, msg.startStep, errMsg);

      if (msg.attempt >= 5) {
        await db
          .from('articles')
          .update({
            status: 'failed',
            error_message: errMsg.slice(0, 1000),
            retry_count: msg.attempt,
          })
          .eq('id', msg.articleId);
        message.ack();
      } else {
        message.retry({ delaySeconds: Math.min(60 * 2 ** msg.attempt, 600) });
      }
    }
  }
}

async function enqueueNext(
  env: WorkersEnv,
  prev: ArticleQueueMessage,
  next: ArticleQueueMessage['startStep'],
): Promise<void> {
  const idx = STEP_ORDER.indexOf(next);
  if (idx < 0) return;
  await env.ARTICLE_QUEUE.send({
    ...prev,
    startStep: next,
    attempt: 1,
  });
}
