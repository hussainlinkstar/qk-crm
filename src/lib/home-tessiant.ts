import { OPPORTUNITY_STAGES, type CrmState, type Priority } from "./types";
import type { Workspace } from "./insights";
import { isOpen, sortTasks } from "./insights";
import {
  assignmentsEndingSoon,
  isUrgentRequirement,
  mapRequirementToOpsStage,
  verifiedAvailableMatchCount,
  activeAssignments,
} from "./tessiant-insights";
import { pendingRenewals } from "./assignments";
import { generateTessiantInsights } from "./tessiant-pulse-rules";
import { commercialBuckets } from "./sales-crm";
import { insightIdFromTask } from "./pulse-journey";
import { founderDependency } from "./founder-dependency";
import { addDays, formatDate, plural, todayKey, toDateKey } from "./format";

export interface HomePriorityCard {
  id: string;
  title: string;
  summary: string;
  priority: Priority;
  href: string;
  source: "operational" | "pulse";
  actionLabel: string;
}

export interface HomeActivityItem {
  id: string;
  title: string;
  detail: string;
  href: string;
  at: string;
}

export interface HomeChangeItem {
  id: string;
  title: string;
  detail: string;
  href: string;
}

export function homeBusinessSnapshot(state: CrmState) {
  const t = state.tessiant;
  const openOpps = (state.opportunities ?? []).filter((item) => item.stage !== "Closed Won" && item.stage !== "Closed Lost").length;
  const openReqs = t?.requirements.filter((req) => !req.archived && req.outcome === "active" && req.stage !== "Placed").length ?? 0;
  const deployments = activeAssignments(state);
  const deployedAssociates = new Set(deployments.map((item) => item.associateId)).size;
  const ending = assignmentsEndingSoon(state).length;
  return [
    { key: "opps", label: "Open sales opportunities", value: openOpps, href: "/sales/pipeline" },
    { key: "reqs", label: "Open staffing requirements", value: openReqs, href: "/staffing/requirements?view=open&layout=board" },
    { key: "deployed", label: "Deployed associates", value: deployedAssociates, href: "/staffing/placements?view=active" },
    { key: "ending", label: "Assignments ending soon", value: ending, href: "/staffing/placements?view=ending30" },
  ];
}

export interface HomePriorityOptions {
  /** How many ranked rows Home shows. The PRD minimum is three. */
  limit?: number;
  /** A Pulse insight already shown elsewhere on Home (best next move) so it is not repeated. */
  excludeInsightId?: string | null;
}

export function buildTessiantHomePriorities(
  state: CrmState,
  workspace: Workspace,
  now = Date.now(),
  options: HomePriorityOptions = {},
): HomePriorityCard[] {
  const limit = options.limit ?? 3;
  const cards: HomePriorityCard[] = [];
  const t = state.tessiant;
  const today = todayKey();
  const seenIds = new Set<string>();
  const seenEntities = new Set<string>();

  // Collect more than the limit, then rank by significance and cut: a later, more significant card
  // (an account resting on one person) must not lose its place to an earlier routine one.
  const push = (card: HomePriorityCard, entityKey?: string) => {
    if (seenIds.has(card.id) || cards.length >= limit + 6) return;
    if (entityKey && seenEntities.has(entityKey)) return;
    seenIds.add(card.id);
    if (entityKey) seenEntities.add(entityKey);
    cards.push(card);
  };

  void workspace;

  const overdue = sortTasks(state.tasks.filter((task) => isOpen(task) && task.due && task.due < today));
  if (overdue.length) {
    push({
      id: "overdue-tasks",
      title: overdue.length === 1 ? overdue[0].title : `${overdue.length} overdue tasks`,
      summary: overdue.length === 1 ? "Past due — clear this first." : `Next up: ${overdue[0]?.title ?? "Clear overdue work"}`,
      priority: "high",
      href: "/tasks?view=overdue",
      source: "operational",
      actionLabel: "Clear overdue",
    });
  }

  if (t) {
    const thin = t.requirements.find(
      (req) => !req.archived && req.outcome === "active" && req.stage !== "Placed" && verifiedAvailableMatchCount(state, req.id) === 0,
    );
    if (thin) {
      push(
        {
          id: `no-match-${thin.id}`,
          title: thin.title,
          summary: "No verified available matches.",
          priority: "high",
          href: `/staffing/requirements/${thin.id}`,
          source: "operational",
          actionLabel: "Review sourcing",
        },
        `requirement:${thin.id}`,
      );
    }

    const urgent = t.requirements.filter((req) => isUrgentRequirement(state, req, today));
    if (urgent[0]) {
      push(
        {
          id: `urgent-req-${urgent[0].id}`,
          title: urgent[0].title,
          summary: `${mapRequirementToOpsStage(urgent[0])} · starts ${formatDate(urgent[0].startDate)}`,
          priority: "high",
          href: `/staffing/requirements/${urgent[0].id}`,
          source: "operational",
          actionLabel: "Open requirement",
        },
        `requirement:${urgent[0].id}`,
      );
    }

    const interview = t.candidates.find((item) => item.shortlistStatus === "interview");
    if (interview) {
      const req = t.requirements.find((item) => item.id === interview.requirementId);
      push(
        {
          id: `interview-${interview.id}`,
          title: req?.title ?? "Interview pending",
          summary: "Interview scheduled — record feedback next.",
          priority: "medium",
          href: `/staffing/requirements/${interview.requirementId}`,
          source: "operational",
          actionLabel: "Update pipeline",
        },
        `requirement:${interview.requirementId}`,
      );
    }

    const renewal = pendingRenewals(state, today)[0] ?? assignmentsEndingSoon(state, today)[0];
    if (renewal) {
      const associate = t.associates.find((item) => item.id === renewal.associateId);
      push(
        {
          id: `renewal-${renewal.id}`,
          title: associate ? `${associate.name} assignment` : "Assignment renewal",
          summary: `Ends ${renewal.terms.endDate ? formatDate(renewal.terms.endDate) : "soon"} — plan extension or redeploy.`,
          priority: "medium",
          href: `/staffing/placements/${renewal.id}`,
          source: "operational",
          actionLabel: "Review assignment",
        },
        `assignment:${renewal.id}`,
      );
    }
  }

  const staleOpp = (state.opportunities ?? []).find((item) => item.stage === "Proposal" || item.stage === "Negotiation");
  if (staleOpp) {
    push(
      {
        id: `opp-${staleOpp.id}`,
        title: staleOpp.name,
        summary: `${staleOpp.stage} · £${staleOpp.amount.toLocaleString("en-GB")} — needs follow-up.`,
        priority: "medium",
        href: "/sales/pipeline",
        source: "operational",
        actionLabel: "Advance deal",
      },
      `opportunity:${staleOpp.id}`,
    );
  }

  const relationshipRisk = generateTessiantInsights(state, now).find(
    (insight) =>
      insight.reviewStatus === "pending" &&
      insight.id !== options.excludeInsightId &&
      (insight.id.startsWith("ins_rel_") || /relationship|founder|single-owner/i.test(`${insight.title} ${insight.summary}`)),
  );
  if (relationshipRisk) {
    const accountEvidence = relationshipRisk.evidence.find((item) => item.entityType === "account");
    push(
      {
        id: `pulse-rel-${relationshipRisk.id}`,
        title: relationshipRisk.title,
        summary: relationshipRisk.summary,
        priority: relationshipRisk.priority === "high" ? "high" : "medium",
        href: accountEvidence?.entityId ? `/sales/accounts/${accountEvidence.entityId}` : "/pulse/insights",
        source: "pulse",
        actionLabel: "Review account",
      },
      accountEvidence?.entityId ? `account:${accountEvidence.entityId}` : `pulse:${relationshipRisk.id}`,
    );
  }

  // The account that rests most on one person, from the recorded dependency score. Always a candidate:
  // this is the risk a founder-led business feels first.
  if (t) {
    const dependent = t.accounts
      .filter((account) => account.status !== "inactive")
      .map((account) => ({ account, score: founderDependency(state, account.id, now) }))
      .filter((item) => item.score && item.score.band === "high")
      .sort((a, b) => (b.score?.score ?? 0) - (a.score?.score ?? 0))[0];
    if (dependent?.score) {
      push(
        {
          id: `dependency-${dependent.account.id}`,
          title: `${dependent.account.name} rests on ${dependent.score.keyPerson ?? "one person"}`,
          summary: `Dependency ${dependent.score.score}/100${dependent.score.delta > 0 ? `, up ${dependent.score.delta} in three months` : ""}. Add a second owner and a second stakeholder.`,
          priority: "high",
          href: `/sales/accounts/${dependent.account.id}`,
          source: "pulse",
          actionLabel: "Widen the relationship",
        },
        `account:${dependent.account.id}`,
      );
    }
  }

  // Significance first: recorded business risks (Pulse, accounts, deals) before routine overdue work.
  const tier = (card: HomePriorityCard) => (card.id === "overdue-tasks" ? 3 : card.source === "pulse" ? 0 : card.priority === "high" ? 1 : 2);
  return cards
    .map((card, index) => ({ card, index }))
    .sort((a, b) => tier(a.card) - tier(b.card) || a.index - b.index)
    .map((item) => item.card)
    .slice(0, limit);
}

// — Outcomes ————————————————————————————————————————————————————

export interface HomeOutcomeTile {
  key: string;
  label: string;
  value: string;
  /** Raw number for count-up animation; `format` turns it back into `value`. */
  numeric?: number;
  format?: (value: number) => string;
  sub: string;
  href: string;
  tone: "brand" | "qiko" | "success";
  series: number[];
  kind: "bars" | "line";
  seriesLabel: string;
}

/** £999,000 → "£999k"; £1,250,000 → "£1.25m". Pipeline and weighted figures are estimates, not revenue. */
export function compactMoney(value: number, currency = "£"): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${currency}${(value / 1_000_000).toFixed(value % 1_000_000 === 0 ? 0 : 2).replace(/\.?0+$/, "")}m`;
  if (abs >= 1_000) return `${currency}${Math.round(value / 1_000)}k`;
  return `${currency}${value.toLocaleString("en-GB")}`;
}

/**
 * Output-driven tiles for Home. Each one is a measurable result, not an activity count,
 * and each carries a small series so movement is visible without opening a report.
 */
export function homeOutcomes(state: CrmState, now = Date.now()): HomeOutcomeTile[] {
  const t = state.tessiant;
  const today = toDateKey(new Date(now));
  const buckets = commercialBuckets(state);
  const opps = state.opportunities ?? [];
  const open = opps.filter((item) => item.stage !== "Closed Won" && item.stage !== "Closed Lost");
  const openStages = OPPORTUNITY_STAGES.filter((stage) => stage !== "Closed Won" && stage !== "Closed Lost");
  const byStage = openStages.map((stage) => open.filter((item) => item.stage === stage).reduce((sum, item) => sum + item.amount, 0));
  const closingSoon = open.filter((item) => item.expectedCloseDate <= addDays(21, new Date(now))).length;

  // Placements per month, last six months, most recent last.
  const months: { year: number; month: number }[] = [];
  for (let offset = 5; offset >= 0; offset -= 1) {
    const date = new Date(now);
    date.setDate(1);
    date.setMonth(date.getMonth() - offset);
    months.push({ year: date.getFullYear(), month: date.getMonth() });
  }
  const confirmed = (t?.placements ?? []).filter(
    (item) => item.placementDate && (item.status === "confirmed" || item.status === "closed"),
  );
  const placementSeries = months.map(({ year, month }) =>
    confirmed.filter((item) => {
      const date = new Date(item.placementDate as string);
      return date.getFullYear() === year && date.getMonth() === month;
    }).length,
  );
  const placementsLast90 = confirmed.filter((item) => now - new Date(item.placementDate as string).getTime() <= 90 * 86_400_000).length;
  const placementsThisMonth = placementSeries[placementSeries.length - 1] ?? 0;

  // Actions completed per day, last 14 days.
  const dayKeys: string[] = [];
  for (let offset = 13; offset >= 0; offset -= 1) dayKeys.push(addDays(-offset, new Date(now)));
  const completedByDay = new Map<string, number>();
  for (const task of state.tasks) {
    if (!task.completedAt) continue;
    const key = toDateKey(new Date(task.completedAt));
    completedByDay.set(key, (completedByDay.get(key) ?? 0) + 1);
  }
  const taskSeries = dayKeys.map((key) => completedByDay.get(key) ?? 0);
  const completedWeek = dayKeys.slice(-7).reduce((sum, key) => sum + (completedByDay.get(key) ?? 0), 0);
  const openTasks = state.tasks.filter(isOpen);
  const overdue = openTasks.filter((task) => task.due && task.due < today).length;

  // Pulse value: separate ledgers, never summed into one number.
  const outcomes = t?.pulse?.outcomes ?? [];
  const realised = outcomes.reduce((sum, item) => sum + (item.value.realisedRevenue ?? 0), 0);
  const potential = outcomes.reduce((sum, item) => sum + (item.value.pipelinePotential ?? 0), 0);
  const outcomeInsightIds = new Set(outcomes.map((item) => item.insightId));
  const acceptedWaiting = state.tasks.filter((task) => {
    if (!isOpen(task)) return false;
    const insightId = insightIdFromTask(task.description);
    return Boolean(insightId) && !outcomeInsightIds.has(insightId as string);
  }).length;
  const outcomeSeries = outcomes.map((item) => (item.value.realisedRevenue ?? 0) + (item.value.pipelinePotential ?? 0));

  return [
    {
      key: "pipeline",
      label: "Weighted pipeline",
      value: compactMoney(buckets.weighted),
      numeric: buckets.weighted,
      format: (n) => compactMoney(n),
      sub: `${compactMoney(buckets.pipeline)} open · ${closingSoon} closing in 21d`,
      href: "/sales/pipeline",
      tone: "brand",
      series: byStage,
      kind: "bars",
      seriesLabel: "Open pipeline by stage",
    },
    {
      key: "placements",
      label: "Placements confirmed",
      value: String(placementsLast90),
      numeric: placementsLast90,
      sub: `last 90 days · ${placementsThisMonth} this month`,
      href: "/staffing/placements",
      tone: "success",
      series: placementSeries,
      kind: "bars",
      seriesLabel: "Placements per month, last 6 months",
    },
    {
      key: "actions",
      label: "Actions completed",
      value: String(completedWeek),
      numeric: completedWeek,
      sub: `last 7 days · ${openTasks.length} open${overdue ? ` · ${overdue} overdue` : ""}`,
      href: "/tasks?view=completed",
      tone: "brand",
      series: taskSeries,
      kind: "line",
      seriesLabel: "Actions completed per day, last 14 days",
    },
    {
      key: "pulse",
      label: "Pulse value attributed",
      value: realised > 0 ? compactMoney(realised) : compactMoney(potential),
      numeric: realised > 0 ? realised : potential,
      format: (n) => compactMoney(n),
      sub: realised > 0 ? `realised · ${compactMoney(potential)} potential` : `potential · ${acceptedWaiting} accepted open`,
      href: "/pulse/value",
      tone: "qiko",
      series: outcomeSeries.length ? outcomeSeries : [0],
      kind: "bars",
      seriesLabel: "Value per recorded Pulse outcome",
    },
  ];
}

/** One sentence under the greeting: what the day looks like, from counts that exist. */
export function homeLede(state: CrmState, priorityCount: number, now = Date.now()): string {
  const t = state.tessiant;
  const today = toDateKey(new Date(now));
  const parts: string[] = [];
  parts.push(priorityCount === 0 ? "Nothing urgent on your desk" : `${plural(priorityCount, "thing")} need${priorityCount === 1 ? "s" : ""} you today`);
  const ending = assignmentsEndingSoon(state, today).length;
  if (ending) parts.push(`${plural(ending, "assignment")} ending within 30 days`);
  const openReqs = t?.requirements.filter((req) => !req.archived && req.outcome === "active" && req.stage !== "Placed").length ?? 0;
  if (openReqs) parts.push(`${plural(openReqs, "open requirement")}`);
  return `${parts.join(" · ")}.`;
}

export function buildTessiantHomeActivity(state: CrmState): HomeActivityItem[] {
  const t = state.tessiant;
  const items: HomeActivityItem[] = [];

  for (const event of t?.domainEvents ?? []) {
    const title = humanDomainEvent(event.eventType);
    // Skip anything that still looks technical/raw.
    if (!title || /\./.test(title)) continue;
    items.push({
      id: event.eventId,
      title,
      detail: activityDetail(state, event.eventType, event.entityType, event.entityId, event.payload, event.actor),
      href: hrefForDomainEvent(event.eventType, event.entityType, event.entityId, event.payload),
      at: event.timestamp,
    });
  }

  // Prefer Tessiant domain activity. Only add sales CRM notes that are clearly non-Signal.
  if (items.length < 8) {
    for (const event of state.events) {
      if (["signup", "scan", "enquiry", "report", "login", "product"].includes(event.kind)) continue;
      if (/signal|free scan|website|pricing/i.test(`${event.title} ${event.detail ?? ""} ${event.source}`)) continue;
      const lead = event.leadId ? state.leads.find((item) => item.id === event.leadId) : null;
      items.push({
        id: event.id,
        title: humanCrmActivity(event.kind, event.title),
        detail: [lead?.name, lead?.company, event.detail].filter(Boolean).join(" · ") || event.source,
        href: event.leadId ? `/sales/leads/${event.leadId}` : "/sales",
        at: event.occurredAt,
      });
      if (items.length >= 12) break;
    }
  }

  return items.sort((a, b) => b.at.localeCompare(a.at)).slice(0, 8);
}

export function buildTessiantWhatChanged(
  state: CrmState,
  now = Date.now(),
  priorities: HomePriorityCard[] = [],
): HomeChangeItem[] {
  const week = (iso: string) => now - new Date(iso).getTime() <= 7 * 86_400_000;
  const today = toDateKey(new Date(now));
  const weekAhead = (() => {
    const d = new Date(`${today}T12:00:00`);
    d.setDate(d.getDate() + 7);
    return toDateKey(d);
  })();
  const t = state.tessiant;
  const changes: HomeChangeItem[] = [];

  // Skip 1:1 duplicates of cards already shown in Top Priorities unless the count adds desk-level context.
  const priorityShowsEndingAssignment = priorities.some(
    (item) => item.id.startsWith("renewal-") || /assignment requiring renewal/i.test(item.title),
  );
  const priorityShowsSalesOpp = priorities.some((item) => item.id.startsWith("opp-"));

  const newReqs = t?.requirements.filter((req) => !req.archived && week(req.createdAt)) ?? [];
  if (newReqs.length) {
    changes.push({
      id: "new-reqs",
      title: `${newReqs.length} new requirement${newReqs.length === 1 ? "" : "s"} this week`,
      detail: newReqs.map((req) => req.title).slice(0, 2).join(" · "),
      href: "/staffing/requirements?view=open",
    });
  }

  const becomingAvailable =
    t?.associates.filter((item) => {
      if (item.status !== "active" || !item.nextAvailableDate) return false;
      return item.nextAvailableDate >= today && item.nextAvailableDate <= weekAhead;
    }) ?? [];
  const availableNow =
    t?.associates.filter((item) => item.availability === "available" && item.status === "active") ?? [];
  if (becomingAvailable.length) {
    changes.push({
      id: "available",
      title: `${becomingAvailable.length} associate${becomingAvailable.length === 1 ? "" : "s"} becoming available`,
      detail: becomingAvailable
        .slice(0, 2)
        .map((item) => `${item.name}${item.nextAvailableDate ? ` · ${formatDate(item.nextAvailableDate)}` : ""}`)
        .join(" · "),
      href: "/staffing/associates?view=available_now",
    });
  } else if (availableNow.length) {
    changes.push({
      id: "available",
      title: `${availableNow.length} associate${availableNow.length === 1 ? "" : "s"} available now`,
      detail: "Ready for shortlist or redeployment",
      href: "/staffing/associates?view=available_now",
    });
  }

  const placements = t?.placements.filter((item) => item.placementDate && week(item.placementDate)) ?? [];
  if (placements.length) {
    const names = placements.slice(0, 2).map((placement) => {
      const associate = t?.associates.find((item) => item.id === placement.associateId);
      return associate?.name;
    });
    changes.push({
      id: "placements",
      title: `${placements.length} recently confirmed placement${placements.length === 1 ? "" : "s"}`,
      detail: names.filter(Boolean).join(" · ") || "Assignments activated from recruitment",
      href: "/staffing/placements",
    });
  }

  const ending = assignmentsEndingSoon(state, today);
  if (ending.length > 1 || (ending.length === 1 && !priorityShowsEndingAssignment)) {
    changes.push({
      id: "ending",
      title: `${ending.length} assignment${ending.length === 1 ? "" : "s"} approaching completion`,
      detail:
        ending.length > 1
          ? "Renewal and redeployment window across the desk"
          : `Ends ${ending[0]?.terms.endDate ? formatDate(ending[0].terms.endDate) : "soon"} · plan extension or redeployment`,
      href: "/staffing/placements?view=ending30",
    });
  }

  const progressing = (state.opportunities ?? []).filter((item) => ["Proposal", "Negotiation"].includes(item.stage));
  if (progressing.length > 1 || (progressing.length === 1 && !priorityShowsSalesOpp)) {
    changes.push({
      id: "opps",
      title: `${progressing.length} sales opportunit${progressing.length === 1 ? "y" : "ies"} progressing`,
      detail: progressing
        .slice(0, 2)
        .map((item) => item.name)
        .join(" · "),
      href: "/sales/pipeline",
    });
  }

  return changes.slice(0, 5);
}

function humanDomainEvent(eventType: string) {
  const map: Record<string, string> = {
    "lead.created": "New client lead",
    "lead.qualified": "Lead qualified",
    "lead.converted": "Lead converted",
    "opportunity.created": "Sales opportunity created",
    "opportunity.progressed": "Opportunity progressed",
    "opportunity.won": "Opportunity won",
    "opportunity.lost": "Opportunity lost",
    "requirement.created": "New staffing requirement",
    "requirement.opened": "Staffing requirement opened",
    "requirement.stage_changed": "Requirement stage updated",
    "candidate.suggested": "Associate suggested for requirement",
    "candidate.shortlisted": "Associate shortlisted",
    "candidate.removed_from_shortlist": "Associate removed from shortlist",
    "candidate.contacted": "Associate contacted",
    "candidate.submitted_to_client": "Associate submitted to client",
    "candidate.interviewed": "Interview scheduled",
    "interview.completed": "Interview completed",
    "candidate.validation_completed": "CV or availability updated",
    "associate.created": "Associate added to network",
    "associate.updated": "Associate profile updated",
    "associate.availability_changed": "CV or availability updated",
    "associate.availability_verified": "Availability verified",
    "offer.created": "Commercial offer created",
    "offer.agreed": "Commercials agreed",
    "quote.agreed": "Commercials agreed",
    "placement.confirmed": "Placement confirmed",
    "assignment.activated": "Assignment activated",
    "assignment.started": "Assignment started",
    "assignment.extended": "Assignment extended",
    "assignment.completed": "Assignment completed",
    "account.relationship_owner_changed": "Account relationship updated",
    "client.feedback_recorded": "Client feedback recorded",
  };
  return map[eventType] ?? "";
}

function humanCrmActivity(kind: string, fallbackTitle: string) {
  if (kind === "note") return "CRM note added";
  if (kind === "task") return "Task updated";
  if (kind === "meeting") return "Meeting logged";
  if (kind === "call" || kind === "email") return "Client follow-up logged";
  if (/lead/i.test(fallbackTitle)) return "New client lead";
  if (/opportunit/i.test(fallbackTitle)) return "Opportunity progressed";
  return fallbackTitle.replace(/\./g, " ").trim() || "CRM activity";
}

function activityDetail(
  state: CrmState,
  eventType: string,
  entityType: string,
  entityId: string,
  payload: Record<string, unknown> | undefined,
  actor: string,
) {
  const t = state.tessiant;
  const parts: string[] = [];
  const requirementId = String(payload?.requirementId ?? (entityType === "requirement" ? entityId : ""));
  const associateId = String(payload?.associateId ?? (entityType === "associate" ? entityId : ""));
  const accountId = String(payload?.accountId ?? (entityType === "account" ? entityId : ""));

  if (eventType.startsWith("lead.") || entityType === "lead") {
    const leadName =
      (typeof payload?.name === "string" && payload.name) ||
      state.leads.find((item) => item.id === entityId)?.name;
    if (leadName) parts.push(leadName);
  }
  if (eventType.startsWith("opportunity.") || entityType === "opportunity") {
    const opportunityName =
      (typeof payload?.name === "string" && payload.name) ||
      (state.opportunities ?? []).find((item) => item.id === entityId)?.name;
    if (opportunityName) parts.push(opportunityName);
  }
  if (typeof payload?.title === "string") parts.push(payload.title);
  else if (requirementId) {
    const requirement = t?.requirements.find((item) => item.id === requirementId);
    if (requirement) parts.push(requirement.title);
  }
  if (associateId) {
    const associate = t?.associates.find((item) => item.id === associateId);
    if (associate) parts.push(associate.name);
  }
  if (accountId) {
    const account = t?.accounts.find((item) => item.id === accountId);
    if (account) parts.push(account.name);
  }
  if (typeof payload?.from === "string" && typeof payload?.to === "string") {
    parts.push(`${payload.from} → ${payload.to}`);
  } else if (typeof payload?.availability === "string") {
    parts.push(`Availability: ${payload.availability}`);
  } else if (typeof payload?.summary === "string" && parts.length === 0) {
    parts.push(payload.summary);
  }
  if (actor && actor !== "System seed") parts.push(actor);
  return parts.filter(Boolean).join(" · ") || "Tessiant CRM";
}

function hrefForDomainEvent(eventType: string, entityType: string, entityId: string, payload: Record<string, unknown> | undefined) {
  if (entityType === "lead" || eventType.startsWith("lead.")) return `/sales/leads/${entityId}`;
  if (entityType === "opportunity" || eventType.startsWith("opportunity.")) return "/sales/pipeline";
  if (entityType === "account") return `/sales/accounts/${entityId}`;
  if (entityType === "requirement" || eventType.startsWith("requirement.")) {
    return `/staffing/requirements/${payload?.requirementId ?? entityId}`;
  }
  if (entityType === "placement" || eventType.startsWith("assignment") || eventType.startsWith("placement")) {
    return `/staffing/placements/${entityId}`;
  }
  if (entityType === "associate" || eventType.startsWith("associate.")) return `/staffing/associates/${entityId}`;
  if (entityType === "candidate" || eventType.startsWith("candidate.") || eventType.startsWith("interview.") || eventType.startsWith("offer.")) {
    return `/staffing/requirements/${payload?.requirementId ?? entityId}`;
  }
  return "/staffing";
}
