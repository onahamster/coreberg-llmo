import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Service Role を使う Supabase クライアント（RLS をバイパス）
 * Route Handler 内でのみ使用。フロントエンドコンポーネントには渡さないこと。
 */
export function createServiceSupabase(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for service role operations.',
    );
  }

  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * getServiceClient は createServiceSupabase のエイリアス
 * admin 側のコードとの互換性のために提供
 */
export const getServiceClient = createServiceSupabase;
