import { createBrowserClient } from '@supabase/ssr';

/**
 * Next.js Client Component 用の Supabase クライアント（anon キー）
 * ブラウザ上で RLS が効いた状態でログイン中ユーザーとして操作する
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
