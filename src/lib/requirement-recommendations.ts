// Compact recommended-match views over the existing Tessiant matcher.
// No new scoring — rankMatches / buildMatchPresentation only.

import { buildMatchPresentation, rankMatches, type MatchPresentation, type MatchResult } from "./tessiant-matching";
import { roleLabel } from "./talent-network";
import { verifiedAvailableMatchCount } from "./tessiant-insights";
import { candidateStatusLabel, normalizeCandidateStatus } from "./requisition";
import type { CrmState } from "./types";
import type { Associate, ClientRequirement, RequirementCandidate, ShortlistStatus } from "./tessiant-types";

export const SHORTLIST_READY_STATUSES: ShortlistStatus[] = ["suggested", "contacted", "rejected"];

export interface RecommendedMatch {
  associate: Associate;
  presentation: MatchPresentation;
  candidate: RequirementCandidate | null;
  reason: string;
  missingSkills: string[];
  unavailable: boolean;
  unverified: boolean;
  canShortlist: boolean;
  pipelineLabel: string | null;
}

export interface RecommendedMatchSet {
  items: RecommendedMatch[];
  verifiedCount: number;
  emptyMessage: string | null;
}

function oneLineReason(presentation: MatchPresentation): string {
  const skills = presentation.skillsMatched.slice(0, 2).join(" and ");
  if (presentation.skillsMissing.length && skills) {
    return `${skills} on record; missing ${presentation.skillsMissing.join(", ")}.`;
  }
  if (presentation.skillsMissing.length) {
    return `Missing mandatory skill${presentation.skillsMissing.length > 1 ? "s" : ""}: ${presentation.skillsMissing.join(", ")}.`;
  }
  if (skills && presentation.sectorMatched) {
    return `${skills} · ${presentation.sectorLabel}.`;
  }
  return (
    presentation.matchReasons.find((row) => /skill|sector|role|available/i.test(row)) ??
    presentation.matchReasons[0] ??
    "Ranked by the existing Tessiant matcher."
  );
}

function toRecommended(
  state: CrmState,
  requirement: ClientRequirement,
  match: MatchResult,
): RecommendedMatch | null {
  const associate = state.tessiant?.associates.find((item) => item.id === match.associateId);
  if (!associate) return null;
  const candidate =
    (state.tessiant?.candidates ?? []).find(
      (item) => item.requirementId === requirement.id && item.associateId === associate.id,
    ) ?? null;
  const status = candidate ? normalizeCandidateStatus(candidate.shortlistStatus) : null;
  const presentation = buildMatchPresentation(associate, requirement, {
    placements: state.tessiant?.placements,
    requirements: state.tessiant?.requirements,
    availabilityConfirmed: candidate?.validation.availabilityConfirmed,
  });
  return {
    associate,
    presentation,
    candidate,
    reason: oneLineReason(presentation),
    missingSkills: presentation.skillsMissing,
    unavailable: presentation.availabilityFit === "unavailable",
    unverified: presentation.verificationGaps.length > 0 || presentation.matchFlags.includes("unverified"),
    canShortlist: !status || SHORTLIST_READY_STATUSES.includes(status),
    pipelineLabel: status && !SHORTLIST_READY_STATUSES.includes(status) ? candidateStatusLabel(status) : null,
  };
}

export function recommendedMatches(state: CrmState, requirement: ClientRequirement, limit = 3): RecommendedMatchSet {
  const tessiant = state.tessiant;
  if (!tessiant) {
    return {
      items: [],
      verifiedCount: 0,
      emptyMessage: "No verified available matches. Review near-matches or create a sourcing task.",
    };
  }
  const ranked = rankMatches(tessiant.associates, requirement, {
    placements: tessiant.placements,
    requirements: tessiant.requirements,
  });
  const preferred = ranked.filter((item) => item.presentation.suitabilityBand !== "weak");
  const source = (preferred.length ? preferred : ranked).slice(0, limit);
  const items = source
    .map((item) => toRecommended(state, requirement, item))
    .filter((item): item is RecommendedMatch => Boolean(item));
  const preview = requirement.id.startsWith("preview-");
  const verifiedCount = preview
    ? items.filter(
        (item) =>
          item.associate.verifiedAt &&
          item.associate.availability === "available" &&
          item.associate.status === "active" &&
          item.presentation.suitabilityBand !== "weak",
      ).length
    : verifiedAvailableMatchCount(state, requirement.id);
  return {
    items,
    verifiedCount,
    emptyMessage:
      verifiedCount === 0
        ? "No verified available matches. Review near-matches or create a sourcing task."
        : null,
  };
}

export function clientShortlistSummary(state: CrmState, requirement: ClientRequirement): RecommendedMatch[] {
  const rows = (state.tessiant?.candidates ?? []).filter((candidate) => {
    if (candidate.requirementId !== requirement.id) return false;
    const status = normalizeCandidateStatus(candidate.shortlistStatus);
    return status === "shortlisted" || status === "submitted_to_client" || status === "interview" || status === "offer";
  });
  return rows
    .map((candidate) => {
      const associate = state.tessiant?.associates.find((item) => item.id === candidate.associateId);
      if (!associate) return null;
      const match = rankMatches([associate], requirement, {
        placements: state.tessiant?.placements,
        requirements: state.tessiant?.requirements,
      })[0];
      if (!match) return null;
      return toRecommended(state, requirement, match);
    })
    .filter((item): item is RecommendedMatch => Boolean(item));
}

export function roleTitleFor(associate: Associate) {
  return associate.headline || roleLabel(associate.roleType);
}
