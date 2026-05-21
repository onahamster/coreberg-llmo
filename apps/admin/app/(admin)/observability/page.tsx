import { requireAdmin } from "@/lib/auth/admin-guard";
import { getServerClient } from "@/lib/supabase/server";
import { SloChart } from "./_components/SloChart";
import { TopErrorsTable } from "./_components/TopErrorsTable";

export default async function ObservabilityPage() {
  await requireAdmin();
  const sb = getServerClient();

  const since = new Date(Date.now() - 24 * 3600_000).toISOString();

  const { data: metrics } = await sb
    .from("request_metrics_5m_cache")
    .select("bucket, source, route, request_count, error_count, p50, p95, p99")
    .gte("bucket", since)
    .order("bucket", { ascending: true });

  // Fallback to live view query if cache is empty during early testing
  let actualMetrics = metrics ?? [];
  if (actualMetrics.length === 0) {
    const { data: live } = await sb
      .from("request_traces")
      .select("ts, source, route, status_code, duration_ms")
      .gte("ts", since);
    
    // Group dynamically on-the-fly for simple visual fallback
    const groupedLive = new Map<string, { bucket: string; source: string; route: string; request_count: number; error_count: number; p95: number }>();
    for (const r of live ?? []) {
      const bucket = new Date(new Date(r.ts).getTime() - (new Date(r.ts).getMinutes() % 5) * 60 * 1000).toISOString();
      const key = `${bucket}::${r.source}::${r.route}`;
      const entry = groupedLive.get(key) ?? { bucket, source: r.source, route: r.route, request_count: 0, error_count: 0, p95: 0 };
      entry.request_count += 1;
      if (r.status_code >= 500) entry.error_count += 1;
      entry.p95 = Math.max(entry.p95, r.duration_ms); // simple max for p95 estimation in fallback
      groupedLive.set(key, entry);
    }
    actualMetrics = Array.from(groupedLive.values()) as any;
  }

  const buckets = new Map<string, { req: number; err: number; p95s: number[] }>();
  for (const m of actualMetrics ?? []) {
    const key = m.bucket;
    const s = buckets.get(key) ?? { req: 0, err: 0, p95s: [] };
    s.req += Number(m.request_count);
    s.err += Number(m.error_count);
    s.p95s.push(Number(m.p95));
    buckets.set(key, s);
  }
  const series = Array.from(buckets.entries()).sort(([a], [b]) => a < b ? -1 : 1).map(([t, v]) => ({
    t,
    errorRate: v.req > 0 ? v.err / v.req : 0,
    p95: v.p95s.length ? Math.round(v.p95s.reduce((a, b) => a + b, 0) / v.p95s.length) : 0,
  }));

  const overallAvailability = series.length > 0
    ? 1 - (series.reduce((s, x) => s + x.errorRate, 0) / series.length)
    : 1.0;

  return (
    <div className="space-y-6 p-8 bg-zinc-950 min-h-screen text-zinc-100">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-extrabold tracking-tight text-white bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">可観測性ダッシュボード</h1>
        <p className="text-sm text-zinc-400">直近 24 時間のリアルタイム SLO、レイテンシ、および外部依存ヘルス</p>
      </div>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Kpi 
          label="サービス可用性 (SLO)" 
          value={`${(overallAvailability * 100).toFixed(3)}%`}
          tone={overallAvailability >= 0.999 ? "good" : overallAvailability >= 0.99 ? "warn" : "bad"} 
        />
        <Kpi 
          label="全体 p95 レイテンシ" 
          value={`${series.length ? Math.round(series.reduce((s, x) => s + x.p95, 0) / series.length) : 0} ms`} 
        />
        <Kpi 
          label="総リクエスト数 (24h)" 
          value={String(actualMetrics.reduce((s, m) => s + Number(m.request_count), 0).toLocaleString())} 
        />
      </section>

      <section className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 backdrop-blur-md">
        <h2 className="text-lg font-semibold text-white mb-2">SLO & エラー率推移 (5分毎)</h2>
        <p className="text-xs text-zinc-400 mb-4">青線: p95応答時間(ms), 赤線: エラー割合</p>
        <SloChart series={series} />
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RouteTable rows={actualMetrics.slice(-20)} />
        <TopErrorsTable />
      </section>
    </div>
  );
}

function Kpi({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "good" | "warn" | "bad" }) {
  const borderCls = tone === "good" ? "border-emerald-500/20" : tone === "warn" ? "border-amber-500/20" : tone === "bad" ? "border-red-500/20" : "border-zinc-800";
  const bgCls = tone === "good" ? "bg-emerald-950/20" : tone === "warn" ? "bg-amber-950/20" : tone === "bad" ? "bg-red-950/20" : "bg-zinc-900/50";
  const textCls = tone === "good" ? "text-emerald-400" : tone === "warn" ? "text-amber-400" : tone === "bad" ? "text-red-400" : "text-white";
  return (
    <div className={`rounded-2xl border ${borderCls} ${bgCls} p-6 backdrop-blur-md transition-all hover:scale-[1.01]`}>
      <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500">{label}</div>
      <div className={`mt-2 text-3xl font-extrabold tabular-nums ${textCls}`}>{value}</div>
    </div>
  );
}

function RouteTable({ rows }: { rows: { route: string; source: string; request_count: number; error_count: number; p95: number }[] }) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 backdrop-blur-md">
      <h2 className="text-lg font-semibold text-white mb-4">最近 5 分粒度のルートアクティビティ</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-zinc-300">
          <thead className="text-zinc-500 border-b border-zinc-800">
            <tr>
              <th className="pb-3 text-left font-medium">ルートパス</th>
              <th className="pb-3 text-right font-medium">リクエスト</th>
              <th className="pb-3 text-right font-medium">エラー</th>
              <th className="pb-3 text-right font-medium">p95 レイテンシ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/50">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-6 text-center text-zinc-500">アクティブな通信はありません</td>
              </tr>
            ) : rows.map((r, i) => (
              <tr key={i} className="hover:bg-zinc-800/20 transition-colors">
                <td className="py-3 font-mono text-xs text-blue-400">{r.source}: {r.route}</td>
                <td className="py-3 text-right tabular-nums font-semibold">{r.request_count}</td>
                <td className={`py-3 text-right tabular-nums font-semibold ${r.error_count ? "text-red-400" : "text-zinc-500"}`}>{r.error_count}</td>
                <td className="py-3 text-right tabular-nums font-semibold text-zinc-400">{Math.round(Number(r.p95))} ms</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
