"use client";

import { useState, useTransition } from "react";

interface Flag {
  key: string; 
  description: string | null; 
  enabled: boolean; 
  rollout_percent: number;
  allowed_user_ids: string[]; 
  allowed_plans: string[];
}

export function FlagRow({ flag }: { flag: Flag }) {
  const [enabled, setEnabled] = useState(flag.enabled);
  const [rollout, setRollout] = useState(flag.rollout_percent);
  const [pending, start] = useTransition();
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const save = (patch: Partial<Flag>) =>
    start(async () => {
      const res = await fetch(`/api/flags/${flag.key}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (res.ok) {
        setSavedAt(new Date().toLocaleTimeString("ja-JP"));
      }
    });

  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 hover:bg-zinc-800/10 transition-colors">
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-sm font-bold text-white">{flag.key}</span>
          {flag.allowed_plans && flag.allowed_plans.length > 0 && (
            <span className="rounded bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 text-[10px] font-semibold text-blue-400">
              対象プラン: {flag.allowed_plans.join(", ")}
            </span>
          )}
          {flag.allowed_user_ids && flag.allowed_user_ids.length > 0 && (
            <span className="rounded bg-violet-500/10 border border-violet-500/20 px-2 py-0.5 text-[10px] font-semibold text-violet-400">
              ユーザー許可リスト: {flag.allowed_user_ids.length}名
            </span>
          )}
        </div>
        {flag.description && <div className="text-xs text-zinc-400">{flag.description}</div>}
      </div>

      <div className="flex flex-wrap items-center gap-6">
        <div className="flex items-center gap-3">
          <input
            type="range" 
            min={0} 
            max={100} 
            value={rollout}
            onChange={(e) => setRollout(Number(e.target.value))}
            onMouseUp={() => save({ rollout_percent: rollout })}
            className="w-32 accent-violet-500 cursor-pointer"
          />
          <span className="w-10 text-right text-xs font-semibold font-mono text-zinc-400">{rollout}%</span>
        </div>

        <label className="flex cursor-pointer items-center gap-3 bg-zinc-950/60 rounded-xl px-4 py-2 border border-zinc-800 transition-colors hover:border-zinc-700">
          <input
            type="checkbox" 
            checked={enabled}
            onChange={(e) => { 
              setEnabled(e.target.checked); 
              save({ enabled: e.target.checked }); 
            }}
            className="h-4 w-4 accent-emerald-500 cursor-pointer"
          />
          <span className="text-xs font-semibold uppercase text-zinc-300">{enabled ? "ON" : "OFF"}</span>
        </label>

        <div className="w-24 text-right text-xs font-mono text-zinc-500">
          {pending ? (
            <span className="text-violet-400">保存中…</span>
          ) : savedAt ? (
            <span className="text-emerald-400">保存 {savedAt}</span>
          ) : (
            ""
          )}
        </div>
      </div>
    </div>
  );
}
