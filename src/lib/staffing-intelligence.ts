// Staffing list-page intelligence: requirements and assignments, derived read-only from CRM state.
// Each signal points at one record so the list page can open it.

import type { CrmState } from "./types";
import type { ClientRequirement, Placement } from "./tessiant-types";
import { assignmentsEndingWithin, pendingRenewals, resolveAssignmentAccountId, upcomingAssignments } from "./assignments";
import { assignmentRenewalStatus, mapRequirementToOpsStage, verifiedAvailableMatchCount } from "./tessiant-insights";
import { daysOpen } from "./requisition";
import { addDays, formatDate, todayKey } from "./format";

export interface RequirementSignal {
  id: string;
  kind: "No coverage" | "Start date passed" | "Starts soon" | "Stalled";
  title: string;
  detail: string;
  requirementId: string;
  actionLabel: string;
}

export interface AssignmentSignal {
  id: string;
  kind: "Ending soon" | "Renewal due" | "Starting soon";
  title: string;
  detail: string;
  assignmentId: string;
  actionLabel: string;
}

function openRequirements(state: CrmState): ClientRequirement[] {
  return (state.tessiant?.requirements ?? []).filter((req) => !req.archived && req.outcome === "active" && req.stage !== "Placed");
}

function clientName(state: CrmState, accountId: string | undefined) {
  return state.tessiant?.accounts.find((item) => item.id === accountId)?.name ?? "Client";
}

export function requirementSignals(state: CrmState, today = todayKey()): RequirementSignal[] {
  const signals: RequirementSignal[] = [];
  const soon = addDays(14, new Date(`${today}T00:00:00`));
  for (const req of openRequirements(state)) {
    const verified = verifiedAvailableMatchCount(state, req.id);
    const stage = mapRequirementToOpsStage(req);
    const base = `${clientName(state, req.accountId)} · ${stage} · starts ${formatDate(req.startDate)}`;
    if (verified === 0) {
      signals.push({
        id: `cover-${req.id}`,
        kind: "No coverage",
        title: req.title,
        detail: `${base}. No verified available match on record, so the brief cannot be delivered as it stands.`,
        requirementId: req.id,
        actionLabel: "Review sourcing",
      });
    } else if (req.startDate < today) {
      signals.push({
        id: `late-${req.id}`,
        kind: "Start date passed",
        title: req.title,
        detail: `${base}. The client start has passed without a placement.`,
        requirementId: req.id,
        actionLabel: "Open requirement",
      });
    } else if (req.startDate <= soon) {
      signals.push({
        id: `soon-${req.id}`,
        kind: "Starts soon",
        title: req.title,
        detail: `${base}. ${verified} verified available to move through interview and commercials in time.`,
        requirementId: req.id,
        actionLabel: "Progress shortlist",
      });
    } else if (daysOpen(req) >= 14 && (req.stage === "New Requirement" || req.stage === "Sourcing")) {
      signals.push({
        id: `stalled-${req.id}`,
        kind: "Stalled",
        title: req.title,
        detail: `${base}. ${daysOpen(req)} days open and still ${req.stage === "Sourcing" ? "sourcing" : "not started"}.`,
        requirementId: req.id,
        actionLabel: "Unblock",
      });
    }
  }
  const rank: Record<RequirementSignal["kind"], number> = { "No coverage": 0, "Start date passed": 1, "Starts soon": 2, Stalled: 3 };
  return signals.sort((a, b) => rank[a.kind] - rank[b.kind]);
}

/** Open positions per sector, with how many verified available associates sit in that sector. */
export function demandBySector(state: CrmState) {
  const rows = new Map<string, { positions: number; requirements: number }>();
  for (const req of openRequirements(state)) {
    const row = rows.get(req.sector) ?? { positions: 0, requirements: 0 };
    row.positions += Math.max(1, req.headcount);
    row.requirements += 1;
    rows.set(req.sector, row);
  }
  const associates = state.tessiant?.associates ?? [];
  return [...rows.entries()]
    .map(([sector, row]) => ({
      sector,
      positions: row.positions,
      requirements: row.requirements,
      verifiedAvailable: associates.filter(
        (item) => item.status === "active" && item.availability === "available" && Boolean(item.verifiedAt) && item.sectors.includes(sector),
      ).length,
    }))
    .sort((a, b) => b.positions - a.positions);
}

function describe(state: CrmState, placement: Placement) {
  const associate = state.tessiant?.associates.find((item) => item.id === placement.associateId);
  const account = clientName(state, resolveAssignmentAccountId(state, placement) ?? undefined);
  return { associate: associate?.name ?? "Associate", account };
}

export function assignmentSignals(state: CrmState, today = todayKey()): AssignmentSignal[] {
  const signals: AssignmentSignal[] = [];
  const seen = new Set<string>();

  for (const placement of pendingRenewals(state, today)) {
    const { associate, account } = describe(state, placement);
    seen.add(placement.id);
    signals.push({
      id: `renewal-${placement.id}`,
      kind: "Renewal due",
      title: `${associate} · ${account}`,
      detail: `Ends ${placement.terms.endDate ? formatDate(placement.terms.endDate) : "soon"} with no extension or redeployment decision recorded.`,
      assignmentId: placement.id,
      actionLabel: "Decide renewal",
    });
  }

  for (const placement of assignmentsEndingWithin(state, 30, today)) {
    if (seen.has(placement.id)) continue;
    const { associate, account } = describe(state, placement);
    seen.add(placement.id);
    signals.push({
      id: `ending-${placement.id}`,
      kind: "Ending soon",
      title: `${associate} · ${account}`,
      detail: `Ends ${placement.terms.endDate ? formatDate(placement.terms.endDate) : "soon"} · ${assignmentRenewalStatus(placement, today).replaceAll("_", " ")}. Plan the next engagement before the bench date.`,
      assignmentId: placement.id,
      actionLabel: "Review assignment",
    });
  }

  for (const placement of upcomingAssignments(state, today, 30)) {
    if (seen.has(placement.id)) continue;
    const { associate, account } = describe(state, placement);
    seen.add(placement.id);
    signals.push({
      id: `start-${placement.id}`,
      kind: "Starting soon",
      title: `${associate} · ${account}`,
      detail: `Starts ${placement.terms.startDate ? formatDate(placement.terms.startDate) : "soon"}. Confirm onboarding, documents and the first invoice period.`,
      assignmentId: placement.id,
      actionLabel: "Prepare start",
    });
  }

  return signals;
}
