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
 * getServiceClient は createDb のエイリアス（後方互換のため）
 */
export const getServiceClient = createDb;

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

/**
 * audit_logs テーブルへの監査ログ記録ヘルパー
 */
export async function recordAuditLog(
  db: SupabaseClient,
  row: {
    actor_type: 'system' | 'customer' | 'admin';
    actor_id?: string | null;
    action: string;
    target_type: string;
    target_id?: string | null;
    metadata?: unknown;
  },
): Promise<void> {
  const { error } = await db.from('audit_logs').insert({
    actor_type: row.actor_type,
    actor_id: row.actor_id ?? null,
    action: row.action,
    target_type: row.target_type,
    target_id: row.target_id ?? null,
    metadata: row.metadata ?? null,
  });
  if (error) {
    // 監査ログ失敗で本処理を止めない
    console.error('recordAuditLog failed', error.message);
  }
}
