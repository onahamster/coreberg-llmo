'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Article {
  id: string;
  title: string;
  html: string | null;
  status: string;
  wp_post_url: string | null;
  schema_jsonb: unknown;
}

export function ArticleActions({ projectId, article }: { projectId: string; article: Article }) {
  const router = useRouter();
  const [publishing, setPublishing] = useState(false);

  const handleCopyHtml = () => {
    navigator.clipboard.writeText(article.html ?? '');
    alert('HTML をクリップボードにコピーしました');
  };

  const handleCopySchema = () => {
    navigator.clipboard.writeText(JSON.stringify(article.schema_jsonb, null, 2));
    alert('Schema JSON-LD をクリップボードにコピーしました');
  };

  const handlePublish = async () => {
    setPublishing(true);
    const res = await fetch(`/api/projects/${projectId}/publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ articleId: article.id }),
    });
    setPublishing(false);
    if (res.ok) {
      router.refresh();
    } else {
      alert('公開に失敗しました');
    }
  };

  return (
    <div
      style={{
        border: '1px solid var(--border)',
        borderRadius: 12,
        padding: 16,
        background: 'var(--card-bg, transparent)',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      <div style={{ fontSize: 13, color: 'var(--muted)' }}>
        ステータス:{' '}
        <strong style={{ color: 'var(--fg)' }}>
          {article.status === 'published' ? '公開済み' : '作成完了'}
        </strong>
      </div>

      <button onClick={handleCopyHtml} style={btnSecondary}>
        本文 HTML をコピー
      </button>

      {article.schema_jsonb && (
        <button onClick={handleCopySchema} style={btnSecondary}>
          Schema.org JSON をコピー
        </button>
      )}

      {article.status !== 'published' ? (
        <button onClick={handlePublish} disabled={publishing} style={btnPrimary}>
          {publishing ? '公開中...' : 'WordPress に公開'}
        </button>
      ) : (
        article.wp_post_url && (
          <a
            href={article.wp_post_url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              ...btnPrimary,
              display: 'block',
              textAlign: 'center',
              textDecoration: 'none',
            }}
          >
            WP 記事を開く
          </a>
        )
      )}
    </div>
  );
}

const btnPrimary: React.CSSProperties = {
  width: '100%',
  padding: '10px 14px',
  background: 'var(--primary, #0a0a0a)',
  color: 'var(--primary-fg, #ffffff)',
  border: 'none',
  borderRadius: 8,
  fontSize: 13,
  fontWeight: 500,
  cursor: 'pointer',
};

const btnSecondary: React.CSSProperties = {
  width: '100%',
  padding: '10px 14px',
  background: 'transparent',
  color: 'var(--fg)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  fontSize: 13,
  fontWeight: 500,
  cursor: 'pointer',
};
