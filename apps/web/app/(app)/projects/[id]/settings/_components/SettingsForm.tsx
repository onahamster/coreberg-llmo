'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Project {
  id: string;
  name: string;
  site_url: string;
  target_audience: string | null;
  target_locale: 'ja' | 'en';
  monthly_article_count: number;
  wp_endpoint: string | null;
  wp_username: string | null;
}

export function SettingsForm({ project }: { project: Project }) {
  const router = useRouter();
  const [form, setForm] = useState(project);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const res = await fetch(`/api/projects/${project.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    setSubmitting(false);
    if (res.ok) {
      alert('保存しました');
      router.refresh();
    } else {
      alert('保存に失敗しました');
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <label style={labelStyle}>プロジェクト名</label>
        <input
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          style={inputStyle}
          required
        />
      </div>

      <div>
        <label style={labelStyle}>サイト URL</label>
        <input
          value={form.site_url}
          onChange={(e) => setForm({ ...form, site_url: e.target.value })}
          style={inputStyle}
          required
          disabled
        />
      </div>

      <div>
        <label style={labelStyle}>ターゲット読者</label>
        <textarea
          value={form.target_audience ?? ''}
          onChange={(e) => setForm({ ...form, target_audience: e.target.value })}
          style={{ ...inputStyle, resize: 'vertical' }}
          rows={3}
        />
      </div>

      <div>
        <label style={labelStyle}>言語</label>
        <select
          value={form.target_locale}
          onChange={(e) => setForm({ ...form, target_locale: e.target.value as 'ja' | 'en' })}
          style={inputStyle}
        >
          <option value="ja">日本語</option>
          <option value="en">English</option>
        </select>
      </div>

      <div>
        <label style={labelStyle}>月次生成本数</label>
        <input
          type="number"
          min={1}
          max={100}
          value={form.monthly_article_count}
          onChange={(e) => setForm({ ...form, monthly_article_count: Number(e.target.value) })}
          style={inputStyle}
          required
        />
      </div>

      <div>
        <label style={labelStyle}>WordPress REST エンドポイント</label>
        <input
          value={form.wp_endpoint ?? ''}
          onChange={(e) => setForm({ ...form, wp_endpoint: e.target.value })}
          style={inputStyle}
        />
      </div>

      <div>
        <label style={labelStyle}>WordPress ユーザー名</label>
        <input
          value={form.wp_username ?? ''}
          onChange={(e) => setForm({ ...form, wp_username: e.target.value })}
          style={inputStyle}
        />
      </div>

      <button type="submit" disabled={submitting} style={btnPrimary}>
        {submitting ? '保存中...' : '変更を保存'}
      </button>
    </form>
  );
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 12,
  color: 'var(--muted)',
  marginBottom: 4,
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  border: '1px solid var(--border)',
  borderRadius: 8,
  fontSize: 14,
  fontFamily: 'inherit',
  background: 'var(--input-bg, transparent)',
  color: 'var(--fg)',
};

const btnPrimary: React.CSSProperties = {
  padding: '10px 18px',
  background: 'var(--primary, #0a0a0a)',
  color: 'var(--primary-fg, #ffffff)',
  border: 'none',
  borderRadius: 8,
  fontSize: 14,
  fontWeight: 500,
  cursor: 'pointer',
  marginTop: 12,
  alignSelf: 'flex-start',
};
