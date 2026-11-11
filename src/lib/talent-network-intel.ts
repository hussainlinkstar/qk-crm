// Talent Network intelligence — evidence from CRM records only. No external sources.

import { isLiveAssignment } from "./assignments";
import { addDays, todayKey } from "./format";
import { rankMatches } from "./tessiant-matching";
import type { CrmState } from "./types";
import type { Associate, Placement } from "./tessiant-types";

export const TALENT_INTEL_FINDINGS = ["availability", "assignments", "req_matches"] as const;
export type TalentIntelFinding = (typeof TALENT_INTEL_FINDINGS)[number];

export interface TalentIntelCard {
  id: TalentIntelFinding;
  title: string;
  count: number;
  explanation: string;
  action: string;
  kind: "conflict" | "verify" | "match";
}

function openRequirements(state: CrmState) {
  return (state.tessiant?.requirements ?? []).filter(
    (req) => !req.archived && req.outcome === "active" && req.stage !== "Placed",
  );
}

function liveForAssociate(state: CrmState, associateId: string, today: string): Placement[] {
  return (state.tessiant?.placements ?? []).filter(
    (placement) => placement.associateId === associateId && isLiveAssignment(placement, today),
  );
}

export function availabilityAttentionReason(associate: Associate, today = todayKey()): "unknown" | "outdated" | null {
  if (associate.status === "inactive") return null;
  if (associate.availability === "unknown") return "unknown";
  const updated = associate.profileUpdatedAt?.slice(0, 10);
  if (!updated || updated < addDays(-90, new Date(`${today}T00:00:00`))) return "outdated";
  if (associate.nextAvailableDate && associate.nextAvailableDate < today && associate.availability !== "available") {
    return "outdated";
  }
  return null;
}

export function assignmentAttentionKind(
  state: CrmState,
  associate: Associate,
  today = todayKey(),
): "conflict" | "verify" | null {
  if (associate.status === "inactive") return null;
  const live = liveForAssociate(state, associate.id, today);
  if (live.length === 0) return null;

  let conflict = false;
  let verify = false;
  for (const placement of live) {
    const capacity = placement.capacityPercent ?? 100;
    if (capacity >= 100 && associate.availability === "available") conflict = true;
    if ((placement.documents ?? []).length === 0) verify = true;
    if (!placement.terms.associateCost || !placement.terms.clientRate) verify = true;
    if (placement.renewalStatus === "renewal_due" && !placement.confirmedAvailableDate) verify = true;
  }
  if (conflict) return "conflict";
  if (verify) return "verify";
  return null;
}

export function availableMatchingRequirementIds(state: CrmState): Set<string> {
  const associates = state.tessiant?.associates ?? [];
  const placements = state.tessiant?.placements ?? [];
  const requirements = state.tessiant?.requirements ?? [];
  const ids = new Set<string>();
  for (const requirement of openRequirements(state)) {
    const ranked = rankMatches(associates, requirement, { placements, requirements });
    for (const match of ranked) {
      const { currentlyAvailable, suitabilityBand } = match.presentation;
      if (currentlyAvailable && (suitabilityBand === "strong" || suitabilityBand === "good")) {
        ids.add(match.associateId);
      }
    }
  }
  return ids;
}

export function talentIntelAssociateIds(state: CrmState, finding: TalentIntelFinding, today = todayKey()): Set<string> {
  const ids = new Set<string>();
  if (finding === "req_matches") return availableMatchingRequirementIds(state);
  for (const associate of state.tessiant?.associates ?? []) {
    if (finding === "availability" && availabilityAttentionReason(associate, today)) ids.add(associate.id);
    if (finding === "assignments" && assignmentAttentionKind(state, associate, today)) ids.add(associate.id);
  }
  return ids;
}

export function talentNetworkIntel(state: CrmState, today = todayKey()): TalentIntelCard[] {
  const associates = state.tessiant?.associates ?? [];
  let unknown = 0;
  let outdated = 0;
  let conflicts = 0;
  let verify = 0;
  for (const associate of associates) {
    const availability = availabilityAttentionReason(associate, today);
    if (availability === "unknown") unknown += 1;
    else if (availability === "outdated") outdated += 1;
    const assignment = assignmentAttentionKind(state, associate, today);
    if (assignment === "conflict") conflicts += 1;
    else if (assignment === "verify") verify += 1;
  }
  const matches = availableMatchingRequirementIds(state).size;
  const openReqCount = openRequirements(state).length;
  const cards: TalentIntelCard[] = [];

  const availabilityCount = unknown + outdated;
  if (availabilityCount > 0) {
    const detail =
      unknown && outdated
        ? `${unknown} unknown, ${outdated} last confirmed over 90 days ago.`
        : unknown
          ? "Availability is recorded as unknown — confirm before shortlisting."
          : "Last confirmed more than 90 days ago — verify before using.";
    cards.push({
      id: "availability",
      title: "Availability to confirm",
      count: availabilityCount,
      explanation: detail,
      action: "Review profiles",
      kind: "verify",
    });
  }

  const assignmentCount = conflicts + verify;
  if (assignmentCount > 0) {
    const explanation = conflicts
      ? `${conflicts} confirmed ${conflicts === 1 ? "inconsistency" : "inconsistencies"} (listed available while fully deployed)${verify ? `; ${verify} more need verification` : ""}.`
      : "Assignment documents or renewal dates are unconfirmed — not a proven conflict.";
    cards.push({
      id: "assignments",
      title: "Assignment records to verify",
      count: assignmentCount,
      explanation,
      action: "Review assignments",
      kind: conflicts ? "conflict" : "verify",
    });
  }

  if (matches > 0 && openReqCount > 0) {
    cards.push({
      id: "req_matches",
      title: "Available for open requirements",
      count: matches,
      explanation: `${matches} available associate${matches === 1 ? "" : "s"} match ${openReqCount} open client requirement${openReqCount === 1 ? "" : "s"} on recorded skills and sector.`,
      action: "Review matches",
      kind: "match",
    });
  }

  return cards.slice(0, 3);
}
