import { NextResponse } from 'next/server';
import { requireCustomer } from '@/lib/auth/customer-guard';
import { createServerSupabase } from '@/lib/supabase/server';
import { createServiceSupabase } from '@/lib/supabase/service';
import { getBindings } from '@/lib/cloudflare';

/**
 * POST /api/projects/[id]/generate
 * 当月の generation_run を作成し、Generation Workflow を起動する
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await requireCustomer();
  const { id } = await params;

  const supabase = await createServerSupabase();
  const { data: project } = await supabase
    .from('projects')
    .select('id,user_id,monthly_article_count,site_profile_jsonb')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();

  if (!project) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  // site_profile_jsonb が空ならまだオンボーディングが完了していない
  if (!project.site_profile_jsonb) {
    return NextResponse.json({ error: 'onboarding_incomplete' }, { status: 400 });
  }

  const admin = createServiceSupabase();
  const month = new Date();
  month.setUTCDate(1);
  month.setUTCHours(0, 0, 0, 0);
  const monthIso = month.toISOString().slice(0, 10);

  const { data: run, error } = await admin
    .from('generation_runs')
    .upsert(
      { project_id: id, month: monthIso, status: 'pending' },
      { onConflict: 'project_id,month' },
    )
    .select('id,status')
    .single();

  if (error || !run) {
    return NextResponse.json({ error: 'create_run_failed', message: error?.message }, { status: 500 });
  }

  if (run.status === 'running') {
    return NextResponse.json({ runId: run.id, status: 'already_running' });
  }

  // M-14 修正: completed も二重起動を防ぐ
  // ボタン連打や再試行によるコスト爆発を防止する
  if (run.status === 'completed') {
    return NextResponse.json({ runId: run.id, status: 'already_completed' });
  }

  const bindings = await getBindings();
  if (!bindings) {
    return NextResponse.json({ error: 'workflow_unavailable' }, { status: 503 });
  }

  const instance = await bindings.GENERATION_WORKFLOW.create({
    params: {
      projectId: id,
      userId,
      generationRunId: run.id,
      monthlyArticleCount: project.monthly_article_count,
    },
  });

  await admin
    .from('generation_runs')
    .update({ workflow_instance_id: instance.id })
    .eq('id', run.id);

  await admin.rpc('log_audit', {
    p_actor_id: userId,
    p_actor_role: 'customer',
    p_action: 'generation.started',
    p_resource_type: 'generation_run',
    p_resource_id: run.id,
    p_target_user_id: userId,
    p_metadata: { project_id: id, workflow_instance: instance.id },
    p_actor_ip: request.headers.get('cf-connecting-ip'),
    p_actor_user_agent: request.headers.get('user-agent'),
  });

  return NextResponse.json({ runId: run.id, instanceId: instance.id });
}
