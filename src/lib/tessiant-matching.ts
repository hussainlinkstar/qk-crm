// Deterministic Demo V1 matcher — not an AI endpoint.
// Suitability (skills/sector/seniority) is scored separately from availability and rate.

import {
  SHORTLIST_STATUS_LABELS,
  SHORTLIST_STATUSES,
  type Associate,
  type ClientRequirement,
  type MoneyRate,
  type Placement,
  type RequirementCandidate,
  type ShortlistStatus,
} from "./tessiant-types";
import { rolesMatch } from "./talent-network";

export type SuitabilityBand = "strong" | "good" | "partial" | "weak";
export type AvailabilityFit = "available" | "limited" | "unavailable" | "unknown";
export type RateFit = "within_band" | "above_max" | "below_target" | "unknown";

export interface RelevantPlacementSummary {
  id: string;
  requirementTitle: string;
  sector: string;
  status: string;
  startDate: string | null;
}

export interface MatchPresentation {
  associateId: string;
  /** Composite rank score (includes availability penalty for ordering only). */
  matchScore: number;
  /** Skills / sector / seniority / role fit — excludes availability. */
  suitabilityScore: number;
  suitabilityBand: SuitabilityBand;
  skillsMatched: string[];
  skillsMissing: string[];
  preferredMatched: string[];
  sectorMatched: boolean;
  sectorLabel: string;
  associateSectors: string[];
  availabilityFit: AvailabilityFit;
  availabilityLabel: string;
  nextAvailableDate: string | null;
  availabilityConfirmed: boolean;
  rateFit: RateFit;
  rateLabel: string;
  associateRate: MoneyRate | null;
  targetRateMin: number | null;
  targetRateMax: number | null;
  priorPlacementCount: number;
  relevantPlacements: RelevantPlacementSummary[];
  matchReasons: string[];
  matchGaps: string[];
  verificationGaps: string[];
  matchFlags: RequirementCandidate["matchFlags"];
  /** True when skills/sector band is good+ and commercially within band. */
  commerciallySuitable: boolean;
  /** True when available or limited — not the same as suitability. */
  currentlyAvailable: boolean;
}

export interface MatchResult {
  associateId: string;
  matchScore: number;
  matchReasons: string[];
  matchGaps: string[];
  matchFlags: RequirementCandidate["matchFlags"];
  presentation: MatchPresentation;
}

function normalize(value: string) {
  return value.trim().toLowerCase();
}

function skillOverlap(required: string[], have: string[]) {
  const set = new Set(have.map(normalize));
  const hits = required.filter((skill) => set.has(normalize(skill)));
  return { hits, missing: required.filter((skill) => !set.has(normalize(skill))) };
}

function suitabilityBand(score: number): SuitabilityBand {
  if (score >= 75) return "strong";
  if (score >= 55) return "good";
  if (score >= 35) return "partial";
  return "weak";
}

export function suitabilityBandLabel(band: SuitabilityBand) {
  switch (band) {
    case "strong":
      return "Strong suitability";
    case "good":
      return "Good suitability";
    case "partial":
      return "Partial suitability";
    case "weak":
      return "Weak suitability";
  }
}

export function availabilityFitLabel(fit: AvailabilityFit) {
  switch (fit) {
    case "available":
      return "Available now";
    case "limited":
      return "Limited capacity";
    case "unavailable":
      return "Not available";
    case "unknown":
      return "Availability unknown";
  }
}

function relevantPlacementsFor(
  associate: Associate,
  requirement: ClientRequirement,
  placements: Placement[],
  requirements: ClientRequirement[],
): RelevantPlacementSummary[] {
  const reqById = new Map(requirements.map((item) => [item.id, item]));
  return placements
    .filter((placement) => placement.associateId === associate.id)
    .map((placement) => {
      const req = reqById.get(placement.requirementId);
      return {
        id: placement.id,
        requirementTitle: req?.title ?? "Prior placement",
        sector: req?.sector ?? "—",
        status: placement.status,
        startDate: placement.terms.startDate,
      };
    })
    .filter((item) => {
      if (normalize(item.sector) === normalize(requirement.sector)) return true;
      return associate.sectors.some((sector) => normalize(sector) === normalize(requirement.sector));
    })
    .slice(0, 4);
}

export function buildMatchPresentation(
  associate: Associate,
  requirement: ClientRequirement,
  options?: {
    placements?: Placement[];
    requirements?: ClientRequirement[];
    availabilityConfirmed?: boolean;
  },
): MatchPresentation {
  const reasons: string[] = [];
  const gaps: string[] = [];
  const verificationGaps: string[] = [];
  const flags: RequirementCandidate["matchFlags"] = [];

  let suitability = 28;
  let availabilityPenalty = 0;

  if (associate.status === "inactive") {
    flags.push("unavailable");
    gaps.push("Associate marked inactive");
    availabilityPenalty += 25;
  }

  if (!associate.verifiedAt) {
    flags.push("unverified");
    verificationGaps.push("Profile not yet verified");
    gaps.push("Profile not yet verified");
  } else {
    flags.push("verified");
    reasons.push("Verified network profile");
    suitability += 6;
  }

  let availabilityFit: AvailabilityFit = "unknown";
  let availabilityLabel = "Availability unknown — verify before shortlist";
  if (associate.availability === "unavailable") {
    availabilityFit = "unavailable";
    availabilityLabel = `Unavailable until ${associate.nextAvailableDate ?? "unknown"}`;
    flags.push("unavailable");
    gaps.push(availabilityLabel);
    availabilityPenalty += 30;
  } else if (associate.availability === "limited") {
    availabilityFit = "limited";
    availabilityLabel = "Limited capacity — confirm before submitting";
    gaps.push(availabilityLabel);
    availabilityPenalty += 8;
  } else if (associate.availability === "available") {
    availabilityFit = "available";
    availabilityLabel = "Listed as available";
    reasons.push("Currently available (separate from skills fit)");
  } else {
    availabilityFit = "unknown";
    flags.push("missing_data");
    verificationGaps.push("Availability not recorded");
    gaps.push("Availability unknown");
    availabilityPenalty += 5;
  }

  if (options?.availabilityConfirmed) {
    availabilityLabel = `${availabilityLabel} · confirmed for this requisition`;
  }

  if (requirement.roleType !== "any" && !rolesMatch(associate.roleType, requirement.roleType)) {
    gaps.push(`Role type is ${associate.roleType}, request prefers ${requirement.roleType}`);
    suitability -= 10;
  } else if (requirement.roleType !== "any") {
    reasons.push(`Role type match (${associate.roleType})`);
    suitability += 10;
  }

  const seniorityRank: Record<string, number> = { mid: 1, senior: 2, principal: 3, executive: 4 };
  const seniorityDelta = Math.abs((seniorityRank[associate.seniority] ?? 0) - (seniorityRank[requirement.seniority] ?? 0));
  if (seniorityDelta === 0) {
    reasons.push(`Seniority match (${associate.seniority})`);
    suitability += 10;
  } else if (seniorityDelta === 1) {
    reasons.push(`Near seniority fit (${associate.seniority})`);
    suitability += 4;
  } else {
    gaps.push(`Seniority gap (${associate.seniority} vs ${requirement.seniority})`);
    suitability -= 8;
  }

  const must = skillOverlap(requirement.mustHaveSkills, associate.skills);
  if (must.hits.length) {
    reasons.push(`Must-have skills matched: ${must.hits.join(", ")}`);
    suitability += must.hits.length * 12;
  }
  if (must.missing.length) {
    gaps.push(`Missing must-have skills: ${must.missing.join(", ")}`);
    suitability -= must.missing.length * 14;
  }

  const preferred = skillOverlap(requirement.preferredSkills, associate.skills);
  if (preferred.hits.length) {
    reasons.push(`Desirable skills: ${preferred.hits.join(", ")}`);
    suitability += preferred.hits.length * 5;
  }

  const sectorMatched = associate.sectors.some((sector) => normalize(sector) === normalize(requirement.sector));
  if (sectorMatched) {
    reasons.push(`Sector experience: ${requirement.sector}`);
    suitability += 14;
  } else {
    gaps.push(`No listed ${requirement.sector} sector experience`);
    suitability -= 12;
  }

  if (requirement.workingMode !== "flexible") {
    if (associate.workingMode === requirement.workingMode || associate.workingMode === "hybrid") {
      reasons.push(`Working mode compatible (${associate.workingMode})`);
      suitability += 4;
    } else {
      gaps.push(`Working mode ${associate.workingMode} vs request ${requirement.workingMode}`);
      suitability -= 4;
    }
  }

  let rateFit: RateFit = "unknown";
  let rateLabel = "Indicative rate not recorded — verify commercially";
  if (!associate.rate) {
    flags.push("missing_data");
    verificationGaps.push("Indicative rate not recorded");
    gaps.push("Indicative rate not recorded");
  } else if (requirement.rateMax != null && associate.rate.amount > requirement.rateMax) {
    rateFit = "above_max";
    rateLabel = `Rate ${associate.rate.amount} above client max ${requirement.rateMax}`;
    gaps.push(rateLabel);
  } else if (requirement.rateMin != null && associate.rate.amount < requirement.rateMin * 0.7) {
    rateFit = "below_target";
    rateLabel = `Rate below usual band (min ${requirement.rateMin}) — confirm level`;
    reasons.push("Rate under target band");
  } else {
    rateFit = "within_band";
    rateLabel = "Rate within client budget band";
    reasons.push("Rate within target band");
    suitability += 4;
  }

  if (!associate.cvRef) verificationGaps.push("CV reference missing");
  if (!associate.email && !associate.phone) verificationGaps.push("No contact details on profile");

  const relevant = relevantPlacementsFor(
    associate,
    requirement,
    options?.placements ?? [],
    options?.requirements ?? [],
  );
  if (associate.priorPlacementCount > 0) {
    reasons.push(`${associate.priorPlacementCount} prior placement${associate.priorPlacementCount === 1 ? "" : "s"} on record`);
    suitability += Math.min(10, associate.priorPlacementCount * 2);
  }
  if (relevant.length) {
    reasons.push(`${relevant.length} prior placement(s) relevant to this sector/request`);
  }

  const suitabilityScore = Math.max(0, Math.min(100, Math.round(suitability)));
  const matchScore = Math.max(0, Math.min(100, Math.round(suitability - availabilityPenalty)));
  const band = suitabilityBand(suitabilityScore);
  const commerciallySuitable = (band === "strong" || band === "good") && (rateFit === "within_band" || rateFit === "below_target");
  const currentlyAvailable = availabilityFit === "available" || availabilityFit === "limited";

  return {
    associateId: associate.id,
    matchScore,
    suitabilityScore,
    suitabilityBand: band,
    skillsMatched: must.hits,
    skillsMissing: must.missing,
    preferredMatched: preferred.hits,
    sectorMatched,
    sectorLabel: sectorMatched ? `Experience in ${requirement.sector}` : `No listed ${requirement.sector} experience`,
    associateSectors: associate.sectors,
    availabilityFit,
    availabilityLabel,
    nextAvailableDate: associate.nextAvailableDate,
    availabilityConfirmed: Boolean(options?.availabilityConfirmed),
    rateFit,
    rateLabel,
    associateRate: associate.rate,
    targetRateMin: requirement.rateMin,
    targetRateMax: requirement.rateMax,
    priorPlacementCount: associate.priorPlacementCount,
    relevantPlacements: relevant,
    matchReasons: reasons,
    matchGaps: gaps,
    verificationGaps: [...new Set(verificationGaps)],
    matchFlags: [...new Set(flags)],
    commerciallySuitable,
    currentlyAvailable,
  };
}

export function matchAssociateToRequirement(
  associate: Associate,
  requirement: ClientRequirement,
  options?: {
    placements?: Placement[];
    requirements?: ClientRequirement[];
    availabilityConfirmed?: boolean;
  },
): MatchResult {
  const presentation = buildMatchPresentation(associate, requirement, options);
  return {
    associateId: associate.id,
    matchScore: presentation.matchScore,
    matchReasons: presentation.matchReasons,
    matchGaps: presentation.matchGaps,
    matchFlags: presentation.matchFlags,
    presentation,
  };
}

export function rankMatches(
  associates: Associate[],
  requirement: ClientRequirement,
  options?: { placements?: Placement[]; requirements?: ClientRequirement[] },
): MatchResult[] {
  return associates
    .filter((associate) => associate.status !== "inactive")
    .map((associate) => matchAssociateToRequirement(associate, requirement, options))
    .sort((a, b) => b.matchScore - a.matchScore || a.associateId.localeCompare(b.associateId));
}

export function estimatedMargin(
  cost: { amount: number; unit: string; currency: string } | null | undefined,
  client: { amount: number; unit: string; currency: string } | null | undefined,
): { label: string; amount: number | null; pct: number | null } {
  if (!cost || !client) return { label: "Not available", amount: null, pct: null };
  if (cost.unit !== client.unit || cost.currency !== client.currency) {
    return { label: "Not available", amount: null, pct: null };
  }
  const amount = client.amount - cost.amount;
  const pct = client.amount === 0 ? null : Math.round((amount / client.amount) * 100);
  return { label: "Estimated margin", amount, pct };
}

const LEGACY_SHORTLIST: Record<string, ShortlistStatus> = {
  validating: "availability_confirmed",
  quoted: "offer",
  selected: "offer",
  withdrawn: "rejected",
};

export function shortlistLabel(status: ShortlistStatus | string): string {
  const normalized = (SHORTLIST_STATUSES as readonly string[]).includes(status)
    ? (status as ShortlistStatus)
    : (LEGACY_SHORTLIST[status] ?? "suggested");
  return SHORTLIST_STATUS_LABELS[normalized];
}
