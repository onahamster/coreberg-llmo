import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { User } from '@supabase/supabase-js';
import { getUserRole, isAdmin, isValidAdminEmail } from '@coreberg/shared';

const ALLOWED_DOMAINS = (process.env.ADMIN_ALLOWED_DOMAINS || 'coreberg.com')
  .split(',')
  .map((d) => d.trim().toLowerCase());

/**
 * Route Handler / Server Component から認証済み管理者ユーザーを取得する。
 * 未認証・権限不足の場合はリダイレクトまたは 403 エラーを throw する。
 *
 * M-11 修正: { userId, user } の両方を返すことで flags/prompts ルート双方の型を満たす
 *
 * @returns {{ userId: string; user: User }} 認証済み管理者のID とユーザーオブジェクト
 */
export async function requireAdmin(): Promise<{ userId: string; user: User }> {
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: any) {
          try {
            cookiesToSet.forEach(({ name, value, options }: any) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // 無視
          }
        },
      },
    },
  );

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    redirect('/login');
  }

  const role = getUserRole(user);
  if (!isAdmin(role)) {
    redirect('/login');
  }

  if (!isValidAdminEmail(user.email, ALLOWED_DOMAINS)) {
    redirect('/login');
  }

  return { userId: user.id, user };
}
