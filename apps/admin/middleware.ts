import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { getUserRole, isAdmin, isValidAdminEmail } from '@coreberg/shared';

// 環境変数から許可する組織ドメインリストと IP アドレスリストを取得
const ALLOWED_DOMAINS = (process.env.ADMIN_ALLOWED_DOMAINS || 'coreberg.com')
  .split(',')
  .map(d => d.trim().toLowerCase());

const IP_ALLOWLIST = (process.env.ADMIN_IP_ALLOWLIST || '')
  .split(',')
  .map(ip => ip.trim())
  .filter(Boolean);

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  // Next.js Edge Runtime で Supabase SSR クライアントを作成
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // 🛡️ レイヤー 1: WAF/IPアドレス検証（IP制限が設定されている場合）
  if (IP_ALLOWLIST.length > 0) {
    const clientIp = request.ip || request.headers.get('x-forwarded-for') || '';
    const isAllowedIp = IP_ALLOWLIST.some(allowedIp => clientIp.includes(allowedIp));
    if (!isAllowedIp) {
      return new NextResponse('Access Denied: IP address not allowed', { status: 403 });
    }
  }

  // セッションCookieから安全に管理者ユーザーを取得
  const { data: { user } } = await supabase.auth.getUser();

  // ルーティング状態の判定
  const isAuthRoute = request.nextUrl.pathname.startsWith('/login');
  const is2faRoute = request.nextUrl.pathname.startsWith('/2fa');
  const isCallback = request.nextUrl.pathname.startsWith('/callback') ||
                     request.nextUrl.pathname.startsWith('/auth/callback') ||
                     request.nextUrl.pathname.startsWith('/api/callback');

  // 認証コールバックは処理をバイパスする
  if (isCallback) {
    return response;
  }

  // 認証・2FA画面以外の全ルートを保護
  const isProtected = !isAuthRoute && !is2faRoute;

  if (isProtected) {
    if (!user) {
      // 1. 未ログインなら /login にリダイレクト
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      return NextResponse.redirect(url);
    }

    // 🛡️ レイヤー 2: ロール認可チェック (support, admin, super_admin)
    const role = getUserRole(user);
    if (!role || !isAdmin(role)) {
      // 一般顧客による管理画面アクセスは拒否
      return new NextResponse('Forbidden: Admin access privilege required', { status: 403 });
    }

    // 🛡️ レイヤー 3: Google Workspace ホストドメイン検証 (例: @coreberg.com)
    if (!isValidAdminEmail(user.email, ALLOWED_DOMAINS)) {
      return new NextResponse('Forbidden: Restricted organization email domain', { status: 403 });
    }

    // 🛡️ レイヤー 4: 2要素認証 (TOTP 2FA) チェック
    // profilesテーブルを参照して、2FAが有効な場合はセッション検証完了Cookieをチェック
    const { data: profile } = await supabase
      .from('profiles')
      .select('totp_enabled')
      .eq('id', user.id)
      .single();

    if (profile?.totp_enabled) {
      const is2faVerified = request.cookies.get('admin_2fa_verified')?.value === 'true';
      if (!is2faVerified) {
        // 2FA検証が未完了なら /2fa 画面へリダイレクト
        const url = request.nextUrl.clone();
        url.pathname = '/2fa';
        return NextResponse.redirect(url);
      }
    }
  }

  // すでに完全にログイン済みの管理者が /login にアクセスした場合はダッシュボードへ戻す
  if (isAuthRoute && user) {
    const role = getUserRole(user);
    if (role && isAdmin(role) && isValidAdminEmail(user.email, ALLOWED_DOMAINS)) {
      const url = request.nextUrl.clone();
      url.pathname = '/dashboard';
      return NextResponse.redirect(url);
    }
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * 静的アセットおよび favicon 以外の全リクエストでミドルウェアをトリガー
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
