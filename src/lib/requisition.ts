// Client requirement / requisition helpers — list metrics, filters, candidate actions.

import type { CrmState } from "./types";
import {
  OPS_PIPELINE_STAGES,
  SHORTLIST_STATUS_LABELS,
  SHORTLIST_STATUSES,
  type ClientRequirement,
  type OpsPipelineStage,
  type RequirementCandidate,
  type RequirementCategory,
  type RequirementOutcome,
  type RequirementPriority,
  type RequirementStage,
  type ShortlistStatus,
} from "./tessiant-types";
import { mapRequirementToOpsStage } from "./tessiant-insights";
import { todayKey } from "./format";

const LEGACY_STATUS: Record<string, ShortlistStatus> = {
  validating: "availability_confirmed",
  quoted: "offer",
  selected: "offer",
  withdrawn: "rejected",
};

export function normalizeCandidateStatus(status: string): ShortlistStatus {
  if ((SHORTLIST_STATUSES as readonly string[]).includes(status)) return status as ShortlistStatus;
  return LEGACY_STATUS[status] ?? "suggested";
}

export function candidateStatusLabel(status: string) {
  return SHORTLIST_STATUS_LABELS[normalizeCandidateStatus(status)];
}

export function daysOpen(req: ClientRequirement, today = todayKey()) {
  const start = (req.requestDate || req.createdAt.slice(0, 10)).slice(0, 10);
  const a = new Date(`${start}T00:00:00`).getTime();
  const b = new Date(`${today}T00:00:00`).getTime();
  return Math.max(0, Math.round((b - a) / 86_400_000));
}

export interface RequisitionCounts {
  shortlisted: number;
  interviewed: number;
  offered: number;
  filled: number;
  suggested: number;
  rejected: number;
  total: number;
}

export function requisitionCounts(state: CrmState, requirementId: string): RequisitionCounts {
  const candidates = (state.tessiant?.candidates ?? []).filter((item) => item.requirementId === requirementId);
  const statuses = candidates.map((item) => normalizeCandidateStatus(item.shortlistStatus));
  return {
    total: candidates.length,
    suggested: statuses.filter((status) => status === "suggested" || status === "contacted").length,
    shortlisted: statuses.filter((status) =>
      ["availability_confirmed", "shortlisted", "submitted_to_client"].includes(status),
    ).length,
    interviewed: statuses.filter((status) => status === "interview").length,
    offered: statuses.filter((status) => status === "offer").length,
    filled: statuses.filter((status) => status === "placed").length,
    rejected: statuses.filter((status) => status === "rejected").length,
  };
}

export type CandidateAction =
  | { type: "shortlist"; label: string; next: ShortlistStatus }
  | { type: "remove_shortlist"; label: string; next: ShortlistStatus }
  | { type: "contact"; label: string; next?: ShortlistStatus; needsNote?: boolean }
  | { type: "confirm_availability"; label: string; next: ShortlistStatus }
  | { type: "request_availability"; label: string; needsNote?: boolean }
  | { type: "submit_client"; label: string; next: ShortlistStatus }
  | { type: "interview"; label: string; next: ShortlistStatus; needsNote?: boolean }
  | { type: "offer"; label: string; next: ShortlistStatus }
  | { type: "place"; label: string }
  | { type: "reject"; label: string; next: ShortlistStatus; needsReason: true };

/** Only actions relevant to the candidate's current state. */
export function actionsForCandidate(status: string): CandidateAction[] {
  const current = normalizeCandidateStatus(status);
  switch (current) {
    case "suggested":
      return [
        { type: "shortlist", label: "Shortlist", next: "shortlisted" },
        { type: "contact", label: "Log contact", next: "contacted", needsNote: true },
        { type: "request_availability", label: "Request availability", needsNote: true },
        { type: "reject", label: "Reject", next: "rejected", needsReason: true },
      ];
    case "contacted":
      return [
        { type: "shortlist", label: "Shortlist", next: "shortlisted" },
        { type: "confirm_availability", label: "Confirm availability", next: "availability_confirmed" },
        { type: "contact", label: "Log contact", needsNote: true },
        { type: "reject", label: "Reject", next: "rejected", needsReason: true },
      ];
    case "availability_confirmed":
      return [
        { type: "shortlist", label: "Shortlist", next: "shortlisted" },
        { type: "submit_client", label: "Submit to client", next: "submitted_to_client" },
        { type: "remove_shortlist", label: "Remove from shortlist", next: "suggested" },
        { type: "reject", label: "Reject", next: "rejected", needsReason: true },
      ];
    case "shortlisted":
      return [
        { type: "confirm_availability", label: "Confirm availability", next: "availability_confirmed" },
        { type: "submit_client", label: "Submit to client", next: "submitted_to_client" },
        { type: "contact", label: "Log contact", needsNote: true },
        { type: "remove_shortlist", label: "Remove from shortlist", next: "suggested" },
        { type: "reject", label: "Reject", next: "rejected", needsReason: true },
      ];
    case "submitted_to_client":
      return [
        { type: "interview", label: "Record interview", next: "interview", needsNote: true },
        { type: "contact", label: "Log contact", needsNote: true },
        { type: "reject", label: "Reject", next: "rejected", needsReason: true },
      ];
    case "interview":
      return [
        { type: "interview", label: "Log feedback", next: "interview", needsNote: true },
        { type: "offer", label: "Move to offer / commercials", next: "offer" },
        { type: "reject", label: "Reject with reason", next: "rejected", needsReason: true },
      ];
    case "offer":
      return [
        { type: "place", label: "Confirm placement" },
        { type: "contact", label: "Log contact", needsNote: true },
        { type: "reject", label: "Reject / offer declined", next: "rejected", needsReason: true },
      ];
    case "placed":
    case "rejected":
      return [];
    default:
      return [{ type: "reject", label: "Reject", next: "rejected", needsReason: true }];
  }
}

export function requirementPriority(req: ClientRequirement): RequirementPriority {
  return req.priority ?? "medium";
}

export interface RequisitionListFilters {
  clientId?: string | null;
  ownerId?: string | null;
  sector?: string | null;
  opsStage?: string | null;
  priority?: string | null;
  category?: string | null;
  view?: string | null;
  skill?: string | null;
  q?: string | null;
  from?: string | null;
  to?: string | null;
}

export function filterRequisitions(state: CrmState, filters: RequisitionListFilters) {
  const t = state.tessiant;
  if (!t) return [];
  const term = (filters.q ?? "").trim().toLowerCase();
  return t.requirements
    .filter((req) => {
      if (filters.clientId && req.accountId !== filters.clientId) return false;
      if (filters.ownerId) {
        if (filters.ownerId === "none" ? req.ownerId !== null : req.ownerId !== filters.ownerId) return false;
      }
      if (filters.sector && req.sector.toLowerCase() !== filters.sector.toLowerCase()) return false;
      if (filters.opsStage && mapRequirementToOpsStage(req) !== filters.opsStage) return false;
      if (filters.priority && requirementPriority(req) !== filters.priority) return false;
      if (filters.category && req.category !== filters.category) return false;
      if (filters.skill) {
        const skill = filters.skill.toLowerCase();
        if (![...req.mustHaveSkills, ...req.preferredSkills].some((item) => item.toLowerCase() === skill)) return false;
      }
      if (filters.from && (req.requestDate || req.createdAt.slice(0, 10)) < filters.from) return false;
      if (filters.to && (req.requestDate || req.createdAt.slice(0, 10)) > filters.to) return false;
      if (filters.view === "open" && (req.archived || req.outcome !== "active" || req.stage === "Placed")) return false;
      if (filters.view === "urgent" && requirementPriority(req) !== "high") return false;
      if (filters.view === "awaiting") {
        const counts = requisitionCounts(state, req.id);
        if (req.stage === "Placed" || counts.shortlisted + counts.offered + counts.filled > 0) return false;
      }
      if (filters.view === "interview_offer") {
        const counts = requisitionCounts(state, req.id);
        if (counts.interviewed + counts.offered === 0 && req.stage !== "Interview" && req.stage !== "Commercials") return false;
      }
      if (term) {
        const account = t.accounts.find((item) => item.id === req.accountId);
        const hay = `${req.title} ${req.description} ${account?.name ?? ""} ${req.mustHaveSkills.join(" ")}`.toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    })
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function boardColumns(state: CrmState, filters: RequisitionListFilters) {
  const rows = filterRequisitions(state, { ...filters, opsStage: null });
  return OPS_PIPELINE_STAGES.map((stage) => ({
    stage,
    items: rows.filter((req) => mapRequirementToOpsStage(req) === stage),
  }));
}

export function nextRequirementStageHint(stage: string): string {
  switch (stage) {
    case "New Requirement":
    case "New":
      return "Capture brief and open sourcing";
    case "Sourcing":
      return "Find matches and contact talent";
    case "Validation":
    case "Shortlisting":
      return "Confirm availability and shortlist";
    case "Interview":
      return "Coordinate interviews and feedback";
    case "Commercials":
    case "Offer/Commercials":
      return "Agree rates and terms";
    case "Placed":
    case "Filled":
      return "Assignment live";
    case "On Hold":
      return "Paused — resume when ready";
    case "Closed":
      return "Closed / lost";
    default:
      return "";
  }
}

/** Map ops board column back to stored requirement stage/outcome. */
export function applyOpsBoardMove(
  opsStage: OpsPipelineStage,
): { stage?: RequirementStage; outcome?: RequirementOutcome; reason: string } {
  switch (opsStage) {
    case "New":
      return { stage: "New Requirement", outcome: "active", reason: "Board move → New" };
    case "Sourcing":
      return { stage: "Sourcing", outcome: "active", reason: "Board move → Sourcing" };
    case "Shortlisting":
      return { stage: "Validation", outcome: "active", reason: "Board move → Shortlisting" };
    case "Interview":
      return { stage: "Interview", outcome: "active", reason: "Board move → Interview" };
    case "Offer/Commercials":
      return { stage: "Commercials", outcome: "active", reason: "Board move → Offer/Commercials" };
    case "Filled":
      return { stage: "Placed", outcome: "active", reason: "Board move → Filled (confirm placement separately if needed)" };
    case "On Hold":
      return { outcome: "on_hold", reason: "Board move → On Hold" };
    case "Closed":
      return { outcome: "lost", reason: "Board move → Closed" };
    default:
      return { reason: "Board move" };
  }
}

export function groupCandidatesByStatus(candidates: RequirementCandidate[]) {
  const groups: { status: ShortlistStatus; label: string; items: RequirementCandidate[] }[] = SHORTLIST_STATUSES.map((status) => ({
    status,
    label: SHORTLIST_STATUS_LABELS[status],
    items: [],
  }));
  for (const candidate of candidates) {
    const status = normalizeCandidateStatus(candidate.shortlistStatus);
    const group = groups.find((item) => item.status === status);
    group?.items.push(candidate);
  }
  return groups.filter((group) => group.items.length > 0 || ["suggested", "shortlisted", "interview", "offer"].includes(group.status));
}

export function categoryLabel(category: RequirementCategory) {
  return category;
}

export interface RequirementTimelineItem {
  id: string;
  at: string;
  title: string;
  detail: string;
  actor: string;
  kind: "stage" | "candidate" | "placement" | "task" | "other";
}

export function requirementActivityTimeline(state: CrmState, requirementId: string): RequirementTimelineItem[] {
  const t = state.tessiant;
  if (!t) return [];
  const requirement = t.requirements.find((item) => item.id === requirementId);
  if (!requirement) return [];
  const candidateIds = new Set(t.candidates.filter((c) => c.requirementId === requirementId).map((c) => c.id));
  const associateByCandidate = new Map(
    t.candidates.filter((c) => c.requirementId === requirementId).map((c) => [c.id, c.associateId] as const),
  );
  const associateName = (associateId: string | undefined) => t.associates.find((a) => a.id === associateId)?.name ?? "Associate";

  const items: RequirementTimelineItem[] = [];

  for (const entry of requirement.stageHistory) {
    items.push({
      id: `stage_${entry.stage}_${entry.at}`,
      at: entry.at,
      title: `Stage → ${entry.stage}`,
      detail: entry.reason ?? "Requirement stage updated",
      actor: state.members.find((m) => m.id === entry.actorId)?.name ?? entry.actorId,
      kind: "stage",
    });
  }

  for (const event of t.domainEvents) {
    const payloadReq = typeof event.payload.requirementId === "string" ? event.payload.requirementId : null;
    const related =
      event.entityId === requirementId ||
      payloadReq === requirementId ||
      (event.entityType === "candidate" && candidateIds.has(event.entityId)) ||
      (event.entityType === "placement" && t.placements.some((p) => p.id === event.entityId && p.requirementId === requirementId));
    if (!related) continue;

    const associateId =
      (typeof event.payload.associateId === "string" ? event.payload.associateId : null) ??
      associateByCandidate.get(event.entityId);
    const name = associateName(associateId ?? undefined);
    let title: string = event.eventType;
    let detail = "";
    switch (event.eventType) {
      case "candidate.shortlisted":
        title = `Shortlisted · ${name}`;
        detail = event.payload.sourcedExternally ? "Externally sourced candidate added to shortlist" : "Added to shortlist";
        break;
      case "candidate.removed_from_shortlist":
        title = `Removed from shortlist · ${name}`;
        detail = String(event.payload.reason ?? "Returned to suggested");
        break;
      case "candidate.contacted":
        title = `Contact logged · ${name}`;
        detail = String(event.payload.note ?? "Contact recorded");
        break;
      case "candidate.submitted_to_client":
        title = `Submitted to client · ${name}`;
        detail = "Candidate pack submitted";
        break;
      case "candidate.rejected":
        title = `Rejected · ${name}`;
        detail = String(event.payload.reason ?? "No reason recorded");
        break;
      case "candidate.status_changed":
        title = `Status → ${String(event.payload.to ?? "updated")} · ${name}`;
        detail = String(event.payload.note ?? (event.payload.from ? `From ${String(event.payload.from)}` : "Candidate updated"));
        break;
      case "candidate.external_recorded":
        title = `External candidate recorded · ${name}`;
        detail = String(event.payload.note ?? "Not previously in Tessiant network");
        break;
      case "candidate.validation_completed":
        title = `Availability / cost confirmed · ${name}`;
        detail = "Validation completed for this requisition";
        break;
      case "interview.completed":
        title = `Interview / feedback · ${name}`;
        detail = `Outcome: ${String(event.payload.outcome ?? "logged")}`;
        break;
      case "quote.sent":
        title = `Quote sent · ${name}`;
        detail = "Moved to offer / commercial negotiation";
        break;
      case "quote.agreed":
        title = `Terms agreed · ${name}`;
        detail = "Commercials agreed";
        break;
      case "placement.confirmed":
        title = `Placement confirmed · ${name}`;
        detail = "Assignment created";
        break;
      case "placement.closed":
        title = "Placement closed";
        detail = String(event.payload.outcome ?? "Closed");
        break;
      case "requirement.stage_changed":
        title = `Stage → ${String(event.payload.to ?? "")}`;
        detail = String(event.payload.reason ?? "");
        break;
      case "requirement.created":
        title = "Requirement created";
        detail = String(event.payload.title ?? requirement.title);
        break;
      default:
        title = event.eventType;
        detail = JSON.stringify(event.payload);
    }

    items.push({
      id: event.eventId,
      at: event.timestamp,
      title,
      detail,
      actor: event.actor,
      kind: event.entityType === "placement" ? "placement" : event.entityType === "candidate" ? "candidate" : "other",
    });
  }

  for (const task of requirementTasksFromState(state, requirementId)) {
    items.push({
      id: `task_${task.id}`,
      at: task.updatedAt ?? task.createdAt,
      title: task.title,
      detail: `Task · ${task.status}`,
      actor: state.members.find((m) => m.id === task.ownerId)?.name ?? "—",
      kind: "task",
    });
  }

  const seen = new Set<string>();
  return items
    .filter((item) => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    })
    .sort((a, b) => b.at.localeCompare(a.at));
}

function requirementTasksFromState(state: CrmState, requirementId: string) {
  const token = `[requirement:${requirementId}]`;
  return state.tasks.filter((task) => task.description?.includes(token) || task.title.includes(requirementId));
}

export type { OpsPipelineStage };
