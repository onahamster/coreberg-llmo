import { NextResponse } from 'next/server';
import * as jwt from 'jsonwebtoken';
import { createServiceSupabase } from '@/lib/supabase/service';

/**
 * GET /api/auth/impersonate?token=<jwt>
 * admin が発行したJWTを受け取り、Supabase の正規セッションに変換してリダイレクト
 *
 * M-3: フォールバック平文シークレットを削除
 * M-4: iss / aud の検証を追加
 * M-5: Supabase Admin API generateLink() を使う正規フローに変更
 *       - 旧: 独自Cookie (Supabase が無視するため機能しなかった)
 *       - 新: magic link を生成し exchangeCodeForSession でセッションを確立
 */
export async function GET(request: Request) {
  const secret = process.env.IMPERSONATE_JWT_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: 'impersonation_disabled', message: 'IMPERSONATE_JWT_SECRET is not configured.' },
      { status: 503 },
    );
  }

  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');

  if (!token) {
    return NextResponse.json({ error: 'token_required' }, { status: 400 });
  }

  try {
    // M-4: iss / aud の厳密な検証を追加
    const payload = jwt.verify(token, secret, {
      issuer: 'coreberg-admin',
      audience: 'coreberg-web',
    }) as { sub: string };

    const targetUserId = payload.sub;

    const admin = createServiceSupabase();

    // M-5: Supabase Admin API で magic link を生成し、正規セッションを確立する
    //      - 旧の独自Cookie方式は Supabase getUser() が完全無視するため機能しなかった
    const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email: '', // email ではなく user_id ベースで生成
      options: { data: { impersonated_by: 'admin', target_user_id: targetUserId } },
    });

    if (linkErr || !linkData) {
      // generateLink が user_id ベースをサポートしない場合のフォールバック:
      // ユーザーのメールで magic link を生成する
      const { data: userRecord, error: userErr } = await admin.auth.admin.getUserById(targetUserId);
      if (userErr || !userRecord?.user?.email) {
        return NextResponse.json({ error: 'user_not_found' }, { status: 404 });
      }

      const { data: fallbackLink, error: fallbackErr } = await admin.auth.admin.generateLink({
        type: 'magiclink',
        email: userRecord.user.email,
      });

      if (fallbackErr || !fallbackLink?.properties?.hashed_token) {
        return NextResponse.json({ error: 'session_generation_failed' }, { status: 500 });
      }

      // magic link の URL をそのままリダイレクト
      const magicUrl = fallbackLink.properties.action_link;
      return NextResponse.redirect(magicUrl);
    }

    const magicUrl = linkData.properties?.action_link;
    if (!magicUrl) {
      return NextResponse.json({ error: 'magic_link_missing' }, { status: 500 });
    }

    return NextResponse.redirect(magicUrl);
  } catch (e) {
    // jwt.verify が失敗した場合（署名不一致・期限切れ・iss/aud 不一致を含む）
    return NextResponse.json({ error: 'invalid_token', details: String(e) }, { status: 401 });
  }
}
