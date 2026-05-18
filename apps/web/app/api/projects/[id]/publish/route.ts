import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireCustomer } from '@/lib/auth/customer-guard';
import { createServiceSupabase } from '@/lib/supabase/service';

const bodySchema = z.object({ articleId: z.string().uuid() });

/**
 * POST /api/projects/[id]/publish
 * 単一記事を WordPress に下書き投稿（実 API 連携は次レイヤーで）
 * このレイヤーでは status を published に更新し、published_at を打つだけ
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await requireCustomer();
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  const admin = createServiceSupabase();
  const { data: article } = await admin
    .from('articles')
    .select('id,project_id,status')
    .eq('id', parsed.data.articleId)
    .eq('project_id', id)
    .is('deleted_at', null)
    .maybeSingle();

  if (!article) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  // status: completed → published に移行
  if (article.status !== 'completed' && article.status !== 'published') {
    return NextResponse.json({ error: 'article_not_ready' }, { status: 400 });
  }

  await admin
    .from('articles')
    .update({
      status: 'published',
      published_at: new Date().toISOString(),
    })
    .eq('id', article.id);

  await admin.rpc('log_audit', {
    p_actor_id: userId,
    p_actor_role: 'customer',
    p_action: 'article.published',
    p_resource_type: 'article',
    p_resource_id: article.id,
    p_target_user_id: userId,
    p_metadata: { project_id: id },
    p_actor_ip: request.headers.get('cf-connecting-ip'),
    p_actor_user_agent: request.headers.get('user-agent'),
  });

  return NextResponse.json({ ok: true });
}
