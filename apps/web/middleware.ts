import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { getUserRole } from '@coreberg/shared';

export async function middleware(request: NextRequest) {
  const requestId = request.headers.get('x-request-id') ?? crypto.randomUUID();
  request.headers.set('x-request-id', requestId);

  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });
  response.headers.set('x-request-id', requestId);

  // Next.js Edge Runtime で Supabase SSR セッションCookieの読み書きを可能にする
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

  // セッションCookieから安全にユーザーを取得（同時に期限切れCookieを自動リフレッシュ）
  const { data: { user } } = await supabase.auth.getUser();

  // ルーティングカテゴリの判定
  const isAuthRoute = request.nextUrl.pathname.startsWith('/login') ||
                      request.nextUrl.pathname.startsWith('/signup');
  
  const isProtected = request.nextUrl.pathname.startsWith('/dashboard') ||
                      request.nextUrl.pathname.startsWith('/onboarding') ||
                      request.nextUrl.pathname.startsWith('/projects') ||
                      request.nextUrl.pathname.startsWith('/account') ||
                      request.nextUrl.pathname.startsWith('/billing');

  if (isProtected) {
    if (!user) {
      // 1. 未ログインユーザーはログイン画面へリダイレクト（戻り先URLをクエリパラメータに保持）
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      url.searchParams.set('redirectTo', request.nextUrl.pathname);
      return NextResponse.redirect(url);
    }
    
    // 2. ロール認証
    const role = getUserRole(user);
    if (!role) {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      return NextResponse.redirect(url);
    }
  }

  // ログイン済みユーザーが再度ログイン/サインアップに来た場合はダッシュボードに強制移動
  if (isAuthRoute && user) {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * 静的アセット（画像やCSS、JSなど）および favicon 以外の全リクエストでミドルウェアをトリガー
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
