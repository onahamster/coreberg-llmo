import { DurableObject } from 'cloudflare:workers';
import type { WorkersEnv } from '../env';

interface ProgressState {
  generationRunId: string;
  total: number;
  status: Record<string, number>; // status -> count
  lastUpdated: string;
}

/**
 * 30 並列のサブステップ進捗を 1 つの DO に集約。
 * WebSocket 経由でフロントへ流す代わりに、Supabase Realtime を使う方針なので
 * ここは主に「最新サマリのキャッシュ」と「重複イベント抑止」に使う
 */
export class ProgressAggregator extends DurableObject<WorkersEnv> {
  async getState(generationRunId: string): Promise<ProgressState | null> {
    const stored = await this.ctx.storage.get<ProgressState>(`run:${generationRunId}`);
    return stored ?? null;
  }

  async updateStatus(
    generationRunId: string,
    articleId: string,
    status: string,
    total: number,
  ): Promise<ProgressState> {
    const key = `run:${generationRunId}`;
    const prev =
      (await this.ctx.storage.get<ProgressState>(key)) ?? {
        generationRunId,
        total,
        status: {},
        lastUpdated: new Date().toISOString(),
      };

    const prevArticleStatus = await this.ctx.storage.get<string>(`article:${articleId}`);
    if (prevArticleStatus) {
      prev.status[prevArticleStatus] = Math.max(0, (prev.status[prevArticleStatus] ?? 1) - 1);
    }
    prev.status[status] = (prev.status[status] ?? 0) + 1;
    prev.lastUpdated = new Date().toISOString();
    prev.total = total;

    await this.ctx.storage.put(key, prev);
    await this.ctx.storage.put(`article:${articleId}`, status);
    return prev;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === 'GET' && url.pathname === '/state') {
      const runId = url.searchParams.get('run');
      if (!runId) return new Response('missing run', { status: 400 });
      const state = await this.getState(runId);
      return Response.json(state ?? null);
    }
    return new Response('not found', { status: 404 });
  }
}
