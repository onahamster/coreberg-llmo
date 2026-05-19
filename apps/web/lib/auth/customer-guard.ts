import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

/**
 * Route Handler / Server Component から認証済み顧客ユーザーを取得する。
 * 未認証の場合はログインページへリダイレクト（Server Component 用）または
 * 401 エラーを throw する（Route Handler 用 — caller がキャッチすること）。
 *
 * @returns {{ userId: string }} 認証済みユーザーのID
 */
export async function requireCustomer(): Promise<{ userId: string }> {
  const cookieStore = await cookies();

  const supabase = createServerClient(
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

  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    // Route Handler の場合は throw、Page の場合は redirect を使う
    // ここでは Route Handler でも使えるよう Error を throw する。
    // Page/Layout から呼ぶ場合は redirect('/login') を直接呼ぶこと。
    redirect('/login');
  }

  return { userId: user.id };
}
