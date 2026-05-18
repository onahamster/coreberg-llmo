import { requireCustomer } from '@/lib/auth/customer-guard';
import { createServerSupabase } from '@/lib/supabase/server';

export default async function KeywordsPage({ params }: { params: Promise<{ id: string }> }) {
  await requireCustomer();
  const { id } = await params;
  const supabase = await createServerSupabase();

  const { data: run } = await supabase
    .from('generation_runs')
    .select('id')
    .eq('project_id', id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!run) {
    return <p style={{ color: 'var(--muted)' }}>まだ生成バッチがありません。</p>;
  }

  const { data: subqueries } = await supabase
    .from('subqueries')
    .select('id,text,pattern,citation_score,citation_likelihood,competitor_weakness,topic_contribution,selected,cluster_id')
    .eq('generation_run_id', run.id)
    .order('citation_score', { ascending: false, nullsFirst: false });

  const selected = (subqueries ?? []).filter((s) => s.selected);
  const candidates = (subqueries ?? []).filter((s) => !s.selected).slice(0, 50);

  return (
    <div>
      <h2 style={{ margin: 0, fontSize: 18, color: 'var(--fg)', fontWeight: 600 }}>選定済みキーワード ({selected.length} 件)</h2>
      <KeywordList items={selected} />

      <h2 style={{ margin: '32px 0 0 0', fontSize: 18, color: 'var(--fg)', fontWeight: 600 }}>候補キーワード（未選定上位 50 件）</h2>
      <KeywordList items={candidates} />
    </div>
  );
}

function KeywordList({
  items,
}: {
  items: {
    id: string;
    text: string;
    pattern: string;
    citation_score: number | null;
    citation_likelihood: number | null;
    competitor_weakness: number | null;
    topic_contribution: number | null;
  }[];
}) {
  if (items.length === 0) {
    return <p style={{ color: 'var(--muted)', fontSize: 13 }}>該当なし</p>;
  }
  return (
    <div
      style={{
        marginTop: 12,
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
        gap: 12,
      }}
    >
      {items.map((s) => (
        <div
          key={s.id}
          style={{
            border: '1px solid var(--border)',
            borderRadius: 10,
            padding: 14,
            background: 'var(--card-bg, transparent)',
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--fg)' }}>{s.text}</div>
          <div style={{ marginTop: 8, fontSize: 11, color: 'var(--muted)' }}>{s.pattern}</div>
          <div
            style={{
              marginTop: 8,
              display: 'flex',
              gap: 8,
              fontSize: 11,
              color: 'var(--muted)',
            }}
          >
            <span>Score: <strong style={{ color: 'var(--fg)' }}>{fmt(s.citation_score)}</strong></span>
            <span>引用: {fmt(s.citation_likelihood)}</span>
            <span>競合弱: {fmt(s.competitor_weakness)}</span>
            <span>寄与: {fmt(s.topic_contribution)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function fmt(n: number | null): string {
  return n === null ? '-' : String(Math.round(n));
}
