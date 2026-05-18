import { describe, it, expect, vi } from 'vitest';
import { handleArticlePublish } from './article-publish';
import { makeWorkerEnv } from '@coreberg/test-utils';

describe('article-publish queue', () => {
  it('retries on 429 then succeeds', async () => {
    const ack = vi.fn();
    const retry = vi.fn();
    const env = makeWorkerEnv();
    let attempts = 0;

    vi.doMock('@coreberg/wordpress', () => ({
      WordPressClient: vi.fn(() => ({
        publishArticle: vi.fn(async () => {
          if (++attempts < 2) {
            throw Object.assign(new Error('429'), { status: 429, retryAfter: 1 });
          }
          return { id: 99, link: 'https://x/p/99' };
        }),
      })),
    }));

    const batch: any = { messages: [{ body: { articleId: 'a1', projectId: 'p1' }, attempts: 1, ack, retry }] };
    await handleArticlePublish(batch, env as any);
    expect(retry).toHaveBeenCalledTimes(1);
  });
});
