// Assignment intelligence — renewal and redeployment from existing records only.
// No invented contract extensions, no pipeline treated as realised revenue.

import { useSyncExternalStore } from "react";
import {
  assignmentCapacity,
  associateCommittedCapacity,
  deriveAssignmentStatus,
  isLiveAssignment,
} from "./assignments";
import { addDays, formatDate, todayKey } from "./format";
import { rankMatches } from "./tessiant-matching";
import type { CrmState } from "./types";
import type { Associate, ClientRequirement, Placement } from "./tessiant-types";

export type AssignmentRecKind = "renewal" | "redeploy";
export type AssignmentRecStatus = "new" | "actioned" | "dismissed";

export interface AssignmentRecommendation {
  id: string;
  kind: AssignmentRecKind;
  assignmentId: string;
  associateId: string;
  requirementId: string | null;
  matchRequirementId: string | null;
  accountId: string | null;
  detected: string;
  why: string;
  actionLabel: string;
  sourceLabel: string;
  assignmentHref: string;
  actionHref: string;
}

const STORAGE_KEY = "qiko-assignment-rec-status";
const ENDING_DAYS = 30;
const MIN_REMAINING = 40;
const MAX_CARDS = 3;

type StatusMap = Record<string, AssignmentRecStatus>;

let statusCache: StatusMap | null = null;
const statusListeners = new Set<() => void>();

function readStatusMap(): StatusMap {
  if (statusCache) return statusCache;
  if (typeof window === "undefined") return {};
  try {
    statusCache = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}") as StatusMap;
  } catch {
    statusCache = {};
  }
  return statusCache;
}

function writeStatusMap(next: StatusMap) {
  statusCache = next;
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }
  statusListeners.forEach((listener) => listener());
}

function subscribeRecStatus(listener: () => void) {
  statusListeners.add(listener);
  return () => {
    statusListeners.delete(listener);
  };
}

export function useAssignmentRecStatuses(): StatusMap {
  return useSyncExternalStore(subscribeRecStatus, readStatusMap, () => ({}));
}

export function setAssignmentRecStatus(id: string, status: AssignmentRecStatus) {
  writeStatusMap({ ...readStatusMap(), [id]: status });
}

function openRequirements(state: CrmState): ClientRequirement[] {
  return (state.tessiant?.requirements ?? []).filter(
    (req) => !req.archived && req.outcome === "active" && req.stage !== "Placed",
  );
}

function accountName(state: CrmState, accountId: string | null | undefined) {
  if (!accountId) return "the client";
  return state.tessiant?.accounts.find((item) => item.id === accountId)?.name ?? "the client";
}

function resolveAccountId(state: CrmState, placement: Placement) {
  if (placement.accountId) return placement.accountId;
  return state.tessiant?.requirements.find((item) => item.id === placement.requirementId)?.accountId ?? null;
}

function remainingNow(state: CrmState, associateId: string, today: string) {
  return Math.max(0, 100 - associateCommittedCapacity(state, associateId, today));
}

/** Confirmed extend / wind-down — not a "possible extension" signal. */
export function hasRenewalDecision(placement: Placement): boolean {
  if (placement.assignmentStatus === "extended") return true;
  if (placement.renewalStatus === "ending") return true;
  return (placement.engagementNotes ?? []).some((note) => {
    if (note.kind !== "renewal" && note.kind !== "status") return false;
    return /\bextended\b|\bwill not renew\b|renewal agreed|client confirmed (the )?extension/i.test(note.body);
  });
}

export function assignmentsApproachingEnd(state: CrmState, today = todayKey()): Placement[] {
  const horizon = addDays(ENDING_DAYS);
  return (state.tessiant?.placements ?? []).filter((placement) => {
    if (!isLiveAssignment(placement, today)) return false;
    const status = deriveAssignmentStatus(placement, today);
    if (status === "upcoming" && (!placement.terms.startDate || placement.terms.startDate > today)) {
      // Upcoming work that has not started is not an ending assignment.
      return false;
    }
    const end = placement.terms.endDate;
    return Boolean(end && end >= today && end <= horizon);
  });
}

function canRedeployOnto(
  state: CrmState,
  associate: Associate,
  placement: Placement,
  requirement: ClientRequirement,
  today: string,
): boolean {
  if (requirement.id === placement.requirementId) return false;
  const end = placement.terms.endDate;
  const start = requirement.startDate;
  const remaining = remainingNow(state, associate.id, today);
  const remainingAfterThisEnds = Math.min(100, remaining + assignmentCapacity(placement));

  if (associate.availability === "unavailable") {
    const freeFrom = associate.nextAvailableDate ?? end;
    if (start && freeFrom && start < freeFrom && remaining < MIN_REMAINING) return false;
  }

  if (start && end && start > end) {
    return remainingAfterThisEnds >= MIN_REMAINING;
  }
  return remaining >= MIN_REMAINING;
}

function bestRedeployMatch(
  state: CrmState,
  associate: Associate,
  placement: Placement,
  today: string,
): { requirement: ClientRequirement; skills: string[] } | null {
  const tessiant = state.tessiant;
  if (!tessiant) return null;
  let best: { requirement: ClientRequirement; skills: string[]; score: number } | null = null;
  for (const requirement of openRequirements(state)) {
    if (!canRedeployOnto(state, associate, placement, requirement, today)) continue;
    const ranked = rankMatches([associate], requirement, {
      placements: tessiant.placements,
      requirements: tessiant.requirements,
    });
    const match = ranked[0];
    if (!match) continue;
    const band = match.presentation.suitabilityBand;
    if (band === "weak") continue;
    if (match.presentation.skillsMatched.length === 0) continue;
    const score = match.presentation.suitabilityScore;
    if (!best || score > best.score) {
      best = { requirement, skills: match.presentation.skillsMatched, score };
    }
  }
  return best ? { requirement: best.requirement, skills: best.skills } : null;
}

function renewalRec(state: CrmState, placement: Placement, associate: Associate): AssignmentRecommendation {
  const accountId = resolveAccountId(state, placement);
  const client = accountName(state, accountId);
  const end = placement.terms.endDate;
  return {
    id: `renewal:${placement.id}`,
    kind: "renewal",
    assignmentId: placement.id,
    associateId: associate.id,
    requirementId: placement.requirementId,
    matchRequirementId: null,
    accountId,
    detected: end
      ? `${associate.name}'s assignment at ${client} ends ${formatDate(end)}.`
      : `${associate.name}'s assignment at ${client} is ending soon.`,
    why: `Confirm whether the client wants to extend. No renewal decision is recorded — this is not a confirmed contract extension.`,
    actionLabel: "Create renewal follow-up",
    sourceLabel: `${associate.name} · ${client}${end ? ` · ends ${formatDate(end)}` : ""}`,
    assignmentHref: `/staffing/placements/${placement.id}`,
    actionHref: `/staffing/placements/${placement.id}`,
  };
}

function redeployRec(
  state: CrmState,
  placement: Placement,
  associate: Associate,
  match: { requirement: ClientRequirement; skills: string[] },
): AssignmentRecommendation {
  const accountId = resolveAccountId(state, placement);
  const client = accountName(state, accountId);
  const matchAccount = accountName(state, match.requirement.accountId);
  const skills = match.skills.slice(0, 2).join(" and ");
  return {
    id: `redeploy:${placement.id}:${match.requirement.id}`,
    kind: "redeploy",
    assignmentId: placement.id,
    associateId: associate.id,
    requirementId: placement.requirementId,
    matchRequirementId: match.requirement.id,
    accountId,
    detected: `${associate.name} may fit ${match.requirement.title} at ${matchAccount}.`,
    why: `${associate.name} has ${skills || "relevant skills"} on record. Remaining capacity after the ${client} assignment ends can cover ${match.requirement.title} at ${matchAccount}. This is a possible fit, not a placement.`,
    actionLabel: "Review matching requirement",
    sourceLabel: `${associate.name} · ${match.requirement.title}`,
    assignmentHref: `/staffing/placements/${placement.id}`,
    actionHref: `/staffing/requirements/${match.requirement.id}`,
  };
}

export function assignmentRecommendations(state: CrmState, today = todayKey()): AssignmentRecommendation[] {
  const tessiant = state.tessiant;
  if (!tessiant) return [];

  const ending = assignmentsApproachingEnd(state, today);
  const seen = new Set<string>();
  const recs: AssignmentRecommendation[] = [];

  for (const placement of ending) {
    const associate = tessiant.associates.find((item) => item.id === placement.associateId);
    if (!associate || associate.status === "inactive") continue;
    if (hasRenewalDecision(placement)) continue;
    const rec = renewalRec(state, placement, associate);
    if (seen.has(rec.id)) continue;
    seen.add(rec.id);
    recs.push(rec);
    if (recs.length >= MAX_CARDS) return recs;
  }

  for (const placement of ending) {
    if (recs.length >= MAX_CARDS) break;
    const associate = tessiant.associates.find((item) => item.id === placement.associateId);
    if (!associate || associate.status === "inactive") continue;
    const match = bestRedeployMatch(state, associate, placement, today);
    if (!match) continue;
    const rec = redeployRec(state, placement, associate, match);
    if (seen.has(rec.id) || seen.has(`redeploy:${placement.id}`)) continue;
    seen.add(rec.id);
    seen.add(`redeploy:${placement.id}`);
    recs.push(rec);
  }

  return recs;
}

export function recommendationStatus(
  rec: AssignmentRecommendation,
  stored: StatusMap,
  state: CrmState,
): AssignmentRecStatus {
  const saved = stored[rec.id];
  if (saved === "dismissed" || saved === "actioned") return saved;
  if (rec.kind === "renewal") {
    const placement = state.tessiant?.placements.find((item) => item.id === rec.assignmentId);
    if (placement?.followUpTaskId) return "actioned";
  }
  return "new";
}

export function recommendationsForAssignment(
  state: CrmState,
  assignmentId: string,
  today = todayKey(),
): AssignmentRecommendation[] {
  return assignmentRecommendations(state, today).filter((item) => item.assignmentId === assignmentId);
}
