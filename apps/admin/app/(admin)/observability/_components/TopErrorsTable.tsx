import { getServerClient } from "@/lib/supabase/server";

export async function TopErrorsTable() {
  const sb = getServerClient();
  const since = new Date(Date.now() - 24 * 3600_000).toISOString();

  const { data } = await sb
    .from("app_logs")
    .select("event, error_class, message, ts")
    .in("level", ["error", "fatal"])
    .gte("ts", since)
    .order("ts", { ascending: false })
    .limit(200);

  const grouped = new Map<string, { count: number; lastMessage: string; lastTs: string; event: string; errorClass: string }>();
  
  for (const r of data ?? []) {
    const k = `${r.event}::${r.error_class ?? "UnknownError"}`;
    const e = grouped.get(k) ?? { count: 0, lastMessage: "", lastTs: r.ts, event: r.event, errorClass: r.error_class ?? "UnknownError" };
    e.count += 1;
    e.lastMessage = r.message ?? e.lastMessage;
    if (new Date(r.ts) > new Date(e.lastTs)) {
      e.lastTs = r.ts;
    }
    grouped.set(k, e);
  }

  const rows = [...grouped.values()].sort((a, b) => b.count - a.count).slice(0, 10);

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 backdrop-blur-md">
      <h2 className="text-lg font-semibold text-white mb-4">直近 24 時間のエラー上位</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-zinc-300">
          <thead className="text-zinc-500 border-b border-zinc-800">
            <tr>
              <th className="pb-3 text-left font-medium">例外カテゴリ / イベント</th>
              <th className="pb-3 text-right font-medium">発生件数</th>
              <th className="pb-3 text-left font-medium pl-6">直近のエラーメッセージ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/50">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={3} className="py-6 text-center text-zinc-500">
                  現在報告されている致命的な例外はありません 🎉
                </td>
              </tr>
            ) : (
              rows.map((r, i) => (
                <tr key={i} className="hover:bg-zinc-800/20 transition-colors">
                  <td className="py-3 font-mono text-xs">
                    <div className="text-red-400 font-semibold">{r.errorClass}</div>
                    <div className="text-zinc-500 text-[10px]">{r.event}</div>
                  </td>
                  <td className="py-3 text-right tabular-nums font-bold text-white">{r.count}</td>
                  <td className="py-3 text-xs text-zinc-400 pl-6 max-w-xs truncate" title={r.lastMessage}>
                    {r.lastMessage}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
