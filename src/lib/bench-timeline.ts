// Bench and demand timeline: who frees up and what starts over the next 30, 60 and 90 days, by
// skill or sector. Supply is projected from recorded availability dates and assignment end dates;
// demand from open requirement start dates. Nothing is modelled beyond those dates.

import type { CrmState } from "./types";
import type { Associate, ClientRequirement } from "./tessiant-types";
import { liveAssignments } from "./assignments";
import { addDays, todayKey } from "./format";

export const HORIZONS = [30, 60, 90] as const;
export type Horizon = (typeof HORIZONS)[number];

export interface TimelineCell {
  /** Associates on the bench by this horizon (available now, or freed up by then). */
  supply: number;
  /** Of those, how many free up inside the window rather than already being available. */
  freeingUp: number;
  /** Open requirement headcount starting by this horizon. */
  demand: number;
  gap: number;
  requirements: ClientRequirement[];
  associates: Associate[];
}

export interface TimelineRow {
  key: string;
  label: string;
  cells: Record<Horizon, TimelineCell>;
  /** Largest gap across horizons, for ranking. */
  worstGap: number;
}

export interface BenchTimeline {
  rows: TimelineRow[];
  totals: Record<Horizon, { supply: number; demand: number; freeingUp: number }>;
  /** Associates whose assignments end within 90 days, soonest first. */
  freeing: Array<{ associate: Associate; date: string; accountName: string | null }>;
}

const norm = (value: string) => value.trim().toLowerCase();

function openRequirements(state: CrmState) {
  return (state.tessiant?.requirements ?? []).filter((req) => !req.archived && req.outcome === "active" && req.stage !== "Placed");
}

/** Date the associate is next on the bench: today if available, else the recorded next date or the live assignment end. */
export function benchDate(state: CrmState, associate: Associate, today = todayKey()): string | null {
  if (associate.status !== "active") return null;
  const live = liveAssignments(state, today).filter((item) => item.associateId === associate.id);
  const lastEnd = live.map((item) => item.terms.endDate).filter(Boolean).sort().at(-1) ?? null;
  if (associate.availability === "available" && live.length === 0) return today;
  if (associate.nextAvailableDate) return associate.nextAvailableDate >= today ? associate.nextAvailableDate : lastEnd ?? today;
  if (lastEnd) return lastEnd;
  return associate.availability === "available" ? today : null;
}

export function benchTimeline(state: CrmState, by: "skill" | "sector", today = todayKey()): BenchTimeline {
  const t = state.tessiant;
  const empty: BenchTimeline = { rows: [], totals: { 30: { supply: 0, demand: 0, freeingUp: 0 }, 60: { supply: 0, demand: 0, freeingUp: 0 }, 90: { supply: 0, demand: 0, freeingUp: 0 } }, freeing: [] };
  if (!t) return empty;
  const reqs = openRequirements(state);
  const horizonDate: Record<Horizon, string> = { 30: addDays(30), 60: addDays(60), 90: addDays(90) };

  // Group keys: the top demand skills (must-have) or every sector with demand.
  const keyCounts = new Map<string, { label: string; count: number }>();
  for (const req of reqs) {
    const keys = by === "skill" ? req.mustHaveSkills : [req.sector];
    for (const key of keys) {
      if (!key.trim()) continue;
      const entry = keyCounts.get(norm(key)) ?? { label: key, count: 0 };
      entry.count += Math.max(req.headcount || 0, 1);
      keyCounts.set(norm(key), entry);
    }
  }
  const keys = [...keyCounts.entries()].sort((a, b) => b[1].count - a[1].count).slice(0, by === "skill" ? 7 : 6);

  const bench = t.associates
    .map((associate) => ({ associate, date: benchDate(state, associate, today) }))
    .filter((item): item is { associate: Associate; date: string } => Boolean(item.date));

  const matches = (associate: Associate, key: string) => (by === "skill" ? associate.skills : associate.sectors).some((item) => norm(item) === key);
  const reqMatches = (req: ClientRequirement, key: string) => (by === "skill" ? req.mustHaveSkills : [req.sector]).some((item) => norm(item) === key);

  const rows: TimelineRow[] = keys.map(([key, { label }]) => {
    const cells = {} as Record<Horizon, TimelineCell>;
    for (const horizon of HORIZONS) {
      const limit = horizonDate[horizon];
      const supplyList = bench.filter((item) => item.date <= limit && matches(item.associate, key));
      const freeingUp = supplyList.filter((item) => item.date > today).length;
      const reqList = reqs.filter((req) => reqMatches(req, key) && req.startDate <= limit);
      const demand = reqList.reduce((sum, req) => sum + Math.max(req.headcount || 0, 1), 0);
      cells[horizon] = { supply: supplyList.length, freeingUp, demand, gap: demand - supplyList.length, requirements: reqList, associates: supplyList.map((item) => item.associate) };
    }
    return { key, label, cells, worstGap: Math.max(...HORIZONS.map((horizon) => cells[horizon].gap)) };
  });
  rows.sort((a, b) => b.worstGap - a.worstGap || a.label.localeCompare(b.label));

  const totals = {} as BenchTimeline["totals"];
  for (const horizon of HORIZONS) {
    const limit = horizonDate[horizon];
    const supplyList = bench.filter((item) => item.date <= limit);
    totals[horizon] = {
      supply: supplyList.length,
      freeingUp: supplyList.filter((item) => item.date > today).length,
      demand: reqs.filter((req) => req.startDate <= limit).reduce((sum, req) => sum + Math.max(req.headcount || 0, 1), 0),
    };
  }

  const freeing = bench
    .filter((item) => item.date > today && item.date <= horizonDate[90])
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((item) => {
      const live = liveAssignments(state, today).find((placement) => placement.associateId === item.associate.id);
      const req = live ? t.requirements.find((entry) => entry.id === live.requirementId) : null;
      const accountName = req ? t.accounts.find((account) => account.id === req.accountId)?.name ?? null : null;
      return { associate: item.associate, date: item.date, accountName };
    });

  return { rows, totals, freeing };
}
