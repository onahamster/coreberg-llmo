import { requireCustomer } from '@/lib/auth/customer-guard';
import { createServerSupabase } from '@/lib/supabase/server';

export default async function ReportsPage({ params }: { params: Promise<{ id: string }> }) {
  await requireCustomer();
  const { id } = await params;
  const supabase = await createServerSupabase();

  const { data: usage } = await supabase
    .from('ai_usages')
    .select('step,model,input_tokens,output_tokens,cost_cents,created_at')
    .eq('project_id', id)
    .order('created_at', { ascending: false });

  const totalCost = (usage ?? []).reduce((a, b) => a + (b.cost_cents ?? 0), 0) / 100;
  const totalInput = (usage ?? []).reduce((a, b) => a + b.input_tokens, 0);
  const totalOutput = (usage ?? []).reduce((a, b) => a + b.output_tokens, 0);

  return (
    <div>
      <h2 style={{ margin: 0, fontSize: 18, color: 'var(--fg)', fontWeight: 600 }}>利用統計 & レポート</h2>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginTop: 16 }}>
        <div style={card}>
          <div style={cardLabel}>総消費コスト</div>
          <div style={cardVal}>${totalCost.toFixed(2)}</div>
        </div>
        <div style={card}>
          <div style={cardLabel}>送信トークン数</div>
          <div style={cardVal}>{totalInput.toLocaleString()}</div>
        </div>
        <div style={card}>
          <div style={cardLabel}>生成トークン数</div>
          <div style={cardVal}>{totalOutput.toLocaleString()}</div>
        </div>
      </div>

      <h3 style={{ margin: '32px 0 12px 0', fontSize: 15, color: 'var(--fg)', fontWeight: 600 }}>生成タスク別消費履歴</h3>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
            <th style={{ padding: 10 }}>日時</th>
            <th style={{ padding: 10 }}>タスク</th>
            <th style={{ padding: 10 }}>モデル</th>
            <th style={{ padding: 10, textAlign: 'right' }}>Input / Output</th>
            <th style={{ padding: 10, textAlign: 'right' }}>コスト</th>
          </tr>
        </thead>
        <tbody>
          {(usage ?? []).map((u, i) => (
            <tr key={i} style={{ borderBottom: '1px solid var(--border-light, #fafafa)' }}>
              <td style={{ padding: 10 }}>{new Date(u.created_at).toLocaleDateString()}</td>
              <td style={{ padding: 10 }}>{u.step}</td>
              <td style={{ padding: 10 }}>{u.model}</td>
              <td style={{ padding: 10, textAlign: 'right' }}>
                {u.input_tokens.toLocaleString()} / {u.output_tokens.toLocaleString()}
              </td>
              <td style={{ padding: 10, textAlign: 'right' }}>
                ${((u.cost_cents ?? 0) / 100).toFixed(4)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const card: React.CSSProperties = {
  border: '1px solid var(--border)',
  borderRadius: 10,
  padding: 16,
  background: 'var(--card-bg, transparent)',
};

const cardLabel: React.CSSProperties = {
  fontSize: 12,
  color: 'var(--muted)',
};

const cardVal: React.CSSProperties = {
  fontSize: 20,
  fontWeight: 600,
  color: 'var(--fg)',
  marginTop: 6,
};
