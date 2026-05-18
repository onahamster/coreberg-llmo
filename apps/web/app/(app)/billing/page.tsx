import { requireCustomer } from '@/lib/auth/customer-guard';
import { createServerSupabase } from '@/lib/supabase/server';

export default async function BillingPage() {
  const { userId } = await requireCustomer();
  const supabase = await createServerSupabase();

  const { data: customer } = await supabase
    .from('stripe_customers')
    .select('stripe_customer_id,subscription_status,plan_id')
    .eq('user_id', userId)
    .maybeSingle();

  return (
    <div style={{ maxWidth: 800, margin: '40px auto', padding: '0 20px' }}>
      <h1 style={{ fontSize: 28, fontWeight: 600, margin: 0, color: 'var(--fg)' }}>お支払い & プラン管理</h1>
      <p style={{ color: 'var(--muted)', marginTop: 8 }}>現在のサブスクリプションとプラン情報を管理します。</p>

      <div
        style={{
          marginTop: 24,
          border: '1px solid var(--border)',
          borderRadius: 12,
          padding: 24,
          background: 'var(--card-bg, transparent)',
        }}
      >
        <h2 style={{ fontSize: 18, margin: 0 }}>現在のプラン</h2>
        <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: '150px 1fr', gap: 8, fontSize: 14 }}>
          <span style={{ color: 'var(--muted)' }}>ステータス:</span>
          <strong>
            {customer?.subscription_status === 'active' ? '有効（サブスクリプション契約中）' : '未契約（無料試用）'}
          </strong>
          <span style={{ color: 'var(--muted)' }}>プランID:</span>
          <strong>{customer?.plan_id ?? 'Basic Free'}</strong>
        </div>
      </div>

      <div style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: 18, margin: 0 }}>プラン一覧</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 16 }}>
          <div style={planCard}>
            <h3>Basic Plan</h3>
            <div style={{ fontSize: 24, fontWeight: 600, marginTop: 8 }}>¥49,800 <span style={{ fontSize: 12, fontWeight: 400 }}>/ 月</span></div>
            <ul style={{ marginTop: 16, fontSize: 13, color: 'var(--muted)', paddingLeft: 20 }}>
              <li>月間最大 30 記事の全自動生成</li>
              <li>競合インサイト分析</li>
              <li>WordPress 自動連携</li>
              <li>IndexNow / llms.txt 自動更新</li>
            </ul>
          </div>
          <div style={planCard}>
            <h3>Enterprise Plan</h3>
            <div style={{ fontSize: 24, fontWeight: 600, marginTop: 8 }}>個別お見積もり</div>
            <ul style={{ marginTop: 16, fontSize: 13, color: 'var(--muted)', paddingLeft: 20 }}>
              <li>複数サイトの統合管理</li>
              <li>記事本数カスタム（100本以上〜）</li>
              <li>専用プロンプトの個別チューニング</li>
              <li>Slack 等外部アラート通知</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

const planCard: React.CSSProperties = {
  border: '1px solid var(--border)',
  borderRadius: 12,
  padding: 20,
  background: 'var(--card-bg, transparent)',
};
