import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/admin-guard';
import * as jwt from 'jsonwebtoken';
import { createServiceSupabase } from '@/lib/supabase/service';

/**
 * POST /api/auth/impersonate
 * 管理者が指定顧客として1時間インパーソネートするJWTを発行する
 *
 * M-3: 環境変数が未設定の場合は起動を拒否（フォールバック平文シークレットを削除）
 * M-6: audit_log に記録を追加
 */
export async function POST(request: Request) {
  const secret = process.env.IMPERSONATE_JWT_SECRET;
  if (!secret) {
    // フォールバックシークレットは削除済み。環境変数が未設定なら機能を無効化する。
    return NextResponse.json(
      { error: 'impersonation_disabled', message: 'IMPERSONATE_JWT_SECRET is not configured.' },
      { status: 503 },
    );
  }

  const { userId: adminUserId } = await requireAdmin();
  const body = await request.json().catch(() => null);
  const targetUserId = body?.userId;

  if (!targetUserId || typeof targetUserId !== 'string') {
    return NextResponse.json({ error: 'target_user_id_required' }, { status: 400 });
  }

  const sb = createServiceSupabase();

  // 対象ユーザーが存在するか事前確認
  const { data: targetUser, error: userErr } = await sb.auth.admin.getUserById(targetUserId);
  if (userErr || !targetUser) {
    return NextResponse.json({ error: 'target_user_not_found' }, { status: 404 });
  }

  // 1時間有効なインパーソネートトークンを発行（iss/aud 付き）
  const token = jwt.sign(
    {
      sub: targetUserId,
      iss: 'coreberg-admin',  // 発行者
      aud: 'coreberg-web',    // 受信者
    },
    secret,
    { expiresIn: '1h' },
  );

  // M-6: 監査ログに記録（admin による impersonate は最重要の監査対象）
  await sb.rpc('log_audit', {
    p_actor_id: adminUserId,
    p_actor_role: 'admin',
    p_action: 'admin.impersonate_issued',
    p_resource_type: 'user',
    p_resource_id: targetUserId,
    p_target_user_id: targetUserId,
    p_metadata: { target_email: targetUser.user?.email },
    p_actor_ip: request.headers.get('cf-connecting-ip'),
    p_actor_user_agent: request.headers.get('user-agent'),
  }).catch((e) => console.error('audit log failed for impersonate', e));

  const redirectUrl = `${
    process.env.NEXT_PUBLIC_APP_URL || 'https://app.coreberg.com'
  }/api/auth/impersonate?token=${token}`;

  return NextResponse.json({ token, redirectUrl });
}
