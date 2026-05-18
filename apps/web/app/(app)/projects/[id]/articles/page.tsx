import Link from 'next/link';
import { requireCustomer } from '@/lib/auth/customer-guard';
import { createServerSupabase } from '@/lib/supabase/server';

const STATUS_COLOR: Record<string, string> = {
  pending: '#9ca3af',
  drafting: '#3b82f6',
  checking: '#3b82f6',
  fact_checking: '#3b82f6',
  finalizing: '#3b82f6',
  completed: '#10b981',
  published: '#0a0a0a',
  failed: '#dc2626',
};

const STATUS_LABEL: Record<string, string> = {
  pending: '待機',
  drafting: '本文生成中',
  checking: '構成チェック',
  fact_checking: '事実検証',
  finalizing: '仕上げ',
  completed: '完成',
  published: '公開済',
  failed: '失敗',
};

export default async function ArticlesPage({ params }: { params: Promise<{ id: string }> }) {
  await requireCustomer();
  const { id } = await params;
  const supabase = await createServerSupabase();

  const { data: articles } = await supabase
    .from('articles')
    .select('id,title,status,word_count,image_url,published_at,created_at')
    .eq('project_id', id)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  return (
    <div>
      <h2 style={{ margin: 0, fontSize: 18, color: 'var(--fg)', fontWeight: 600 }}>記事一覧 ({articles?.length ?? 0} 本)</h2>
      <div
        style={{
          marginTop: 16,
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
          gap: 16,
        }}
      >
        {(articles ?? []).map((a) => (
          <Link
            key={a.id}
            href={`/projects/${id}/articles/${a.id}`}
            style={{
              border: '1px solid var(--border)',
              borderRadius: 10,
              overflow: 'hidden',
              display: 'block',
              textDecoration: 'none',
              background: 'var(--card-bg, transparent)',
            }}
          >
            <div
              style={{
                aspectRatio: '16 / 9',
                background: a.image_url ? `url(${a.image_url}) center/cover` : 'var(--accent)',
              }}
            />
            <div style={{ padding: 14 }}>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 500,
                  color: 'var(--fg)',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}
              >
                {a.title}
              </div>
              <div
                style={{
                  marginTop: 8,
                  display: 'flex',
                  gap: 8,
                  alignItems: 'center',
                  fontSize: 11,
                  color: 'var(--muted)',
                }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: STATUS_COLOR[a.status] ?? '#9ca3af',
                  }}
                />
                <span>{STATUS_LABEL[a.status] ?? a.status}</span>
                {a.word_count && <span>· {a.word_count} 字</span>}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
