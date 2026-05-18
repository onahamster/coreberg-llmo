import { requireCustomer } from '@/lib/auth/customer-guard';
import { createServerSupabase } from '@/lib/supabase/server';
import { OnboardingWizard } from './_components/OnboardingWizard';
import { redirect } from 'next/navigation';

export default async function OnboardingPage() {
  const { userId } = await requireCustomer();
  const supabase = await createServerSupabase();

  // すでにプロジェクトがあればダッシュボードへ
  const { data: existing } = await supabase
    .from('projects')
    .select('id')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .limit(1);

  if (existing && existing.length > 0) {
    redirect(`/projects/${existing[0]!.id}`);
  }

  return (
    <div style={{ maxWidth: 720, margin: '40px auto', padding: '0 20px' }}>
      <h1 style={{ fontSize: 28, fontWeight: 600, margin: 0, color: 'var(--fg)' }}>プロジェクト作成</h1>
      <p style={{ color: 'var(--muted)', marginTop: 8 }}>
        5 ステップでサイトを登録し、最初の記事生成を始めます。
      </p>
      <OnboardingWizard />
    </div>
  );
}
