// Offerings catalogue: for each thing Tessiant sells, who can deliver it, who wants it, what it has
// won, and what it earns. All from associates' recorded offerings, accounts' interests and
// purchases, opportunities' services, and placement terms. Nothing modelled.

import type { CrmState, Opportunity } from "./types";
import type { Associate, ClientAccount, ClientRequirement } from "./tessiant-types";
import { placementMargins, type PlacementMargin } from "./pricing-intelligence";
import { benchTimeline, HORIZONS, type TimelineRow } from "./bench-timeline";
import { networkMixStats } from "./network-mix";

export type OfferingHealth = "demand-exceeds-pool" | "pool-idle" | "healthy" | "quiet";

export interface OfferingRow {
  key: string;
  name: string;
  pool: Associate[];
  availableNow: number;
  interested: ClientAccount[];
  purchased: ClientAccount[];
  openDeals: Opportunity[];
  wonDeals: Opportunity[];
  openValue: number;
  wonValue: number;
  margins: PlacementMargin[];
  avgMarginPct: number | null;
  health: OfferingHealth;
  why: string;
}

const norm = (value: string) => value.trim().toLowerCase();

/** Loose match so "Advisory" and "Senior Industry Advisors" or "SAP architecture" and "SAP delivery" land on the same row. */
function matches(a: string, b: string): boolean {
  const x = norm(a);
  const y = norm(b);
  if (x === y) return true;
  const head = (value: string) => value.split(/[\s&/]+/)[0];
  return head(x).length > 3 && head(x) === head(y);
}

export function offeringCatalogue(state: CrmState): OfferingRow[] {
  const t = state.tessiant;
  if (!t) return [];
  const names = new Map<string, string>();
  const register = (name: string) => {
    if (!name.trim()) return;
    const existing = [...names.values()].find((item) => matches(item, name));
    if (!existing) names.set(norm(name), name);
  };
  for (const associate of t.associates) for (const offering of associate.offerings) register(offering);
  for (const account of t.accounts) for (const offering of [...(account.offeringInterests ?? []), ...(account.servicesPurchased ?? [])]) register(offering);
  for (const opportunity of state.opportunities ?? []) for (const service of opportunity.services) register(service);

  const margins = placementMargins(state);
  const rows = [...names.values()].map((name) => {
    const pool = t.associates.filter((associate) => associate.status === "active" && associate.offerings.some((offering) => matches(offering, name)));
    const availableNow = pool.filter((associate) => associate.availability === "available").length;
    const interested = t.accounts.filter((account) => (account.offeringInterests ?? []).some((offering) => matches(offering, name)));
    const purchased = t.accounts.filter((account) => (account.servicesPurchased ?? []).some((offering) => matches(offering, name)));
    const deals = (state.opportunities ?? []).filter((opportunity) => opportunity.services.some((service) => matches(service, name)));
    const openDeals = deals.filter((item) => item.stage !== "Closed Won" && item.stage !== "Closed Lost");
    const wonDeals = deals.filter((item) => item.stage === "Closed Won");
    const rowMargins = margins.filter((item) => {
      const associate = t.associates.find((entry) => entry.id === item.placement.associateId);
      return associate?.offerings.some((offering) => matches(offering, name));
    });
    const avgMarginPct = rowMargins.length ? Math.round(rowMargins.reduce((sum, item) => sum + item.marginPct, 0) / rowMargins.length) : null;
    const demand = interested.length + openDeals.length;
    const health: OfferingHealth = demand > 0 && availableNow < Math.max(1, openDeals.length) ? "demand-exceeds-pool" : demand === 0 && pool.length > 0 ? "pool-idle" : demand > 0 ? "healthy" : "quiet";
    const why =
      health === "demand-exceeds-pool"
        ? `${demand} account${demand === 1 ? "" : "s"} want it, ${availableNow} available to deliver it now`
        : health === "pool-idle"
          ? `${pool.length} can deliver it, nobody has asked. A sales conversation, not a sourcing one`
          : health === "healthy"
            ? `${availableNow} available against ${demand} live demand signal${demand === 1 ? "" : "s"}`
            : "No pool and no demand recorded";
    return {
      key: norm(name),
      name,
      pool,
      availableNow,
      interested,
      purchased,
      openDeals,
      wonDeals,
      openValue: openDeals.reduce((sum, item) => sum + item.amount, 0),
      wonValue: wonDeals.reduce((sum, item) => sum + (item.agreedContractValue ?? item.amount), 0),
      margins: rowMargins,
      avgMarginPct,
      health,
      why,
    };
  });
  const rank: Record<OfferingHealth, number> = { "demand-exceeds-pool": 0, healthy: 1, "pool-idle": 2, quiet: 3 };
  return rows.filter((row) => row.pool.length || row.interested.length || row.purchased.length || row.openDeals.length || row.wonDeals.length).sort((a, b) => rank[a.health] - rank[b.health] || b.openValue + b.wonValue - (a.openValue + a.wonValue) || b.pool.length - a.pool.length);
}

export interface OfferingDecision {
  sector: string;
  share: { sector: string; count: number; pct: number } | null;
  benchRow: TimelineRow | null;
  gapHorizon: number | null;
  gap: number;
  briefs: ClientRequirement[];
  verdict: string;
}

/**
 * The decision behind an offering: the sector it sells into, how much of the network has that
 * experience, whether the bench runs short inside 90 days, and which briefs are open.
 */
export function offeringDecision(state: CrmState, row: OfferingRow): OfferingDecision | null {
  const bench = benchTimeline(state, "sector");
  const bySector = new Map<string, number>();
  for (const account of [...row.interested, ...row.purchased]) bySector.set(account.sector, (bySector.get(account.sector) ?? 0) + 1);
  const named = bench.rows.find((item) => row.name.toLowerCase().includes(item.label.toLowerCase()));
  const sector = named?.label ?? [...bySector.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  if (!sector) return null;
  const benchRow = named ?? bench.rows.find((item) => item.label.toLowerCase() === sector.toLowerCase()) ?? null;
  const gapHorizon = benchRow ? HORIZONS.find((horizon) => benchRow.cells[horizon].gap > 0) ?? null : null;
  const gap = benchRow && gapHorizon ? benchRow.cells[gapHorizon].gap : 0;
  const share = networkMixStats(state).sectors.find((item) => item.sector.toLowerCase() === sector.toLowerCase()) ?? null;
  const briefs = benchRow ? benchRow.cells[90].requirements : [];
  const verdict =
    gap > 0
      ? `Sell it, but source first: the ${sector} bench runs ${gap} short inside ${gapHorizon} days.`
      : share && share.pct < 15
        ? `Thin base: ${share.pct}% of the network has ${sector} experience. Win one brief, then grow the pool behind it.`
        : "Room to sell: cover is there and the network has the experience.";
  return { sector, share, benchRow, gapHorizon, gap, briefs, verdict };
}
