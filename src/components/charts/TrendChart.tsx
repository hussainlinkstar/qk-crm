"use client";

import { useState } from "react";
import styles from "./Charts.module.css";

interface Point {
  key: string;
  label: string;
  value: number;
}

/** Single-series daily bar chart with per-bar hover tooltip (Pulse "live-chart" style). */
export default function TrendChart({ points, color = "#4f46e5", unit, height = 132 }: { points: Point[]; color?: string; unit: string; height?: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...points.map((point) => point.value));
  const ticks = [max, Math.round(max / 2), 0].filter((value, index, list) => list.indexOf(value) === index);
  const active = hover !== null ? points[hover] : null;

  return (
    <div className={styles.trend}>
      <div className={styles.plot} style={{ height }} onMouseLeave={() => setHover(null)}>
        <div className={styles.grid} aria-hidden="true">
          {ticks.map((tick) => (
            <span key={tick} style={{ bottom: `${(tick / max) * 100}%` }}>
              <em>{tick}</em>
            </span>
          ))}
        </div>
        <div className={styles.bars} role="img" aria-label={`${unit} per day, last ${points.length} days`}>
          {points.map((point, index) => (
            <button
              type="button"
              key={point.key}
              className={styles.barSlot}
              onMouseEnter={() => setHover(index)}
              onFocus={() => setHover(index)}
              onBlur={() => setHover(null)}
              aria-label={`${point.label}: ${point.value} ${unit}`}
            >
              <i
                className={styles.bar}
                style={{ height: point.value ? `max(3px, ${(point.value / max) * 100}%)` : "2px", background: point.value ? color : "var(--line)", opacity: hover === null || hover === index ? 1 : 0.45 }}
              />
            </button>
          ))}
        </div>
        {active && hover !== null && (
          <div className={styles.tip} style={{ left: `${((hover + 0.5) / points.length) * 100}%`, bottom: `${Math.max(8, (active.value / max) * 100)}%` }}>
            <b>{active.value}</b>
            <span>{unit} · {active.label}</span>
          </div>
        )}
      </div>
      <div className={styles.axis} aria-hidden="true">
        <span>{points[0]?.label}</span>
        <span>{points[Math.floor(points.length / 2)]?.label}</span>
        <span>Today</span>
      </div>
      <table className="sr-only">
        <caption>{unit} per day</caption>
        <tbody>
          {points.map((point) => (
            <tr key={point.key}>
              <th>{point.label}</th>
              <td>{point.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Horizontal single-hue bars for composition (sources, pipeline stages). */
export function BarList({ items, color = "#6366f1", onSelect }: { items: { label: string; value: number }[]; color?: string; onSelect?: (label: string) => void }) {
  const max = Math.max(1, ...items.map((item) => item.value));
  const total = items.reduce((sum, item) => sum + item.value, 0);
  return (
    <ul className={styles.barList}>
      {items.map((item) => (
        <li key={item.label}>
          <button type="button" onClick={() => onSelect?.(item.label)} disabled={!onSelect} title={onSelect ? `View ${item.label} leads` : undefined}>
            <span className={styles.barListHead}>
              <span>{item.label}</span>
              <b className="tabular">
                {item.value}
                <small> · {Math.round((item.value / Math.max(1, total)) * 100)}%</small>
              </b>
            </span>
            <span className={styles.barTrack}>
              <i style={{ width: `${(item.value / max) * 100}%`, background: color }} />
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
