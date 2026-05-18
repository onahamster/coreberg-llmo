import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/admin-guard';
import * as jwt from 'jsonwebtoken';

const IMPERSONATE_JWT_SECRET = process.env.IMPERSONATE_JWT_SECRET || 'fallback-secret-for-jwt-signing';

export async function POST(request: Request) {
  await requireAdmin();
  const body = await request.json().catch(() => null);
  const targetUserId = body?.userId;

  if (!targetUserId) {
    return NextResponse.json({ error: 'target_user_id_required' }, { status: 400 });
  }

  // 1時間有効なインパーソネートトークンを発行
  const token = jwt.sign(
    {
      sub: targetUserId,
      iss: 'coreberg-admin',
      aud: 'coreberg-web',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
    },
    IMPERSONATE_JWT_SECRET,
  );

  const redirectUrl = `${
    process.env.NEXT_PUBLIC_APP_URL || 'https://app.coreberg.com'
  }/api/auth/impersonate?token=${token}`;

  return NextResponse.json({ token, redirectUrl });
}
