import { requireCustomer } from '@/lib/auth/customer-guard';
import { createServerSupabase } from '@/lib/supabase/server';
import { ProjectDashboard } from './_components/ProjectDashboard';

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  await requireCustomer();
  const { id } = await params;
  const supabase = await createServerSupabase();

  const [{ data: project }, { data: latestRun }, { data: articleCounts }, { data: citationStats }] =
    await Promise.all([
      supabase
        .from('projects')
        .select('id,name,site_profile_jsonb,audit_jsonb,monthly_article_count,created_at')
        .eq('id', id)
        .single(),
      supabase
        .from('generation_runs')
        .select('id,status,current_step,started_at,finished_at,month')
        .eq('project_id', id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('articles')
        .select('status', { count: 'exact', head: false })
        .eq('project_id', id)
        .is('deleted_at', null),
      supabase
        .from('citation_monitoring')
        .select('cited,engine')
        .eq('cited', true)
        .gte('checked_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
        .in(
          'article_id',
          (
            await supabase
              .from('articles')
              .select('id')
              .eq('project_id', id)
              .is('deleted_at', null)
          ).data?.map((a) => a.id) ?? [],
        ),
    ]);

  const statusCounts: Record<string, number> = {};
  for (const a of articleCounts ?? []) {
    statusCounts[a.status] = (statusCounts[a.status] ?? 0) + 1;
  }

  const enginesCited = new Set((citationStats ?? []).map((c) => c.engine));
  const citationCount = citationStats?.length ?? 0;

  return (
    <ProjectDashboard
      projectId={id}
      latestRun={latestRun}
      statusCounts={statusCounts}
      citationCount={citationCount}
      enginesCovered={enginesCited.size}
      audit={project?.audit_jsonb as Record<string, unknown> | null}
      monthlyArticleCount={project?.monthly_article_count ?? 30}
    />
  );
}
