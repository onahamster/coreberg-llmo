import type { ReactNode } from 'react';
import Link from 'next/link';
import { requireCustomer } from '@/lib/auth/customer-guard';
import { createServerSupabase } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';

export default async function ProjectLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ id: string }>;
}) {
  await requireCustomer();
  const { id } = await params;
  const supabase = await createServerSupabase();
  const { data: project } = await supabase
    .from('projects')
    .select('id,name,site_url,status')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();

  if (!project) notFound();

  const tabs = [
    { href: `/projects/${id}`, label: 'ダッシュボード' },
    { href: `/projects/${id}/keywords`, label: 'キーワード' },
    { href: `/projects/${id}/articles`, label: '記事' },
    { href: `/projects/${id}/monitoring`, label: '引用モニタリング' },
    { href: `/projects/${id}/distribution`, label: '配信状況' },
    { href: `/projects/${id}/reports`, label: 'レポート' },
    { href: `/projects/${id}/settings`, label: '設定' },
  ];

  return (
    <div style={{ maxWidth: 1200, margin: '24px auto', padding: '0 20px' }}>
      <div style={{ borderBottom: '1px solid var(--border)', paddingBottom: 16 }}>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 600, color: 'var(--fg)' }}>{project.name}</h1>
        <a href={project.site_url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--muted)', fontSize: 13, textDecoration: 'none' }}>
          {project.site_url}
        </a>
      </div>
      <nav style={{ display: 'flex', gap: 8, marginTop: 16, borderBottom: '1px solid var(--border)' }}>
        {tabs.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            style={{
              padding: '10px 16px',
              fontSize: 13,
              color: 'var(--fg)',
              textDecoration: 'none',
              borderBottom: '2px solid transparent',
              fontWeight: 500,
            }}
          >
            {t.label}
          </Link>
        ))}
      </nav>
      <div style={{ marginTop: 24 }}>{children}</div>
    </div>
  );
}
