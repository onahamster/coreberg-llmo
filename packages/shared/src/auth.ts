import { User } from '@supabase/supabase-js';

// システム内で利用可能なロール定義
export type UserRole = 'customer' | 'support' | 'admin' | 'super_admin';

// 管理画面へのアクセスが許容されるロール群
export const ADMIN_ROLES: UserRole[] = ['support', 'admin', 'super_admin'];

/**
 * 渡された文字列が有効な UserRole か検証するタイプガード
 */
export function isUserRole(role: unknown): role is UserRole {
  return typeof role === 'string' && ['customer', 'support', 'admin', 'super_admin'].includes(role);
}

/**
 * 対象のロールが管理者権限（support, admin, super_admin）を持つか検証
 */
export function isAdmin(role: UserRole): boolean {
  return ADMIN_ROLES.includes(role);
}

/**
 * Supabase の User オブジェクトからロール情報を安全に抽出
 */
export function getUserRole(user: User | null): UserRole {
  if (!user) return 'customer';

  // PostgreSQL トリガー経由で同期された auth.users.raw_app_meta_data のロールを取得
  const appRole = user.app_metadata?.user_role;
  if (isUserRole(appRole)) {
    return appRole;
  }

  // フォールバックとして user_metadata から取得を試行
  const userRole = user.user_metadata?.user_role;
  if (isUserRole(userRole)) {
    return userRole;
  }

  return 'customer';
}

/**
 * 管理者のメールアドレスが許可された組織ドメインに属しているか検証
 */
export function isValidAdminEmail(email: string | undefined, allowedDomains: string[]): boolean {
  if (!email) return false;
  
  const domain = email.split('@')[1];
  if (!domain) return false;

  const normalizedDomain = domain.toLowerCase().trim();
  return allowedDomains.some(d => d.toLowerCase().trim() === normalizedDomain);
}

/**
 * なりすまし（Impersonation）トークンの形式バリデーション
 */
export function isValidImpersonationToken(token: string | null): boolean {
  if (!token) return false;
  // UUIDv4 または SHA256 ハッシュ文字列であるか簡易チェック
  return /^[a-f0-9]{64}$/i.test(token) || /^[0-9a-f]{8}-[0-9a-f]{4}-[45][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(token);
}
