"use client";

import { useEffect, useId, useRef, useState } from "react";
import styles from "@/app/(workspace)/pulse/pulse.module.css";

export type ChartPoint = { l: string; v: number; title?: string };

const CHART_H = 168;

export default function PulseLiveChart({
  kind,
  series,
  color,
  compare,
  compareColor = "#818cf8",
}: {
  kind: "line" | "bar";
  series: ChartPoint[];
  color: string;
  compare?: ChartPoint[];
  compareColor?: string;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(560);
  const gradId = useId().replace(/:/g, "");

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const apply = () => {
      const next = Math.round(wrap.clientWidth);
      if (next >= 40) setWidth(next);
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, []);

  const w = Math.max(width, 40);
  const h = CHART_H;

  return (
    <div className={styles.liveChartExact} ref={wrapRef}>
      {compare ? (
        <CompareBarChart series={series} compare={compare} color={color} compareColor={compareColor} w={w} h={h} />
      ) : kind === "bar" ? (
        <BarChart series={series} color={color} w={w} h={h} />
      ) : (
        <LineChart series={series} color={color} w={w} h={h} gradId={gradId} />
      )}
    </div>
  );
}

function BarChart({ series, color, w, h }: { series: ChartPoint[]; color: string; w: number; h: number }) {
  if (!series.length) return <EmptyChart />;
  const padL = 8;
  const padR = 8;
  const padT = 22;
  const padB = 26;
  const gap = Math.min(16, Math.max(8, Math.round(w / 80)));
  const max = Math.max(...series.map((p) => p.v), 1);
  const inner = w - padL - padR;
  const slot = (inner - gap * (series.length - 1)) / series.length;
  const bw = series.length <= 3 ? Math.min(72, slot) : slot;
  const base = h - padB;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} preserveAspectRatio="none" role="img" aria-label="Bar chart">
      {series.map((s, i) => {
        const bh = Math.max(6, (s.v / max) * (base - padT));
        const slotX = padL + i * (slot + gap);
        const x = slotX + (slot - bw) / 2;
        const y = base - bh;
        return (
          <g key={`${s.l}-${i}`}>
            <title>{s.title ?? s.l}</title>
            <rect x={x} y={y} width={bw} height={bh} rx={5} fill={color} />
            <text x={slotX + slot / 2} y={y - 6} textAnchor="middle" fontSize={11} fontWeight={700} fill="#0f172a">
              {s.v.toLocaleString()}
            </text>
            <text x={slotX + slot / 2} y={h - 8} textAnchor="middle" fontSize={11} fill="#475569">
              {s.l}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function CompareBarChart({
  series,
  compare,
  color,
  compareColor,
  w,
  h,
}: {
  series: ChartPoint[];
  compare: ChartPoint[];
  color: string;
  compareColor: string;
  w: number;
  h: number;
}) {
  if (!series.length) return <EmptyChart />;
  const padL = 8;
  const padR = 8;
  const padT = 22;
  const padB = 28;
  const gap = Math.min(16, Math.max(8, Math.round(w / 70)));
  const max = Math.max(...series.map((p) => p.v), ...compare.map((p) => p.v), 1);
  const inner = w - padL - padR;
  const slot = (inner - gap * (series.length - 1)) / series.length;
  const pairGap = 3;
  const bw = Math.max(6, (slot - pairGap) / 2);
  const base = h - padB;
  const compareByLabel = new Map(compare.map((item) => [item.l, item.v]));

  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} preserveAspectRatio="none" role="img" aria-label="Comparison bar chart">
      {series.map((s, i) => {
        const other = compareByLabel.get(s.l) ?? 0;
        const slotX = padL + i * (slot + gap);
        const h1 = Math.max(4, (s.v / max) * (base - padT));
        const h2 = Math.max(4, (other / max) * (base - padT));
        const x1 = slotX + Math.max(0, (slot - bw * 2 - pairGap) / 2);
        const x2 = x1 + bw + pairGap;
        return (
          <g key={`${s.l}-${i}`}>
            <title>{`${s.title ?? s.l}: demand ${s.v}, available ${other}`}</title>
            <rect x={x1} y={base - h1} width={bw} height={h1} rx={4} fill={color} />
            <rect x={x2} y={base - h2} width={bw} height={h2} rx={4} fill={compareColor} />
            <text x={x1 + bw / 2} y={base - h1 - 5} textAnchor="middle" fontSize={10} fontWeight={700} fill="#0f172a">
              {s.v.toLocaleString()}
            </text>
            <text x={x2 + bw / 2} y={base - h2 - 5} textAnchor="middle" fontSize={10} fontWeight={700} fill="#0f172a">
              {other.toLocaleString()}
            </text>
            <text x={slotX + slot / 2} y={h - 8} textAnchor="middle" fontSize={11} fill="#475569">
              {s.l}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function LineChart({
  series,
  color,
  w,
  h,
  gradId,
}: {
  series: ChartPoint[];
  color: string;
  w: number;
  h: number;
  gradId: string;
}) {
  if (!series.length) return <EmptyChart />;
  const padL = 36;
  const padR = 8;
  const padT = 14;
  const padB = 22;
  const ys = series.map((p) => p.v);
  const min = Math.min(...ys);
  const max = Math.max(...ys);
  const span = max - min || 1;
  const X = (i: number) => padL + (i / Math.max(series.length - 1, 1)) * (w - padL - padR);
  const Y = (v: number) => padT + (1 - (v - min) / span) * (h - padT - padB);
  const d = series.map((p, i) => `${i ? "L" : "M"}${X(i).toFixed(1)},${Y(p.v).toFixed(1)}`).join(" ");
  const area = `${d} L${X(series.length - 1).toFixed(1)},${h - padB} L${X(0).toFixed(1)},${h - padB} Z`;
  const step = Math.max(1, Math.ceil(series.length / 6));

  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} preserveAspectRatio="none" role="img" aria-label="Line chart">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity={0.22} />
          <stop offset="1" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      {[0, 0.5, 1].map((t) => {
        const y = padT + t * (h - padT - padB);
        const v = max - t * span;
        const label = Math.abs(v) >= 100 ? Math.round(v).toLocaleString() : (Math.round(v * 10) / 10).toString();
        return (
          <g key={t}>
            <line x1={padL} x2={w - padR} y1={y} y2={y} stroke="#e2e8f0" />
            <text x={2} y={y + 3} fontSize={10} fill="#94a3b8">
              {label}
            </text>
          </g>
        );
      })}
      <path d={area} fill={`url(#${gradId})`} />
      <path d={d} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      {series.map((p, i) => (
        <circle key={`${p.l}-${i}`} cx={X(i)} cy={Y(p.v)} r={3} fill="#fff" stroke={color} strokeWidth={2} />
      ))}
      {series.map((p, i) => {
        if (!p.l || (i % step !== 0 && i !== series.length - 1)) return null;
        const anchor = i === 0 ? "start" : i === series.length - 1 ? "end" : "middle";
        return (
          <text key={`x-${i}`} x={X(i)} y={h - 6} textAnchor={anchor} fontSize={10} fill="#64748b">
            {p.l}
          </text>
        );
      })}
    </svg>
  );
}

function EmptyChart() {
  return (
    <div className={styles.chartEmptyExact}>No recorded data</div>
  );
}
