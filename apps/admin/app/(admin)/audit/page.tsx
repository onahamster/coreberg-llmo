import { requireAdmin } from '@/lib/auth/admin-guard';
import { createServerSupabase } from '@/lib/supabase/server';

export default async function AuditPage() {
  await requireAdmin();
  const supabase = await createServerSupabase();

  const { data: logs } = await supabase
    .from('audit_logs')
    .select('id,actor_id,actor_role,action,resource_type,resource_id,metadata,actor_ip,created_at')
    .order('created_at', { ascending: false })
    .limit(100);

  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ fontSize: 24, fontWeight: 600, margin: 0, color: 'var(--fg)' }}>監査ログ (Audit Trail)</h1>
      <p style={{ color: 'var(--muted)', marginTop: 8 }}>
        システム全体のセキュリティイベントと管理者・サポートの操作履歴を表示します。
      </p>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginTop: 24 }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
            <th style={{ padding: 10 }}>日時</th>
            <th style={{ padding: 10 }}>操作者</th>
            <th style={{ padding: 10 }}>ロール</th>
            <th style={{ padding: 10 }}>アクション</th>
            <th style={{ padding: 10 }}>リソース型</th>
            <th style={{ padding: 10 }}>IP</th>
            <th style={{ padding: 10 }}>メタデータ</th>
          </tr>
        </thead>
        <tbody>
          {(logs ?? []).map((l) => (
            <tr key={l.id} style={{ borderBottom: '1px solid var(--border-light, #fafafa)' }}>
              <td style={{ padding: 10 }}>{new Date(l.created_at).toLocaleString()}</td>
              <td style={{ padding: 10, fontFamily: 'monospace', fontSize: 11 }}>{l.actor_id}</td>
              <td style={{ padding: 10 }}>{l.actor_role}</td>
              <td style={{ padding: 10 }}>
                <strong style={{ color: 'var(--fg)' }}>{l.action}</strong>
              </td>
              <td style={{ padding: 10 }}>{l.resource_type}</td>
              <td style={{ padding: 10 }}>{l.actor_ip ?? '-'}</td>
              <td style={{ padding: 10 }}>
                <pre style={{ margin: 0, fontSize: 11, background: 'var(--accent)', padding: 6, borderRadius: 4 }}>
                  {JSON.stringify(l.metadata)}
                </pre>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
