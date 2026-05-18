'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { RingChart } from '@/components/charts/RingChart';

interface LatestRun {
  id: string;
  status: string;
  current_step: string | null;
  started_at: string | null;
  finished_at: string | null;
  month: string;
}

interface Props {
  projectId: string;
  latestRun: LatestRun | null;
  statusCounts: Record<string, number>;
  citationCount: number;
  enginesCovered: number;
  audit: Record<string, unknown> | null;
  monthlyArticleCount: number;
}

const STATUS_LABELS: Record<string, string> = {
  pending: '待機',
  drafting: '本文生成中',
  checking: '構成チェック中',
  fact_checking: '事実検証中',
  finalizing: 'HTML 変換中',
  completed: '完成',
  failed: '失敗',
  published: '公開済み',
};

export function ProjectDashboard({
  projectId,
  latestRun,
  statusCounts: initialStatusCounts,
  citationCount,
  enginesCovered,
  audit,
  monthlyArticleCount,
}: Props) {
  const supabase = createClient();
  const router = useRouter();
  const [run, setRun] = useState(latestRun);
  const [statusCounts, setStatusCounts] = useState(initialStatusCounts);
  const [starting, setStarting] = useState(false);

  // Realtime: generation_runs / articles を購読
  useEffect(() => {
    const ch1 = supabase
      .channel(`run-${projectId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'generation_runs', filter: `project_id=eq.${projectId}` },
        (payload) => {
          if (payload.new) setRun(payload.new as LatestRun);
        },
      )
      .subscribe();

    const ch2 = supabase
      .channel(`articles-${projectId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'articles', filter: `project_id=eq.${projectId}` },
        () => router.refresh(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ch1);
      supabase.removeChannel(ch2);
    };
  }, [projectId, supabase, router]);

  const completed = (statusCounts.completed ?? 0) + (statusCounts.published ?? 0);
  const progress = monthlyArticleCount === 0 ? 0 : (completed / monthlyArticleCount) * 100;

  const handleStart = async () => {
    setStarting(true);
    const res = await fetch(`/api/projects/${projectId}/generate`, { method: 'POST' });
    setStarting(false);
    if (res.ok) router.refresh();
    else alert('開始に失敗しました');
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
      <Card title="Citation Score" subtitle="直近 30 日の引用獲得数">
        <RingChart value={citationCount} max={Math.max(citationCount, 10)} label={`${citationCount} 件`} color="#10b981" />
        <p style={{ marginTop: 12, color: 'var(--muted)', fontSize: 12 }}>
          引用エンジン数: <strong style={{ color: 'var(--fg)' }}>{enginesCovered} / 4</strong>
        </p>
      </Card>

      <Card title="今月の進捗" subtitle={`${completed} / ${monthlyArticleCount} 本完成`}>
        <RingChart value={progress} max={100} label={`${Math.round(progress)}%`} color="#3b82f6" />
        {run && run.status === 'running' && (
          <p style={{ marginTop: 12, color: 'var(--muted)', fontSize: 12 }}>
            実行中: {run.current_step ?? '...'}
          </p>
        )}
        {!run && (
          <button
            type="button"
            onClick={handleStart}
            disabled={starting}
            style={{
              marginTop: 12,
              width: '100%',
              padding: '10px 14px',
              background: 'var(--primary)',
              color: 'var(--primary-fg)',
              border: 'none',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            {starting ? '起動中...' : '生成を開始'}
          </button>
        )}
      </Card>

      <Card title="記事ステータス" subtitle="全期間">
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, width: '100%' }}>
          {Object.entries(STATUS_LABELS).map(([k, v]) => (
            <li
              key={k}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: 13,
                padding: '4px 0',
                borderBottom: '1px solid var(--border-light, #fafafa)',
              }}
            >
              <span style={{ color: 'var(--muted)' }}>{v}</span>
              <strong style={{ color: 'var(--fg)' }}>{statusCounts[k] ?? 0}</strong>
            </li>
          ))}
        </ul>
      </Card>

      {audit && (
        <Card title="前提監査" subtitle="初回のみ実行">
          <AuditView audit={audit} />
        </Card>
      )}
    </div>
  );
}

function Card({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        border: '1px solid var(--border)',
        borderRadius: 12,
        padding: 20,
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--card-bg, transparent)',
      }}
    >
      <div>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--fg)' }}>{title}</div>
        {subtitle && (
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{subtitle}</div>
        )}
      </div>
      <div
        style={{
          marginTop: 16,
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          width: '100%',
        }}
      >
        {children}
      </div>
    </div>
  );
}

function AuditView({ audit }: { audit: Record<string, unknown> }) {
  const robots = (audit.robots as { bots?: { bot: string; allowed: boolean }[] } | undefined)?.bots ?? [];
  const llms = audit.llms_txt as { exists?: boolean } | undefined;
  return (
    <div style={{ width: '100%', fontSize: 12, color: 'var(--muted)' }}>
      <div style={{ marginBottom: 8 }}>
        AI クローラー許可:{' '}
        <strong style={{ color: 'var(--fg)' }}>
          {robots.filter((r) => r.allowed).length} / {robots.length}
        </strong>
      </div>
      <div style={{ marginBottom: 8 }}>
        llms.txt: <strong style={{ color: 'var(--fg)' }}>{llms?.exists ? '有り' : '無し（後で自動配置）'}</strong>
      </div>
    </div>
  );
}
