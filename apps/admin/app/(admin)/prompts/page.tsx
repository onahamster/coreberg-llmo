import { requireAdmin } from '@/lib/auth/admin-guard';
import { createServerSupabase } from '@/lib/supabase/server';
import { PromptEditor } from './_components/PromptEditor';

export default async function PromptsPage() {
  await requireAdmin();
  const supabase = await createServerSupabase();

  const { data: prompts } = await supabase
    .from('prompts')
    .select('id,key,version,system_prompt,user_prompt_template,is_active,created_at')
    .order('key', { ascending: true })
    .order('version', { ascending: false });

  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ fontSize: 24, fontWeight: 600, margin: 0, color: 'var(--fg)' }}>プロンプト管理 & バージョンコントロール</h1>
      <p style={{ color: 'var(--muted)', marginTop: 8 }}>
        AI パイプラインで使用されるプロンプトテンプレートを管理します。
      </p>
      <PromptEditor initialPrompts={prompts ?? []} />
    </div>
  );
}
