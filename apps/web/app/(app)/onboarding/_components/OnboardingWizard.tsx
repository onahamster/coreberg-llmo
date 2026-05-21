'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface FormState {
  name: string;
  siteUrl: string;
  targetAudience: string;
  targetLocale: 'ja' | 'en';
  monthlyArticleCount: number;
  wpEndpoint: string;
  wpUsername: string;
  wpAppPassword: string;
}

const STEPS = [
  { key: 'site', label: 'サイト情報' },
  { key: 'audience', label: 'ターゲット' },
  { key: 'volume', label: '生成本数' },
  { key: 'wordpress', label: 'WordPress 連携' },
  { key: 'confirm', label: '確認' },
] as const;

export function OnboardingWizard() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>({
    name: '',
    siteUrl: '',
    targetAudience: '',
    targetLocale: 'ja',
    monthlyArticleCount: 30,
    wpEndpoint: '',
    wpUsername: '',
    wpAppPassword: '',
  });

  const update = (patch: Partial<FormState>) => setForm((f) => ({ ...f, ...patch }));

  const submit = async () => {
    setSubmitting(true);
    setErr(null);
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(j.error ?? 'プロジェクト作成に失敗しました');
      }
      const j = (await res.json()) as { projectId: string };
      router.push(`/projects/${j.projectId}`);
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setSubmitting(false);
    }
  };

  return (
    <div style={{ marginTop: 24 }}>
      <Stepper current={step} />

      <div
        style={{
          marginTop: 24,
          border: '1px solid var(--border)',
          borderRadius: 12,
          padding: 24,
          background: 'var(--card-bg, transparent)',
        }}
      >
        {step === 0 && (
          <Section title="サイト情報">
            <Field label="プロジェクト名">
              <input
                value={form.name}
                onChange={(e) => update({ name: e.target.value })}
                placeholder="例: 株式会社サンプル LLMO"
                style={inputStyle}
              />
            </Field>
            <Field label="サイト URL">
              <input
                value={form.siteUrl}
                onChange={(e) => update({ siteUrl: e.target.value })}
                placeholder="https://example.com"
                style={inputStyle}
              />
            </Field>
          </Section>
        )}

        {step === 1 && (
          <Section title="ターゲット読者">
            <Field label="ターゲット読者（任意・空でも可）">
              <textarea
                value={form.targetAudience}
                onChange={(e) => update({ targetAudience: e.target.value })}
                placeholder="例: SaaS の購買決定権を持つマーケティング責任者"
                rows={3}
                style={{ ...inputStyle, resize: 'vertical' }}
              />
            </Field>
            <Field label="言語">
              <select
                value={form.targetLocale}
                onChange={(e) => update({ targetLocale: e.target.value as 'ja' | 'en' })}
                style={inputStyle}
              >
                <option value="ja">日本語</option>
                <option value="en">English</option>
              </select>
            </Field>
          </Section>
        )}

        {step === 2 && (
          <Section title="月次生成本数">
            <Field label="月次本数">
              <input
                type="number"
                min={1}
                max={100}
                value={form.monthlyArticleCount}
                onChange={(e) => update({ monthlyArticleCount: Number(e.target.value) })}
                style={inputStyle}
              />
              <p style={{ color: 'var(--muted)', fontSize: 12, marginTop: 8 }}>
                Basic プランの標準は 30 本/月です。
              </p>
            </Field>
          </Section>
        )}

        {step === 3 && (
          <Section title="WordPress 連携（後で設定可）">
            <Field label="REST エンドポイント URL">
              <input
                value={form.wpEndpoint}
                onChange={(e) => update({ wpEndpoint: e.target.value })}
                placeholder="https://example.com/wp-json"
                style={inputStyle}
              />
            </Field>
            <Field label="ユーザー名">
              <input
                value={form.wpUsername}
                onChange={(e) => update({ wpUsername: e.target.value })}
                placeholder="admin"
                style={inputStyle}
              />
            </Field>
            <Field label="Application Password">
              <input
                type="password"
                value={form.wpAppPassword}
                onChange={(e) => update({ wpAppPassword: e.target.value })}
                placeholder="xxxx xxxx xxxx xxxx xxxx xxxx"
                style={inputStyle}
              />
              <p style={{ color: 'var(--muted)', fontSize: 12, marginTop: 8 }}>
                未入力の場合は記事のプレビューと HTML ココピーのみ可能です。
              </p>
            </Field>
          </Section>
        )}

        {step === 4 && (
          <Section title="内容を確認">
            <Summary form={form} />
            {err && (
              <div
                style={{
                  marginTop: 12,
                  padding: 12,
                  background: '#fef2f2',
                  color: 'var(--error)',
                  borderRadius: 8,
                  fontSize: 13,
                }}
              >
                {err}
              </div>
            )}
          </Section>
        )}

        <div style={{ marginTop: 24, display: 'flex', justifyContent: 'space-between' }}>
          <button
            type="button"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0 || submitting}
            style={btnSecondary}
          >
            戻る
          </button>
          {step < STEPS.length - 1 ? (
            <button
              type="button"
              onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}
              disabled={!canProceed(step, form)}
              style={btnPrimary}
            >
              次へ
            </button>
          ) : (
            <button type="button" onClick={submit} disabled={submitting} style={btnPrimary}>
              {submitting ? '作成中...' : 'プロジェクトを作成'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function canProceed(step: number, f: FormState): boolean {
  switch (step) {
    case 0:
      return f.name.trim().length > 0 && /^https?:\/\//.test(f.siteUrl);
    case 1:
      return true;
    case 2:
      return f.monthlyArticleCount >= 1 && f.monthlyArticleCount <= 100;
    case 3:
      return true;
    default:
      return true;
  }
}

function Stepper({ current }: { current: number }) {
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      {STEPS.map((s, i) => (
        <div
          key={s.key}
          style={{
            flex: 1,
            padding: '8px 12px',
            borderRadius: 8,
            background: i <= current ? 'var(--primary, #0a0a0a)' : 'var(--accent, #f4f4f5)',
            color: i <= current ? 'var(--primary-fg, #ffffff)' : 'var(--muted, #71717a)',
            fontSize: 12,
            fontWeight: 500,
            textAlign: 'center',
          }}
        >
          {i + 1}. {s.label}
        </div>
      ))}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 style={{ margin: 0, fontSize: 18, color: 'var(--fg)' }}>{title}</h2>
      <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
        {children}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>
        {label}
      </label>
      {children}
    </div>
  );
}

function Summary({ form }: { form: FormState }) {
  return (
    <dl style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: 8, fontSize: 14 }}>
      <dt style={{ color: 'var(--muted)' }}>プロジェクト名</dt>
      <dd style={{ color: 'var(--fg)' }}>{form.name}</dd>
      <dt style={{ color: 'var(--muted)' }}>サイト URL</dt>
      <dd style={{ color: 'var(--fg)' }}>{form.siteUrl}</dd>
      <dt style={{ color: 'var(--muted)' }}>ターゲット</dt>
      <dd style={{ color: 'var(--fg)' }}>{form.targetAudience || '（未指定）'}</dd>
      <dt style={{ color: 'var(--muted)' }}>言語</dt>
      <dd style={{ color: 'var(--fg)' }}>{form.targetLocale === 'ja' ? '日本語' : 'English'}</dd>
      <dt style={{ color: 'var(--muted)' }}>月次本数</dt>
      <dd style={{ color: 'var(--fg)' }}>{form.monthlyArticleCount} 本/月</dd>
      <dt style={{ color: 'var(--muted)' }}>WP 連携</dt>
      <dd style={{ color: 'var(--fg)' }}>{form.wpEndpoint ? '設定済み' : '未設定（後から可）'}</dd>
    </dl>
  );
}

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
};

const btnSecondary: React.CSSProperties = {
  padding: '10px 18px',
  background: 'transparent',
  color: 'var(--fg, #0a0a0a)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  fontSize: 14,
  cursor: 'pointer',
};
