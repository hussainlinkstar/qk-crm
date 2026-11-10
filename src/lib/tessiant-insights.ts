import type { CrmState } from "./types";
import { deployedAssignments, liveAssignments, pendingRenewals } from "./assignments";
import { estimatedMargin } from "./tessiant-matching";
import {
  OPS_PIPELINE_STAGES,
  type ClientRequirement,
  type OpsPipelineStage,
  type Placement,
  type RequirementPriority,
} from "./tessiant-types";
import { addDays, toDateKey, todayKey } from "./format";

function isVerifiedAvailable(associate: { verifiedAt: string | null; availability: string; status: string }) {
  return Boolean(associate.verifiedAt) && associate.availability === "available" && associate.status === "active";
}

function requirementPriority(req: ClientRequirement): RequirementPriority {
  return req.priority ?? "medium";
}

export function mapRequirementToOpsStage(req: ClientRequirement): OpsPipelineStage {
  if (req.outcome === "on_hold") return "On Hold";
  if (req.outcome === "lost" || req.outcome === "cancelled" || req.outcome === "archived" || req.archived) return "Closed";
  switch (req.stage) {
    case "New Requirement":
      return "New";
    case "Sourcing":
      return "Sourcing";
    case "Validation":
      return "Shortlisting";
    case "Interview":
      return "Interview";
    case "Commercials":
      return "Offer/Commercials";
    case "Placed":
      return "Filled";
    default:
      return "New";
  }
}

export function verifiedAvailableMatchCount(state: CrmState, requirementId: string) {
  const t = state.tessiant;
  if (!t) return 0;
  return t.candidates.filter((candidate) => {
    if (candidate.requirementId !== requirementId) return false;
    const associate = t.associates.find((item) => item.id === candidate.associateId);
    return associate && isVerifiedAvailable(associate) && candidate.matchScore >= 50;
  }).length;
}

export function isHardToFill(state: CrmState, req: ClientRequirement) {
  if (requirementPriority(req) === "high" && verifiedAvailableMatchCount(state, req.id) < 2) return true;
  if (req.mustHaveSkills.some((skill) => /sap|s\/4/i.test(skill)) && verifiedAvailableMatchCount(state, req.id) < 2) return true;
  return verifiedAvailableMatchCount(state, req.id) === 0 && req.stage !== "Placed" && req.outcome === "active";
}

export function isUrgentRequirement(state: CrmState, req: ClientRequirement, today = todayKey()) {
  if (req.archived || req.outcome !== "active" || req.stage === "Placed") return false;
  const high = requirementPriority(req) === "high";
  const overdue = req.startDate < today;
  const approaching = req.startDate >= today && req.startDate <= addDays(14);
  const hard = isHardToFill(state, req);
  return high || overdue || approaching || hard;
}

export function activeAssignments(state: CrmState): Placement[] {
  return deployedAssignments(state);
}

export function assignmentRenewalStatus(placement: Placement, today = todayKey()): NonNullable<Placement["renewalStatus"]> {
  if (placement.renewalStatus) return placement.renewalStatus;
  const end = placement.terms.endDate;
  if (!end) return "open_ended";
  if (end < today) return "ending";
  if (end <= addDays(30)) return "renewal_due";
  return "on_track";
}

export function placementsThisMonth(state: CrmState, now = new Date()) {
  const t = state.tessiant;
  if (!t) return [];
  const month = now.getMonth();
  const year = now.getFullYear();
  return t.placements.filter((placement) => {
    if (!placement.placementDate) return false;
    const date = new Date(placement.placementDate);
    return date.getMonth() === month && date.getFullYear() === year && (placement.status === "confirmed" || placement.status === "closed");
  });
}

export function assignmentsEndingSoon(state: CrmState, today = todayKey()) {
  return activeAssignments(state).filter((placement) => {
    const end = placement.terms.endDate;
    return end && end >= today && end <= addDays(30);
  });
}

export function assignmentRenewalsDue(state: CrmState, today = todayKey()) {
  return pendingRenewals(state, today);
}

/** Compact operational KPIs for the staffing desk (six clickable metrics). */
export function staffingCommandKpis(state: CrmState, now = Date.now()) {
  const t = state.tessiant;
  if (!t) return [];
  const openReqs = t.requirements.filter((req) => !req.archived && req.outcome === "active" && req.stage !== "Placed");
  const availableVerified = t.associates.filter(isVerifiedAvailable).length;
  const availableAll = t.associates.filter((item) => item.availability === "available" && item.status === "active").length;
  const deployments = activeAssignments(state);
  const deployedAssociateIds = new Set(deployments.map((item) => item.associateId));
  const live = liveAssignments(state);
  const monthPlacements = placementsThisMonth(state, new Date(now)).length;

  return [
    {
      key: "total",
      label: "Total associates",
      value: String(t.associates.length),
      delta: "",
      description: "",
      href: "/staffing/associates",
      emphasis: "primary" as const,
      tone: undefined as "positive" | "warning" | undefined,
    },
    {
      key: "available",
      label: "Available associates",
      value: String(availableAll),
      delta: availableVerified > 0 ? `${availableVerified} verified` : "",
      description: "",
      href: "/staffing/associates?view=available_now",
      emphasis: "primary" as const,
      tone: availableAll > 0 ? ("positive" as const) : ("warning" as const),
    },
    {
      key: "deployed",
      label: "Currently deployed",
      value: String(deployedAssociateIds.size),
      delta: "",
      description: "",
      href: "/staffing/placements?view=active",
      emphasis: "primary" as const,
      tone: undefined,
    },
    {
      key: "open",
      label: "Open requirements",
      value: String(openReqs.length),
      delta: "",
      description: "",
      href: "/staffing/requirements?view=open",
      emphasis: "primary" as const,
      tone: openReqs.length > 0 ? ("positive" as const) : undefined,
    },
    {
      key: "assignments",
      label: "Active assignments",
      value: String(live.length),
      delta: "",
      description: "",
      href: "/staffing/placements?view=live",
      emphasis: "primary" as const,
      tone: undefined,
    },
    {
      key: "month",
      label: "Placements this month",
      value: String(monthPlacements),
      delta: "",
      description: "",
      href: "/staffing/placements?view=month",
      emphasis: "primary" as const,
      tone: monthPlacements > 0 ? ("positive" as const) : undefined,
    },
  ];
}

export function formatCandidatePipelineSummary(counts: {
  shortlisted: number;
  interviewed: number;
  offered: number;
  filled: number;
  suggested?: number;
}) {
  const parts: string[] = [];
  if (counts.shortlisted) parts.push(`${counts.shortlisted} shortlisted`);
  if (counts.interviewed) parts.push(`${counts.interviewed} interview`);
  if (counts.offered) parts.push(`${counts.offered} offer`);
  if (counts.filled) parts.push(`${counts.filled} placed`);
  return parts.length ? parts.join(" · ") : "No candidates yet";
}

/** Single progress chip for Kanban cards — most advanced stage only. */
export function formatCandidateProgress(counts: {
  shortlisted: number;
  interviewed: number;
  offered: number;
  filled: number;
  suggested?: number;
}) {
  if (counts.filled) return `${counts.filled} placed`;
  if (counts.offered) return `${counts.offered} offer`;
  if (counts.interviewed) return `${counts.interviewed} interview`;
  if (counts.shortlisted) return `${counts.shortlisted} shortlisted`;
  if (counts.suggested) return `${counts.suggested} suggested`;
  return "No candidates";
}

/** @deprecated Prefer staffingCommandKpis for the operations desk. */
export function staffingKpis(state: CrmState) {
  return staffingCommandKpis(state).map(({ emphasis: _emphasis, ...rest }) => rest);
}

export function recruitmentPipeline(state: CrmState) {
  const t = state.tessiant;
  if (!t) return [];
  const counts = Object.fromEntries(OPS_PIPELINE_STAGES.map((stage) => [stage, 0])) as Record<OpsPipelineStage, number>;
  for (const req of t.requirements) {
    counts[mapRequirementToOpsStage(req)] += 1;
  }
  return OPS_PIPELINE_STAGES.map((stage) => ({
    stage,
    count: counts[stage],
    href: `/staffing/requirements?opsStage=${encodeURIComponent(stage)}`,
  }));
}

export function urgentStaffingNeeds(state: CrmState, now = Date.now()) {
  const t = state.tessiant;
  if (!t) return [];
  const today = toDateKey(new Date(now));
  return t.requirements
    .filter((req) => isUrgentRequirement(state, req, today))
    .map((req) => {
      const reasons: string[] = [];
      if (requirementPriority(req) === "high") reasons.push("High priority");
      if (req.startDate < today) reasons.push("Start date overdue");
      else if (req.startDate <= addDays(14)) reasons.push("Start within 14 days");
      if (isHardToFill(state, req)) reasons.push("Hard to fill");
      const account = t.accounts.find((item) => item.id === req.accountId);
      return {
        id: req.id,
        title: req.title,
        client: account?.name ?? "Unknown client",
        stage: mapRequirementToOpsStage(req),
        startDate: req.startDate,
        priority: requirementPriority(req),
        reasons,
        matches: verifiedAvailableMatchCount(state, req.id),
        href: `/staffing/requirements/${req.id}`,
      };
    })
    .sort((a, b) => {
      const rank = { high: 0, medium: 1, low: 2 };
      return rank[a.priority] - rank[b.priority] || a.startDate.localeCompare(b.startDate);
    });
}

export function assignmentOverviewRows(state: CrmState, now = Date.now()) {
  const t = state.tessiant;
  if (!t) return [];
  const today = toDateKey(new Date(now));
  // Include upcoming + active + extended so a just-confirmed placement appears on the command centre.
  return liveAssignments(state, today)
    .map((placement) => {
      const associate = t.associates.find((item) => item.id === placement.associateId);
      const req = t.requirements.find((item) => item.id === placement.requirementId);
      const account =
        (placement.accountId ? t.accounts.find((item) => item.id === placement.accountId) : undefined) ??
        (req ? t.accounts.find((item) => item.id === req.accountId) : undefined);
      const renewal = assignmentRenewalStatus(placement, today);
      const status = placement.assignmentStatus ?? "active";
      return {
        id: placement.id,
        associateName: associate?.name ?? placement.associateId,
        associateId: placement.associateId,
        client: account?.name ?? "Unknown client",
        role: placement.roleTitle ?? req?.title ?? "Assignment",
        startDate: placement.terms.startDate,
        endDate: placement.terms.endDate,
        renewal,
        status,
        href: `/staffing/placements/${placement.id}`,
        requirementHref: req ? `/staffing/requirements/${req.id}` : "/staffing/placements",
      };
    })
    .sort((a, b) => (a.startDate ?? "9999").localeCompare(b.startDate ?? "9999"));
}

export type StaffingActionKind =
  | "interview"
  | "availability"
  | "feedback"
  | "assignment"
  | "cv"
  | "commercial"
  | "other";

export function upcomingStaffingActions(state: CrmState) {
  const tasks = state.tasks
    .filter((task) => task.status === "pending" || task.status === "in_progress")
    .filter((task) => {
      const blob = `${task.title} ${task.description}`.toLowerCase();
      return (
        task.description.includes("[requirement:") ||
        task.description.includes("[pulse-insight:") ||
        /availability|interview|quote|cv|commercial|renewal|feedback|assignment/i.test(blob)
      );
    })
    .map((task) => {
      const blob = `${task.title} ${task.description}`.toLowerCase();
      let kind: StaffingActionKind = "other";
      if (/interview/.test(blob)) kind = "interview";
      else if (/availability|verify/.test(blob)) kind = "availability";
      else if (/feedback/.test(blob)) kind = "feedback";
      else if (/renewal|ending|assignment/.test(blob)) kind = "assignment";
      else if (/\bcv\b/.test(blob)) kind = "cv";
      else if (/quote|commercial|price/.test(blob)) kind = "commercial";
      const reqMatch = task.description.match(/\[requirement:([^\]]+)\]/);
      return {
        id: task.id,
        title: task.title,
        due: task.due,
        priority: task.priority,
        kind,
        href: reqMatch ? `/staffing/requirements/${reqMatch[1]}` : "/sales/actions",
      };
    })
    .sort((a, b) => (a.due ?? "9999").localeCompare(b.due ?? "9999"));

  // Synthetic operational nudges from live data when task list is thin
  const ending = assignmentsEndingSoon(state).slice(0, 2).map((placement) => {
    const associate = state.tessiant?.associates.find((item) => item.id === placement.associateId);
    return {
      id: `nudge_end_${placement.id}`,
      title: `Renewal decision · ${associate?.name ?? "associate"} assignment ending`,
      due: placement.terms.endDate,
      priority: "high" as const,
      kind: "assignment" as const,
      href: `/staffing/placements?view=ending30&highlight=${placement.id}`,
    };
  });

  const interviews = (state.tessiant?.candidates ?? [])
    .filter((candidate) => candidate.shortlistStatus === "interview" && candidate.interview.outcome === "pending")
    .slice(0, 2)
    .map((candidate) => {
      const associate = state.tessiant?.associates.find((item) => item.id === candidate.associateId);
      return {
        id: `nudge_int_${candidate.id}`,
        title: `Chase interview feedback · ${associate?.name ?? "candidate"}`,
        due: addDays(1),
        priority: "medium" as const,
        kind: "feedback" as const,
        href: `/staffing/requirements/${candidate.requirementId}`,
      };
    });

  const merged = [...tasks, ...ending, ...interviews];
  const seen = new Set<string>();
  return merged.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  }).slice(0, 8);
}

export function demandSnapshot(state: CrmState) {
  const t = state.tessiant;
  if (!t) return { skills: [], sectors: [] };
  const open = t.requirements.filter((req) => !req.archived && req.outcome === "active" && req.stage !== "Placed");
  const skillCounts = new Map<string, number>();
  const sectorCounts = new Map<string, number>();
  for (const req of open) {
    sectorCounts.set(req.sector, (sectorCounts.get(req.sector) ?? 0) + 1);
    for (const skill of req.mustHaveSkills) skillCounts.set(skill, (skillCounts.get(skill) ?? 0) + 1);
  }
  const skills = [...skillCounts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 5)
    .map(([label, value]) => ({
      label,
      value,
      href: `/staffing/requirements?skill=${encodeURIComponent(label)}`,
    }));
  const sectors = [...sectorCounts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 5)
    .map(([label, value]) => ({
      label,
      value,
      href: `/staffing/requirements?sector=${encodeURIComponent(label)}`,
    }));
  return { skills, sectors };
}

export function formatRate(rate: { amount: number; currency: string; unit: string } | null | undefined) {
  if (!rate) return "—";
  return `${rate.currency} ${rate.amount.toLocaleString("en-GB")}/${rate.unit}`;
}

export function marginForCandidate(
  cost: { amount: number; currency: string; unit: string } | null | undefined,
  client: { amount: number; currency: string; unit: string } | null | undefined,
) {
  const margin = estimatedMargin(cost, client);
  if (margin.amount == null) return "Not available";
  return `${margin.label}: ${client?.currency ?? ""} ${margin.amount.toLocaleString("en-GB")}/${client?.unit ?? "day"} (${margin.pct ?? "—"}%)`;
}

export function requirementTasks(state: CrmState, requirementId: string) {
  const token = `[requirement:${requirementId}]`;
  return state.tasks.filter((task) => task.description.includes(token) || task.title.toLowerCase().includes(requirementId.toLowerCase()));
}

export function filterRequirements(
  state: CrmState,
  params: {
    view?: string | null;
    opsStage?: string | null;
    skill?: string | null;
    sector?: string | null;
  },
) {
  const t = state.tessiant;
  if (!t) return [];
  let rows = [...t.requirements];
  const today = todayKey();

  if (params.opsStage) {
    rows = rows.filter((req) => mapRequirementToOpsStage(req) === params.opsStage);
  }
  if (params.skill) {
    rows = rows.filter((req) => req.mustHaveSkills.some((skill) => skill.toLowerCase() === params.skill!.toLowerCase()) || req.preferredSkills.some((skill) => skill.toLowerCase() === params.skill!.toLowerCase()));
  }
  if (params.sector) {
    rows = rows.filter((req) => req.sector.toLowerCase() === params.sector!.toLowerCase());
  }
  if (params.view === "open") {
    rows = rows.filter((req) => !req.archived && req.outcome === "active" && req.stage !== "Placed");
  } else if (params.view === "awaiting") {
    rows = rows.filter((req) => !req.archived && req.outcome === "active" && req.stage !== "Placed" && verifiedAvailableMatchCount(state, req.id) < 2);
  } else if (params.view === "urgent") {
    rows = rows.filter((req) => isUrgentRequirement(state, req, today));
  } else if (params.view === "interview_offer") {
    const reqIds = new Set(
      t.candidates.filter((candidate) => ["interview", "offer", "quoted", "selected"].includes(candidate.shortlistStatus)).map((candidate) => candidate.requirementId),
    );
    rows = rows.filter((req) => reqIds.has(req.id));
  }

  return rows.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
