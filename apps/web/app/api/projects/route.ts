import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireCustomer } from '@/lib/auth/customer-guard';
import { createServiceSupabase } from '@/lib/supabase/service';
import { getBindings } from '@/lib/cloudflare';

const bodySchema = z.object({
  name: z.string().min(1).max(100),
  siteUrl: z.string().url(),
  targetAudience: z.string().max(2000).optional(),
  targetLocale: z.enum(['ja', 'en']),
  monthlyArticleCount: z.number().int().min(1).max(100),
  wpEndpoint: z.string().url().optional().or(z.literal('')),
  wpUsername: z.string().optional(),
  wpAppPassword: z.string().optional(),
});

export async function POST(request: Request) {
  const { userId } = await requireCustomer();
  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_body', details: parsed.error.flatten() }, { status: 400 });
  }

  const input = parsed.data;
  const admin = createServiceSupabase();

  // 既存プロジェクト数チェック（MVP は 1 ユーザー 1 プロジェクトに制限）
  const { count } = await admin
    .from('projects')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .is('deleted_at', null);

  if ((count ?? 0) >= 1) {
    return NextResponse.json({ error: 'project_limit_reached' }, { status: 403 });
  }

  // 暗号化された WP password を保存するため admin_set_wp_password RPC 経由で書く
  const { data: project, error } = await admin
    .from('projects')
    .insert({
      user_id: userId,
      name: input.name,
      site_url: input.siteUrl,
      target_audience: input.targetAudience ?? null,
      target_locale: input.targetLocale,
      monthly_article_count: input.monthlyArticleCount,
      wp_endpoint: input.wpEndpoint || null,
      wp_username: input.wpUsername || null,
    })
    .select('id')
    .single();

  if (error || !project) {
    return NextResponse.json({ error: 'create_failed', message: error?.message }, { status: 500 });
  }

  if (input.wpAppPassword && input.wpEndpoint) {
    await admin.rpc('admin_set_wp_password', {
      p_project_id: project.id,
      p_plaintext: input.wpAppPassword,
    });
  }

  // 監査ログ
  await admin.rpc('log_audit', {
    p_actor_id: userId,
    p_actor_role: 'customer',
    p_action: 'project.created',
    p_resource_type: 'project',
    p_resource_id: project.id,
    p_target_user_id: userId,
    p_metadata: { site_url: input.siteUrl },
    p_actor_ip: request.headers.get('cf-connecting-ip'),
    p_actor_user_agent: request.headers.get('user-agent'),
  });

  // Onboarding Workflow を起動
  const bindings = await getBindings();
  if (bindings) {
    try {
      const instance = await bindings.ONBOARDING_WORKFLOW.create({
        params: {
          projectId: project.id,
          userId,
          siteUrl: input.siteUrl,
          targetAudience: input.targetAudience,
          targetLocale: input.targetLocale,
        },
      });
      console.log('onboarding workflow started', instance.id);
    } catch (e) {
      console.error('failed to start onboarding workflow', e);
      // Workflow 起動失敗でもプロジェクト自体は作成済みとして返す
    }
  }

  return NextResponse.json({ projectId: project.id });
}
