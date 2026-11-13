/**
 * Tiny inline sparkline for outcome tiles. Pure SVG, no library, inherits a colour token
 * through `tone` so it stays on-system in both the Tessiant workspace and Pulse.
 */
type SparkTone = "brand" | "qiko" | "success" | "muted";

const TONE_VAR: Record<SparkTone, string> = {
  brand: "var(--brand)",
  qiko: "var(--qiko-accent)",
  success: "var(--success)",
  muted: "var(--subtle)",
};

interface SparkProps {
  values: number[];
  kind?: "bars" | "line";
  tone?: SparkTone;
  width?: number;
  height?: number;
  /** Accessible description, e.g. "Placements per month, last 6 months". */
  label: string;
}

export default function Spark({ values, kind = "bars", tone = "brand", width = 76, height = 28, label }: SparkProps) {
  const data = values.length ? values : [0];
  const max = Math.max(1, ...data);
  const color = TONE_VAR[tone];

  if (kind === "line") {
    const step = data.length > 1 ? width / (data.length - 1) : width;
    const points = data.map((value, index) => [index * step, height - 2 - (value / max) * (height - 4)] as const);
    const path = points.map(([x, y], index) => `${index === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
    const area = `${path} L${width} ${height} L0 ${height} Z`;
    const last = points[points.length - 1];
    return (
      <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} role="img" aria-label={label} style={{ color, overflow: "visible" }}>
        <path d={area} fill="currentColor" opacity={0.12} />
        <path d={path} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinejoin="round" strokeLinecap="round" />
        <circle cx={last[0]} cy={last[1]} r={2.2} fill="currentColor" />
      </svg>
    );
  }

  const gap = 2;
  const barWidth = Math.max(2, (width - gap * (data.length - 1)) / data.length);
  const lastIndex = data.length - 1;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} role="img" aria-label={label} style={{ color }}>
      {data.map((value, index) => {
        const barHeight = Math.max(2, (value / max) * height);
        return (
          <rect
            key={index}
            x={index * (barWidth + gap)}
            y={height - barHeight}
            width={barWidth}
            height={barHeight}
            rx={1.5}
            fill="currentColor"
            opacity={index === lastIndex ? 1 : value === 0 ? 0.18 : 0.45}
          />
        );
      })}
    </svg>
  );
}
