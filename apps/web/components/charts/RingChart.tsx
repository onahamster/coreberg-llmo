'use client';

export function RingChart({
  value,
  max,
  label,
  color = '#0a0a0a',
  size = 140,
  stroke = 14,
}: {
  value: number;
  max: number;
  label: string;
  color?: string;
  size?: number;
  stroke?: number;
}) {
  const radius = (size - stroke) / 2;
  const c = 2 * Math.PI * radius;
  const ratio = max === 0 ? 0 : Math.min(1, Math.max(0, value / max));
  const offset = c * (1 - ratio);

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="var(--border)"
        strokeWidth={stroke}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeDasharray={c}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: 'stroke-dashoffset 0.6s ease' }}
      />
      <text
        x="50%"
        y="50%"
        textAnchor="middle"
        dominantBaseline="central"
        style={{ fontSize: 18, fontWeight: 600, fill: 'var(--fg)' }}
      >
        {label}
      </text>
    </svg>
  );
}
