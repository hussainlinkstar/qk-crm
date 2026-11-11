import type { ChartPoint } from "@/components/pulse/PulseLiveChart";
import type { CrmState } from "./types";
import type { TessiantInsight } from "./tessiant-pulse-types";
import { networkMix } from "./tessiant-pulse-rules";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function lastNDays(n: number, now = new Date()) {
  const days: string[] = [];
  for (let i = n - 1; i >= 0; i -= 1) {
    const d = new Date(now);
    d.setHours(12, 0, 0, 0);
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }
  return days;
}

function labelDay(key: string) {
  return key.slice(5);
}

/** Cumulative verified associates by month — Tessiant stand-in for investor growth. */
export function associateGrowthSeries(state: CrmState): ChartPoint[] {
  const associates = state.tessiant?.associates ?? [];
  const byMonth = new Map<string, number>();
  for (const a of associates) {
    const raw = a.verifiedAt || a.profileUpdatedAt || "";
    const key = raw.slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(key)) continue;
    byMonth.set(key, (byMonth.get(key) ?? 0) + 1);
  }
  // Fall back to placement start months so the SVG still has a real series.
  if (byMonth.size < 2) {
    for (const p of state.tessiant?.placements ?? []) {
      const key = (p.placementDate || p.terms.startDate || p.createdAt || "").slice(0, 7);
      if (!/^\d{4}-\d{2}$/.test(key)) continue;
      byMonth.set(key, (byMonth.get(key) ?? 0) + 1);
    }
  }
  const keys = [...byMonth.keys()].sort();
  if (!keys.length) {
    return associates.length ? [{ l: "Sample", v: associates.length }] : [];
  }
  let cumulative = 0;
  const years = new Set(keys.map((k) => k.slice(0, 4)));
  const short = years.size === 1 && keys.length <= 12;
  return keys.map((key) => {
    cumulative += byMonth.get(key) ?? 0;
    const m = Number(key.slice(5, 7));
    const label = short ? MONTHS[m - 1]! : `${MONTHS[m - 1]} ${key.slice(2, 4)}`;
    return { l: label, v: cumulative };
  });
}

export function roleDistributionSeries(state: CrmState): ChartPoint[] {
  const mix = networkMix(state);
  return Object.entries(mix.byRole)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([l, v]) => ({ l: l.length > 12 ? `${l.slice(0, 11)}…` : l, v }));
}

export function activitySeries(state: CrmState, days: number, now = new Date()): ChartPoint[] {
  const events = state.tessiant?.domainEvents ?? [];
  const keys = lastNDays(days, now);
  const counts = new Map(keys.map((k) => [k, 0]));
  for (const event of events) {
    const key = event.timestamp.slice(0, 10);
    if (counts.has(key)) counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return keys.map((k) => ({ l: labelDay(k), v: counts.get(k) ?? 0 }));
}

export function signalsSeries(insights: TessiantInsight[], days: number, now = new Date()): ChartPoint[] {
  const keys = lastNDays(days, now);
  const counts = new Map(keys.map((k) => [k, 0]));
  for (const insight of insights) {
    const key = insight.generatedAt.slice(0, 10);
    if (counts.has(key)) counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return keys.map((k) => ({ l: labelDay(k), v: counts.get(k) ?? 0 }));
}
