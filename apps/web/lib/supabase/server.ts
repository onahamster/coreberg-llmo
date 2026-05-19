import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * Next.js Server Component / Route Handler 用の Supabase クライアント（anon キー）
 * RLS が効いた状態でログイン中ユーザーとして操作する
 */
export async function createServerSupabase() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Server Component から呼ばれた場合は Cookie 書き込み不可（無視）
          }
        },
      },
    },
  );
}
