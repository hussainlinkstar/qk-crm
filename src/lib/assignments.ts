// Assignment & deployment helpers — post-placement lifecycle for staff augmentation.

import type { CrmState } from "./types";
import {
  ASSIGNMENT_STATUS_LABELS,
  type Assignment,
  type AssignmentStatus,
  type AvailabilityStatus,
  type Placement,
} from "./tessiant-types";
import { addDays, todayKey } from "./format";

export function assignmentCapacity(assignment: Placement) {
  return assignment.capacityPercent ?? 100;
}

export function deriveAssignmentStatus(assignment: Placement, today = todayKey()): AssignmentStatus {
  if (assignment.assignmentStatus === "cancelled") return "cancelled";
  if (
    assignment.assignmentStatus === "completed" ||
    assignment.status === "closed" ||
    assignment.outcome === "completed" ||
    assignment.outcome === "ended_early"
  ) {
    return "completed";
  }
  if (assignment.assignmentStatus === "extended") return "extended";
  const start = assignment.terms.startDate;
  if (start && start > today) return "upcoming";
  if (assignment.assignmentStatus === "upcoming" && start && start <= today) return "active";
  return assignment.assignmentStatus ?? "active";
}

export function assignmentStatusLabel(status: AssignmentStatus | string) {
  return ASSIGNMENT_STATUS_LABELS[status as AssignmentStatus] ?? status;
}

export function isLiveAssignment(assignment: Placement, today = todayKey()) {
  const status = deriveAssignmentStatus(assignment, today);
  return status === "upcoming" || status === "active" || status === "extended";
}

export function isDeployedAssignment(assignment: Placement, today = todayKey()) {
  const status = deriveAssignmentStatus(assignment, today);
  return status === "active" || status === "extended";
}

/** Active / live deployments (not completed or cancelled). */
export function liveAssignments(state: CrmState, today = todayKey()): Assignment[] {
  const t = state.tessiant;
  if (!t) return [];
  return t.placements.filter((item) => isLiveAssignment(item, today));
}

export function deployedAssignments(state: CrmState, today = todayKey()): Assignment[] {
  return liveAssignments(state, today).filter((item) => isDeployedAssignment(item, today));
}

export function upcomingAssignments(state: CrmState, today = todayKey(), withinDays = 30): Assignment[] {
  const horizon = addDays(withinDays);
  return liveAssignments(state, today).filter((item) => {
    const status = deriveAssignmentStatus(item, today);
    if (status !== "upcoming") return false;
    const start = item.terms.startDate;
    return Boolean(start && start >= today && start <= horizon);
  });
}

export function assignmentsEndingWithin(state: CrmState, days: number, today = todayKey()): Assignment[] {
  const horizon = addDays(days);
  return liveAssignments(state, today).filter((item) => {
    const end = item.terms.endDate;
    return Boolean(end && end >= today && end <= horizon);
  });
}

export function pendingRenewals(state: CrmState, today = todayKey()): Assignment[] {
  return liveAssignments(state, today).filter((item) => {
    if (item.renewalStatus === "renewal_due" || item.renewalStatus === "ending") return true;
    const end = item.terms.endDate;
    const renewal = item.renewalDate;
    if (renewal && renewal <= addDays(30) && renewal >= today) return true;
    return Boolean(end && end >= today && end <= addDays(30));
  });
}

export function completedAssignments(state: CrmState): Assignment[] {
  const t = state.tessiant;
  if (!t) return [];
  return t.placements.filter((item) => deriveAssignmentStatus(item) === "completed");
}

export function assignmentDashboard(state: CrmState, today = todayKey()) {
  const live = liveAssignments(state, today);
  const deployed = deployedAssignments(state, today);
  const deployedAssociateIds = new Set(deployed.map((item) => item.associateId));
  const clientIds = new Set(
    deployed
      .map((item) => item.accountId ?? state.tessiant?.requirements.find((r) => r.id === item.requirementId)?.accountId)
      .filter(Boolean) as string[],
  );
  return {
    active: deployed.length,
    live: live.length,
    deployedAssociates: deployedAssociateIds.size,
    clientsWithDeployments: clientIds.size,
    startingSoon: upcomingAssignments(state, today, 30).length,
    ending30: assignmentsEndingWithin(state, 30, today).length,
    ending60: assignmentsEndingWithin(state, 60, today).length,
    renewals: pendingRenewals(state, today).length,
    completed: completedAssignments(state).length,
  };
}

export type AssignmentListView =
  | "all"
  | "active"
  | "upcoming"
  | "ending30"
  | "ending60"
  | "renewals"
  | "completed"
  | "clients";

export function filterAssignments(state: CrmState, view: AssignmentListView | string | null, today = todayKey()) {
  const t = state.tessiant;
  if (!t) return [];
  switch (view) {
    case "active":
      return deployedAssignments(state, today).sort(byEnd);
    case "upcoming":
      return upcomingAssignments(state, today, 90).sort(byStart);
    case "ending30":
    case "ending":
      return assignmentsEndingWithin(state, 30, today).sort(byEnd);
    case "ending60":
      return assignmentsEndingWithin(state, 60, today).sort(byEnd);
    case "renewals":
      return pendingRenewals(state, today).sort(byEnd);
    case "completed":
      return completedAssignments(state).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    default:
      return [...t.placements].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }
}

function byEnd(a: Placement, b: Placement) {
  return (a.terms.endDate ?? "9999").localeCompare(b.terms.endDate ?? "9999");
}

function byStart(a: Placement, b: Placement) {
  return (a.terms.startDate ?? "9999").localeCompare(b.terms.startDate ?? "9999");
}

export function resolveAssignmentAccountId(state: CrmState, assignment: Placement) {
  if (assignment.accountId) return assignment.accountId;
  return state.tessiant?.requirements.find((item) => item.id === assignment.requirementId)?.accountId ?? null;
}

export function assignmentRoleTitle(state: CrmState, assignment: Placement) {
  if (assignment.roleTitle) return assignment.roleTitle;
  return state.tessiant?.requirements.find((item) => item.id === assignment.requirementId)?.title ?? "Assignment";
}

/** Total committed capacity for an associate across confirmed live assignments (including upcoming). */
export function associateCommittedCapacity(state: CrmState, associateId: string, today = todayKey()) {
  return liveAssignments(state, today)
    .filter((item) => item.associateId === associateId)
    .reduce((sum, item) => sum + assignmentCapacity(item), 0);
}

/**
 * Availability reflecting agreed commitment — not a blanket unavailable flag.
 * Full (100%+) → unavailable; partial → limited; none → leave unchanged / available.
 */
export function availabilityFromCapacity(committedPercent: number): AvailabilityStatus | null {
  if (committedPercent >= 100) return "unavailable";
  if (committedPercent >= 40) return "limited";
  if (committedPercent > 0) return "limited";
  return null;
}

export interface ClientDeploymentRow {
  accountId: string;
  accountName: string;
  assignments: Assignment[];
  associateCount: number;
  endingSoonCount: number;
  renewalCount: number;
  freeingSoon: Assignment[];
}

export function clientDeploymentViews(state: CrmState, today = todayKey()): ClientDeploymentRow[] {
  const t = state.tessiant;
  if (!t) return [];
  const live = liveAssignments(state, today);
  const byAccount = new Map<string, Assignment[]>();
  for (const assignment of live) {
    const accountId = resolveAssignmentAccountId(state, assignment);
    if (!accountId) continue;
    const list = byAccount.get(accountId) ?? [];
    list.push(assignment);
    byAccount.set(accountId, list);
  }
  const renewals = new Set(pendingRenewals(state, today).map((item) => item.id));
  const ending = new Set(assignmentsEndingWithin(state, 30, today).map((item) => item.id));

  return [...byAccount.entries()]
    .map(([accountId, assignments]) => {
      const account = t.accounts.find((item) => item.id === accountId);
      const freeingSoon = assignments.filter((item) => ending.has(item.id));
      return {
        accountId,
        accountName: account?.name ?? accountId,
        assignments: assignments.sort(byEnd),
        associateCount: new Set(assignments.map((item) => item.associateId)).size,
        endingSoonCount: freeingSoon.length,
        renewalCount: assignments.filter((item) => renewals.has(item.id)).length,
        freeingSoon,
      };
    })
    .sort((a, b) => a.accountName.localeCompare(b.accountName));
}

export function enrichAssignmentDefaults(
  assignment: Placement,
  context: { accountId: string; roleTitle: string; ownerId: string | null; workingPattern: Placement["workingPattern"] },
): Placement {
  return {
    ...assignment,
    accountId: assignment.accountId ?? context.accountId,
    roleTitle: assignment.roleTitle ?? context.roleTitle,
    ownerId: assignment.ownerId ?? context.ownerId,
    workingPattern: assignment.workingPattern ?? context.workingPattern ?? "hybrid",
    capacityPercent: assignment.capacityPercent ?? 100,
    renewalDate: assignment.renewalDate ?? assignment.terms.endDate,
    assignmentStatus: assignment.assignmentStatus ?? deriveAssignmentStatus(assignment),
    documents: assignment.documents ?? [],
    engagementNotes: assignment.engagementNotes ?? [],
  };
}
