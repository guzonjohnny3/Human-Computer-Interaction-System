"use client";

interface Props {
  values: number[];
  min?: number;
  max?: number;
  color?: string;
  width?: number;
  height?: number;
  fill?: boolean;
}

export function Sparkline({
  values,
  min,
  max,
  color = "#22d3ee",
  width = 120,
  height = 36,
  fill = true,
}: Props) {
  if (values.length === 0) return null;
  const lo = min ?? Math.min(...values);
  const hi = max ?? Math.max(...values);
  const range = hi - lo || 1;
  const pad = 2;
  const dx = (width - pad * 2) / Math.max(1, values.length - 1);
  const pts = values.map((v, i) => {
    const x = pad + i * dx;
    const y = height - pad - ((v - lo) / range) * (height - pad * 2);
    return [x, y] as const;
  });
  const line = pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area =
    `M${pts[0][0].toFixed(1)},${height - pad} ` +
    pts.map(([x, y]) => `L${x.toFixed(1)},${y.toFixed(1)}`).join(" ") +
    ` L${pts[pts.length - 1][0].toFixed(1)},${height - pad} Z`;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden>
      {fill && <path d={area} fill={color} opacity={0.18} />}
      <path d={line} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
