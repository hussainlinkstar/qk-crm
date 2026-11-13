// Pricing and margin intelligence. Margins come from recorded placement terms (client rate less
// associate cost). Win rate by band comes from closed opportunities and their linked briefs. The
// scarcity premium is an inference from verified supply against each open brief, labelled as such.

import type { CrmState, Opportunity } from "./types";
import type { ClientRequirement, Placement } from "./tessiant-types";
import { deriveAssignmentStatus, resolveAssignmentAccountId } from "./assignments";
import { verifiedAvailableMatchCount } from "./tessiant-insights";
import { benchDate } from "./bench-timeline";

export interface PlacementMargin {
  placement: Placement;
  associateName: string;
  accountName: string;
  role: string;
  clientRate: number;
  cost: number;
  marginPerDay: number;
  marginPct: number;
  live: boolean;
}

export interface BandStat {
  band: string;
  min: number;
  max: number | null;
  won: number;
  lost: number;
  open: number;
  winRate: number | null;
}

export interface ScarcityRow {
  requirement: ClientRequirement;
  accountName: string;
  verified: number;
  benchByStart: number;
  band: string;
  premiumPct: number;
  reason: string;
}

export interface PricingIntel {
  margins: PlacementMargin[];
  avgMarginPct: number | null;
  byOffering: Array<{ offering: string; avgPct: number; count: number }>;
  bands: BandStat[];
  scarcity: ScarcityRow[];
  headline: string;
}

const BANDS: Array<{ band: string; min: number; max: number | null }> = [
  { band: "Under £900", min: 0, max: 900 },
  { band: "£900–1,200", min: 900, max: 1200 },
  { band: "£1,200–1,800", min: 1200, max: 1800 },
  { band: "£1,800+", min: 1800, max: null },
];

function bandFor(rate: number) {
  return BANDS.find((item) => rate >= item.min && (item.max === null || rate < item.max)) ?? BANDS[BANDS.length - 1];
}

function pct(margin: number, client: number) {
  return client > 0 ? Math.round((margin / client) * 100) : 0;
}

export function placementMargins(state: CrmState): PlacementMargin[] {
  const t = state.tessiant;
  if (!t) return [];
  return t.placements
    .filter((placement) => placement.terms?.clientRate?.amount && placement.terms?.associateCost?.amount)
    .map((placement) => {
      const client = placement.terms.clientRate!.amount;
      const cost = placement.terms.associateCost!.amount;
      const requirement = t.requirements.find((item) => item.id === placement.requirementId);
      const accountId = resolveAssignmentAccountId(state, placement);
      const status = deriveAssignmentStatus(placement);
      return {
        placement,
        associateName: t.associates.find((item) => item.id === placement.associateId)?.name ?? "Associate",
        accountName: t.accounts.find((item) => item.id === accountId)?.name ?? "Client",
        role: placement.roleTitle ?? requirement?.title ?? "Engagement",
        clientRate: client,
        cost,
        marginPerDay: client - cost,
        marginPct: pct(client - cost, client),
        live: status === "active" || status === "upcoming" || status === "extended",
      };
    })
    .sort((a, b) => Number(b.live) - Number(a.live) || b.marginPct - a.marginPct);
}

function rateForOpportunity(state: CrmState, opportunity: Opportunity): number | null {
  const t = state.tessiant;
  if (!t) return null;
  const requirement = t.requirements.find((item) => item.linkedOpportunityId === opportunity.id);
  if (requirement?.rateMax) return requirement.rateMax;
  const placement = t.placements.find((item) => item.requirementId === requirement?.id && item.terms?.clientRate?.amount);
  return placement?.terms.clientRate?.amount ?? null;
}

export function winRateByBand(state: CrmState): BandStat[] {
  const stats = BANDS.map((band) => ({ ...band, won: 0, lost: 0, open: 0, winRate: null as number | null }));
  for (const opportunity of state.opportunities ?? []) {
    const rate = rateForOpportunity(state, opportunity);
    if (!rate) continue;
    const stat = stats.find((item) => item.band === bandFor(rate).band)!;
    if (opportunity.stage === "Closed Won") stat.won += 1;
    else if (opportunity.stage === "Closed Lost") stat.lost += 1;
    else stat.open += 1;
  }
  for (const stat of stats) stat.winRate = stat.won + stat.lost > 0 ? Math.round((stat.won / (stat.won + stat.lost)) * 100) : null;
  return stats;
}

export function scarcityPremiums(state: CrmState): ScarcityRow[] {
  const t = state.tessiant;
  if (!t) return [];
  const norm = (value: string) => value.trim().toLowerCase();
  return t.requirements
    .filter((req) => !req.archived && req.outcome === "active" && req.stage !== "Placed")
    .map((req) => {
      const verified = verifiedAvailableMatchCount(state, req.id);
      const wanted = req.mustHaveSkills.map(norm);
      const benchByStart = t.associates.filter((associate) => {
        const date = benchDate(state, associate);
        return date && date <= req.startDate && associate.skills.some((skill) => wanted.includes(norm(skill)));
      }).length;
      const headcount = Math.max(req.headcount || 0, 1);
      const premiumPct = verified === 0 && benchByStart <= headcount ? 15 : verified < headcount ? 10 : benchByStart <= headcount * 2 ? 5 : 0;
      const reason =
        premiumPct >= 15
          ? `No verified available match and only ${benchByStart} with the skills free by the start date`
          : premiumPct === 10
            ? `${verified} verified for ${headcount} seat${headcount === 1 ? "" : "s"}; the skill is scarce in the window`
            : premiumPct === 5
              ? `Cover exists but is thin: ${benchByStart} on the bench by the start date`
              : `${benchByStart} with the skills free by the start date; no scarcity case`;
      const band = req.rateMin && req.rateMax ? `£${req.rateMin.toLocaleString("en-GB")}–${req.rateMax.toLocaleString("en-GB")}/${req.rateUnit}` : req.rateMax ? `up to £${req.rateMax.toLocaleString("en-GB")}/${req.rateUnit}` : "no band recorded";
      return { requirement: req, accountName: t.accounts.find((item) => item.id === req.accountId)?.name ?? "Client", verified, benchByStart, band, premiumPct, reason };
    })
    .sort((a, b) => b.premiumPct - a.premiumPct || a.requirement.startDate.localeCompare(b.requirement.startDate));
}

export function pricingIntel(state: CrmState): PricingIntel {
  const margins = placementMargins(state);
  const live = margins.filter((item) => item.live);
  const basis = live.length ? live : margins;
  const avgMarginPct = basis.length ? Math.round(basis.reduce((sum, item) => sum + item.marginPct, 0) / basis.length) : null;

  const offeringMap = new Map<string, { total: number; count: number }>();
  for (const item of margins) {
    const associate = state.tessiant?.associates.find((entry) => entry.id === item.placement.associateId);
    const requirement = state.tessiant?.requirements.find((entry) => entry.id === item.placement.requirementId);
    const offering = associate?.offerings[0] ?? (requirement?.category === "advisory" ? "Senior Industry Advisors" : "Staff augmentation");
    const entry = offeringMap.get(offering) ?? { total: 0, count: 0 };
    entry.total += item.marginPct;
    entry.count += 1;
    offeringMap.set(offering, entry);
  }
  const byOffering = [...offeringMap.entries()].map(([offering, { total, count }]) => ({ offering, avgPct: Math.round(total / count), count })).sort((a, b) => b.avgPct - a.avgPct);

  const bands = winRateByBand(state);
  const scarcity = scarcityPremiums(state);
  const strongest = scarcity.find((item) => item.premiumPct >= 10);
  const lowest = live.length ? [...live].sort((a, b) => a.marginPct - b.marginPct)[0] : null;
  const headline = strongest
    ? `${strongest.requirement.title} supports a ${strongest.premiumPct}% scarcity premium before it goes to proposal`
    : lowest && lowest.marginPct < 20
      ? `${lowest.associateName} at ${lowest.accountName} runs at ${lowest.marginPct}% margin, the thinnest live engagement`
      : avgMarginPct !== null
        ? `Live engagements average ${avgMarginPct}% margin on recorded terms`
        : "No placement terms recorded yet";

  return { margins, avgMarginPct, byOffering, bands, scarcity, headline };
}

/** Guidance for one brief's commercials tab: the band against recorded sector rates and the scarcity case. */
export function pricingGuidance(state: CrmState, requirement: ClientRequirement) {
  const t = state.tessiant;
  if (!t) return null;
  const sectorRates = t.placements
    .filter((placement) => placement.terms?.clientRate?.amount && t.requirements.find((item) => item.id === placement.requirementId)?.sector === requirement.sector)
    .map((placement) => placement.terms.clientRate!.amount)
    .sort((a, b) => a - b);
  const median = sectorRates.length ? sectorRates[Math.floor(sectorRates.length / 2)] : null;
  const scarcity = scarcityPremiums(state).find((item) => item.requirement.id === requirement.id) ?? null;
  const costs = t.candidates
    .filter((candidate) => candidate.requirementId === requirement.id && candidate.validation?.indicativeCost?.amount)
    .map((candidate) => candidate.validation.indicativeCost!.amount);
  const typicalCost = costs.length ? Math.round(costs.reduce((sum, value) => sum + value, 0) / costs.length) : null;
  const suggested = requirement.rateMax && scarcity ? Math.round((requirement.rateMax * (1 + scarcity.premiumPct / 100)) / 10) * 10 : requirement.rateMax ?? null;
  const marginAtSuggested = suggested && typicalCost ? pct(suggested - typicalCost, suggested) : null;
  return { median, sectorSamples: sectorRates.length, scarcity, typicalCost, suggested, marginAtSuggested };
}
