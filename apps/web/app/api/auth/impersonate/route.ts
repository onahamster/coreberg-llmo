import { NextResponse } from 'next/server';
import * as jwt from 'jsonwebtoken';
import { createServiceSupabase } from '@/lib/supabase/service';

const IMPERSONATE_JWT_SECRET = process.env.IMPERSONATE_JWT_SECRET || 'fallback-secret-for-jwt-signing';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');

  if (!token) {
    return NextResponse.json({ error: 'token_required' }, { status: 400 });
  }

  try {
    const payload = jwt.verify(token, IMPERSONATE_JWT_SECRET) as { sub: string };
    const targetUserId = payload.sub;

    const admin = createServiceSupabase();
    const { data: user, error } = await admin.auth.admin.getUserById(targetUserId);

    if (error || !user) {
      return NextResponse.json({ error: 'user_not_found' }, { status: 404 });
    }

    // ユーザーセッションを認証状態として偽装するために、Supabase クライアントにインパーソネート用のクッキーを保存
    const response = NextResponse.redirect(new URL('/', request.url));
    response.cookies.set('sb-impersonated-user-id', targetUserId, {
      path: '/',
      secure: true,
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 3600, // 1時間
    });

    return response;
  } catch (e) {
    return NextResponse.json({ error: 'invalid_token', details: String(e) }, { status: 401 });
  }
}
