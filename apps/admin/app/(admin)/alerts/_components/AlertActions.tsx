"use client";

import { useTransition } from "react";

export function AlertActions({ id, status }: { id: string; status: string }) {
  const [pending, start] = useTransition();

  const act = (action: "ack" | "resolve") =>
    start(async () => {
      const res = await fetch(`/api/alerts/${id}/${action}`, { method: "POST" });
      if (res.ok) {
        window.location.reload();
      }
    });

  return (
    <div className="flex gap-2">
      {status === "open" && (
        <button 
          onClick={() => act("ack")} 
          disabled={pending}
          className="rounded-xl border border-zinc-800 bg-zinc-900/60 px-3 py-1.5 text-xs font-semibold text-zinc-300 transition-colors hover:bg-zinc-800 hover:border-zinc-700 disabled:opacity-50"
        >
          確認する
        </button>
      )}
      <button 
        onClick={() => act("resolve")} 
        disabled={pending}
        className="rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-3 py-1.5 text-xs font-bold text-white transition-all hover:scale-[1.02] active:scale-[0.98] hover:shadow-lg hover:shadow-emerald-500/10 disabled:opacity-50"
      >
        解決済みにする
      </button>
    </div>
  );
}
