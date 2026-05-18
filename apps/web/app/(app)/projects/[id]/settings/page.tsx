import { requireCustomer } from '@/lib/auth/customer-guard';
import { createServerSupabase } from '@/lib/supabase/server';
import { SettingsForm } from './_components/SettingsForm';

export default async function SettingsPage({ params }: { params: Promise<{ id: string }> }) {
  await requireCustomer();
  const { id } = await params;
  const supabase = await createServerSupabase();

  const { data: project } = await supabase
    .from('projects')
    .select('id,name,site_url,target_audience,target_locale,monthly_article_count,wp_endpoint,wp_username')
    .eq('id', id)
    .single();

  return (
    <div style={{ maxWidth: 640 }}>
      <h2 style={{ margin: 0, fontSize: 18, color: 'var(--fg)', fontWeight: 600 }}>プロジェクト設定</h2>
      {project && <SettingsForm project={project} />}
    </div>
  );
}
