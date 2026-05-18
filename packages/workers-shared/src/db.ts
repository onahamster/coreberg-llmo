import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { WorkersEnv } from './env';

/**
 * Worker 内で使う service_role Supabase クライアント
 */
export function createDb(env: WorkersEnv): SupabaseClient {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * generation_runs のステータスを更新するヘルパー
 */
export async function updateRunStatus(
  db: SupabaseClient,
  runId: string,
  patch: {
    status?: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
    current_step?: string;
    started_at?: string;
    finished_at?: string;
    error_jsonb?: unknown;
  },
): Promise<void> {
  const { error } = await db.from('generation_runs').update(patch).eq('id', runId);
  if (error) throw new Error(`updateRunStatus failed: ${error.message}`);
}

/**
 * ai_usage に課金トラッキングを記録する
 */
export async function recordAiUsage(
  db: SupabaseClient,
  row: {
    user_id?: string | null;
    project_id?: string | null;
    generation_run_id?: string | null;
    article_id?: string | null;
    step: string;
    model: string;
    input_tokens: number;
    output_tokens: number;
    thinking_tokens?: number;
    grounding_requests?: number;
    image_count?: number;
    cost_cents: number;
    latency_ms?: number;
    cache_hit?: boolean;
    ai_gateway_log_id?: string;
  },
): Promise<void> {
  const { error } = await db.from('ai_usage').insert({
    ...row,
    thinking_tokens: row.thinking_tokens ?? 0,
    grounding_requests: row.grounding_requests ?? 0,
    image_count: row.image_count ?? 0,
    cache_hit: row.cache_hit ?? false,
  });
  if (error) {
    // ログに記録するだけ。コストトラッキング失敗で本処理を止めない
    console.error('recordAiUsage failed', error.message);
  }
}
