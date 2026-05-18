"use client";

export function SloChart({
  series,
}: {
  series: { t: string; errorRate: number; p95: number }[];
}) {
  if (series.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 rounded-xl border border-dashed border-zinc-800 bg-zinc-900/20 text-sm text-zinc-500">
        十分なデータソースが蓄積されていません
      </div>
    );
  }

  const W = 1000;
  const H = 240;
  const padding = 20;
  const chartW = W - padding * 2;
  const chartH = H - padding * 2;

  const maxP95 = Math.max(...series.map((s) => s.p95), 100);
  
  const errPath = series
    .map((s, i) => {
      const x = padding + (i / Math.max(series.length - 1, 1)) * chartW;
      const y = padding + chartH - Math.min(s.errorRate * 10, 1) * chartH;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  const p95Path = series
    .map((s, i) => {
      const x = padding + (i / Math.max(series.length - 1, 1)) * chartW;
      const y = padding + chartH - (s.p95 / maxP95) * chartH;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <div className="w-full overflow-hidden">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto bg-zinc-950/40 rounded-xl p-4">
        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => {
          const y = padding + chartH * ratio;
          return (
            <line
              key={idx}
              x1={padding}
              y1={y}
              x2={W - padding}
              y2={y}
              stroke="#27272a"
              strokeWidth="1"
              strokeDasharray="4 4"
            />
          );
        })}

        {/* p95 curve line */}
        <path d={p95Path} fill="none" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        
        {/* Error rate curve line */}
        <path d={errPath} fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

        {/* Chart Labels */}
        <text x={padding + 10} y={padding + 15} fontSize="11" fontWeight="bold" fill="#3b82f6">
          p95 レイテンシ ({maxP95}ms ピーク)
        </text>
        <text x={padding + 10} y={padding + 32} fontSize="11" fontWeight="bold" fill="#ef4444">
          エラー比率 (error rate %)
        </text>
      </svg>
    </div>
  );
}
