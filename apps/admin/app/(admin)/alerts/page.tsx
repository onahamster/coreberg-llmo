import { requireAdmin } from "@/lib/auth/admin-guard";
import { getServerClient } from "@/lib/supabase/server";
import { AlertActions } from "./_components/AlertActions";

export default async function AlertsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requireAdmin();
  const sb = getServerClient();
  const resolvedSearchParams = await searchParams;
  const status = resolvedSearchParams.status ?? "open";
  
  let query = sb
    .from("ops_alerts")
    .select("id, key, severity, title, detail, status, first_seen_at, last_seen_at, occurrences")
    .order("last_seen_at", { ascending: false })
    .limit(100);

  if (status !== "all") {
    query = query.eq("status", status);
  }

  const { data: alerts } = await query;

  return (
    <div className="space-y-6 p-8 bg-zinc-950 min-h-screen text-zinc-100">
      <header className="flex flex-col md:flex-row md:items-center justify-between border-b border-zinc-800 pb-5 gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-extrabold tracking-tight text-white bg-gradient-to-r from-red-400 to-amber-400 bg-clip-text text-transparent">運用アラート受信箱</h1>
          <p className="text-sm text-zinc-400">システム障害、AI コストスパイク、および外部接続エラーの検知リスト</p>
        </div>
        <nav className="flex items-center gap-2 bg-zinc-900/60 p-1.5 rounded-xl border border-zinc-800">
          {["open", "ack", "resolved", "all"].map((s) => (
            <a 
              key={s} 
              href={`/alerts?status=${s}`} 
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg capitalize transition-colors ${
                status === s 
                  ? "bg-zinc-800 text-white font-bold" 
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {s}
            </a>
          ))}
        </nav>
      </header>

      <div className="divide-y divide-zinc-800/60 rounded-2xl border border-zinc-800 bg-zinc-900/40 overflow-hidden backdrop-blur-md">
        {(alerts ?? []).length === 0 ? (
          <div className="p-12 text-center text-sm text-zinc-500 font-medium">現在、対応が必要なアラートはありません。すべて順調です！ 🎉</div>
        ) : (
          (alerts ?? []).map((a) => (
            <div key={a.id} className="flex flex-col md:flex-row items-start md:items-center gap-4 p-6 hover:bg-zinc-800/10 transition-colors">
              <SeverityBadge s={a.severity} />
              <div className="min-w-0 flex-1 space-y-1">
                <div className="text-sm font-bold text-white">{a.title}</div>
                <div className="font-mono text-[10px] text-zinc-500">{a.key}</div>
                <div className="text-[11px] text-zinc-400 space-x-2">
                  <span>初回検知: {new Date(a.first_seen_at).toLocaleString("ja-JP")}</span>
                  <span>•</span>
                  <span>最終検知: {new Date(a.last_seen_at).toLocaleString("ja-JP")}</span>
                  <span>•</span>
                  <span className="font-bold text-zinc-300">発生回数: {a.occurrences}回</span>
                </div>
                {a.detail && Object.keys(a.detail).length > 0 && (
                  <pre className="mt-3 max-h-48 overflow-auto rounded-xl border border-zinc-800/60 bg-zinc-950/80 p-4 text-[10px] font-mono text-zinc-400">
                    {JSON.stringify(a.detail, null, 2)}
                  </pre>
                )}
              </div>
              <div className="shrink-0 flex items-center gap-2">
                {a.status !== "resolved" && <AlertActions id={a.id} status={a.status} />}
                {a.status === "resolved" && (
                  <span className="rounded bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
                    解決済み
                  </span>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function SeverityBadge({ s }: { s: string }) {
  const m: Record<string, string> = {
    critical: "bg-red-500/10 border-red-500/30 text-red-400", 
    warning: "bg-amber-500/10 border-amber-500/30 text-amber-400", 
    info: "bg-blue-500/10 border-blue-500/30 text-blue-400",
  };
  return (
    <span className={`shrink-0 rounded-lg border px-2.5 py-1 text-xs font-bold capitalize ${m[s] ?? "bg-zinc-800 border-zinc-700 text-zinc-300"}`}>
      {s}
    </span>
  );
}
