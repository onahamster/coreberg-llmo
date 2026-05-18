import { requireAdmin } from "@/lib/auth/admin-guard";
import { getServerClient } from "@/lib/supabase/server";

export default async function CostsPage() {
  await requireAdmin();
  const sb = getServerClient();

  const { data: daily } = await sb
    .from("ai_cost_daily_cache")
    .select("day, model, step, project_key, cost_cents, input_tokens, output_tokens, call_count")
    .gte("day", new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10))
    .order("day", { ascending: false });

  let actualDaily = daily ?? [];
  if (actualDaily.length === 0) {
    // Fallback to query live ai_usage views if cache rollup is not active yet in the developer environment
    const { data: live } = await sb
      .from("ai_cost_daily")
      .select("day, model, step, project_key, cost_cents, input_tokens, output_tokens, call_count");
    actualDaily = (live ?? []) as any;
  }

  const todayStr = new Date().toISOString().slice(0, 10);
  const today = actualDaily.filter((r) => r.day === todayStr);
  const todayTotal = today.reduce((s, r) => s + Number(r.cost_cents), 0);
  const monthTotal = actualDaily.reduce((s, r) => s + Number(r.cost_cents), 0);

  const byModel = aggregate(actualDaily, (r) => r.model);
  const byStep = aggregate(actualDaily, (r) => r.step);
  const byProject = aggregate(actualDaily, (r) => r.project_key);

  return (
    <div className="space-y-6 p-8 bg-zinc-950 min-h-screen text-zinc-100">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-extrabold tracking-tight text-white bg-gradient-to-r from-teal-400 to-emerald-400 bg-clip-text text-transparent">AI コストインサイト</h1>
        <p className="text-sm text-zinc-400">直近 30 日間の AI トークン使用量、および累積コスト分析</p>
      </div>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Kpi label="本日の推定コスト" value={`¥${Math.round(todayTotal).toLocaleString()}`} />
        <Kpi label="直近 30 日の累積コスト" value={`¥${Math.round(monthTotal).toLocaleString()}`} />
        <Kpi label="1日あたりの平均コスト" value={`¥${Math.round(monthTotal / 30).toLocaleString()}`} />
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Breakdown title="モデル別の割合" rows={byModel} />
        <Breakdown title="タスク / ステップ別" rows={byStep} />
        <Breakdown title="プロジェクト別 (上位)" rows={byProject.slice(0, 10)} />
      </div>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 backdrop-blur-md transition-all hover:scale-[1.01]">
      <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500">{label}</div>
      <div className="mt-2 text-3xl font-extrabold tabular-nums text-white">{value}</div>
    </div>
  );
}

function Breakdown({ title, rows }: { title: string; rows: { key: string; cost: number; calls: number }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.cost));
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 backdrop-blur-md">
      <h2 className="text-md font-semibold text-white mb-6 border-b border-zinc-800 pb-3">{title}</h2>
      <div className="space-y-4">
        {rows.length === 0 ? (
          <div className="text-sm text-zinc-500 text-center py-6">使用履歴がありません</div>
        ) : (
          rows.map((r, i) => (
            <div key={i} className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="truncate max-w-[160px] text-zinc-300 font-mono" title={r.key}>{r.key}</span>
                <span className="tabular-nums font-semibold text-zinc-400">
                  ¥{Math.round(r.cost).toLocaleString()} <span className="text-[10px] text-zinc-600">({r.calls} calls)</span>
                </span>
              </div>
              <div className="h-2 rounded bg-zinc-950 overflow-hidden">
                <div
                  className="h-2 rounded bg-gradient-to-r from-emerald-500 to-teal-500 transition-all duration-500"
                  style={{ width: `${(r.cost / max) * 100}%` }}
                />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function aggregate<T extends { cost_cents: number; call_count: number }>(
  rows: T[], keyFn: (r: T) => string,
): { key: string; cost: number; calls: number }[] {
  const m = new Map<string, { cost: number; calls: number }>();
  for (const r of rows) {
    const k = keyFn(r);
    const e = m.get(k) ?? { cost: 0, calls: 0 };
    e.cost += Number(r.cost_cents);
    e.calls += Number(r.call_count);
    m.set(k, e);
  }
  return [...m.entries()]
    .map(([key, v]) => ({ key, ...v }))
    .sort((a, b) => b.cost - a.cost);
}
