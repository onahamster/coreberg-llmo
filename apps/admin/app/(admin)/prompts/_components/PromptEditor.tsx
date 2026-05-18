'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Prompt {
  id: string;
  key: string;
  version: number;
  system_prompt: string;
  user_prompt_template: string;
  is_active: boolean;
  created_at: string;
}

export function PromptEditor({ initialPrompts }: { initialPrompts: Prompt[] }) {
  const router = useRouter();
  const [selectedKey, setSelectedKey] = useState<string>(initialPrompts[0]?.key ?? '');
  const [editing, setEditing] = useState<Prompt | null>(null);
  const [saving, setSaving] = useState(false);

  const promptsForKey = initialPrompts.filter((p) => p.key === selectedKey);
  const activePrompt = promptsForKey.find((p) => p.is_active) ?? promptsForKey[0];

  const handleEdit = (p: Prompt) => {
    setEditing({ ...p });
  };

  const handleCreateNewVersion = () => {
    if (!activePrompt) return;
    setEditing({
      id: '',
      key: activePrompt.key,
      version: activePrompt.version + 1,
      system_prompt: activePrompt.system_prompt,
      user_prompt_template: activePrompt.user_prompt_template,
      is_active: true,
      created_at: new Date().toISOString(),
    });
  };

  const handleSave = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      const res = await fetch('/api/prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editing),
      });
      if (!res.ok) throw new Error('保存に失敗しました');
      setEditing(null);
      router.refresh();
    } catch (e) {
      alert(String(e));
    } finally {
      setSaving(false);
    }
  };

  const uniqueKeys = Array.from(new Set(initialPrompts.map((p) => p.key)));

  return (
    <div style={{ marginTop: 24, display: 'flex', gap: 24 }}>
      <aside style={{ width: 240, borderRight: '1px solid var(--border)', paddingRight: 16 }}>
        <h3 style={{ fontSize: 13, color: 'var(--muted)', margin: '0 0 8px 0' }}>パイプラインキー</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {uniqueKeys.map((key) => (
            <button
              key={key}
              onClick={() => {
                setSelectedKey(key);
                setEditing(null);
              }}
              style={{
                textAlign: 'left',
                padding: '8px 12px',
                border: 'none',
                borderRadius: 6,
                background: key === selectedKey ? 'var(--accent)' : 'transparent',
                color: 'var(--fg)',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: key === selectedKey ? 550 : 400,
              }}
            >
              {key}
            </button>
          ))}
        </div>
      </aside>

      <main style={{ flex: 1 }}>
        {editing ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: 16, margin: 0 }}>
                {editing.key} (v{editing.version} 作成)
              </h2>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setEditing(null)} style={btnSecondary}>
                  キャンセル
                </button>
                <button onClick={handleSave} disabled={saving} style={btnPrimary}>
                  {saving ? '保存中...' : '確定保存 & 有効化'}
                </button>
              </div>
            </div>

            <div>
              <label style={labelStyle}>System Prompt</label>
              <textarea
                value={editing.system_prompt}
                onChange={(e) => setEditing({ ...editing, system_prompt: e.target.value })}
                style={{ ...inputStyle, resize: 'vertical' }}
                rows={8}
              />
            </div>

            <div>
              <label style={labelStyle}>User Prompt Template</label>
              <textarea
                value={editing.user_prompt_template}
                onChange={(e) => setEditing({ ...editing, user_prompt_template: e.target.value })}
                style={{ ...inputStyle, resize: 'vertical' }}
                rows={8}
              />
            </div>
          </div>
        ) : (
          activePrompt && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 style={{ fontSize: 18, margin: 0, color: 'var(--fg)' }}>
                  {activePrompt.key}{' '}
                  <span
                    style={{
                      fontSize: 12,
                      background: 'var(--accent)',
                      padding: '2px 6px',
                      borderRadius: 4,
                      marginLeft: 8,
                    }}
                  >
                    v{activePrompt.version} Active
                  </span>
                </h2>
                <button onClick={handleCreateNewVersion} style={btnPrimary}>
                  新バージョンを追加
                </button>
              </div>

              <div style={{ marginTop: 24 }}>
                <h3 style={{ fontSize: 13, color: 'var(--muted)', margin: '0 0 6px 0' }}>System Prompt</h3>
                <pre style={preStyle}>{activePrompt.system_prompt}</pre>

                <h3 style={{ fontSize: 13, color: 'var(--muted)', margin: '24px 0 6px 0' }}>
                  User Prompt Template
                </h3>
                <pre style={preStyle}>{activePrompt.user_prompt_template}</pre>
              </div>

              <div style={{ marginTop: 32 }}>
                <h3 style={{ fontSize: 13, color: 'var(--muted)', margin: '0 0 12px 0' }}>バージョン履歴</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {promptsForKey.map((p) => (
                    <div
                      key={p.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        border: '1px solid var(--border)',
                        padding: '10px 16px',
                        borderRadius: 8,
                        fontSize: 13,
                      }}
                    >
                      <span>
                        Version {p.version} · {p.is_active ? 'Active' : 'Archived'} ·{' '}
                        {new Date(p.created_at).toLocaleDateString()}
                      </span>
                      <button onClick={() => handleEdit(p)} style={btnSecondary}>
                        編集
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )
        )}
      </main>
    </div>
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
  padding: '8px 14px',
  background: 'var(--primary, #0a0a0a)',
  color: 'var(--primary-fg, #ffffff)',
  border: 'none',
  borderRadius: 8,
  fontSize: 13,
  fontWeight: 550,
  cursor: 'pointer',
};

const btnSecondary: React.CSSProperties = {
  padding: '8px 14px',
  background: 'transparent',
  color: 'var(--fg)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  fontSize: 13,
  fontWeight: 550,
  cursor: 'pointer',
};

const preStyle: React.CSSProperties = {
  background: 'var(--accent, #f4f4f5)',
  padding: 16,
  borderRadius: 8,
  fontSize: 12,
  overflowX: 'auto',
  color: 'var(--fg)',
  fontFamily: 'monospace',
  whiteSpace: 'pre-wrap',
};
