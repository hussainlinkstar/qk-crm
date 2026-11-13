// Shared CRM → Pulse handoff adapter (Demo V1).
// Emits stable domain events for the separate Qiko Pulse intelligence layer.
// No live Pulse service — consumers read `domainEvents` / `getPulseSnapshot`.

import type { CrmState } from "./types";
import type { DomainEvent, DomainEventEntityType, TessiantDomainEventType } from "./tessiant-types";
import type { InsightEvidence } from "./tessiant-pulse-types";
import { estimatedMargin } from "./tessiant-matching";

export const PULSE_SCHEMA_VERSION = 1 as const;
export const PULSE_SOURCE = "tessiant-crm" as const;

/** Canonical in-app hrefs so Pulse can open the source of evidence. */
export function entityHref(entityType: DomainEventEntityType, entityId: string, related?: Record<string, unknown>): string | null {
  switch (entityType) {
    case "lead":
      return `/sales/leads/${entityId}`;
    case "opportunity":
      return `/sales/pipeline`;
    case "account":
      return `/sales/accounts/${entityId}`;
    case "contact":
      return `/sales/contacts`;
    case "requirement":
      return `/staffing/requirements/${entityId}`;
    case "associate":
      return `/staffing/associates/${entityId}`;
    case "candidate": {
      const requirementId = typeof related?.requirementId === "string" ? related.requirementId : null;
      return requirementId ? `/staffing/requirements/${requirementId}` : "/staffing/requirements";
    }
    case "placement":
      return `/staffing/placements/${entityId}`;
    case "task":
      return `/tasks`;
    default:
      return null;
  }
}

export function createDomainEvent(input: {
  eventId: string;
  eventType: TessiantDomainEventType;
  entityType: DomainEvent["entityType"];
  entityId: string;
  timestamp: string;
  actor: string;
  payload?: Record<string, unknown>;
}): DomainEvent {
  const payload = { ...(input.payload ?? {}) };
  if (!payload.href) {
    const href = entityHref(input.entityType, input.entityId, payload);
    if (href) payload.href = href;
  }
  if (!payload.summary) {
    payload.summary = `${input.eventType} · ${input.entityType}/${input.entityId}`;
  }
  return {
    eventId: input.eventId,
    eventType: input.eventType,
    entityType: input.entityType,
    entityId: input.entityId,
    timestamp: input.timestamp,
    actor: input.actor,
    source: PULSE_SOURCE,
    schemaVersion: PULSE_SCHEMA_VERSION,
    payload,
  };
}

/**
 * Resolve structured evidence for Pulse from a domain event + current CRM state.
 * Returns stable entity refs Pulse can show without fabricating external systems.
 */
export function resolveDomainEventEvidence(state: CrmState, event: DomainEvent): InsightEvidence[] {
  const evidence: InsightEvidence[] = [];
  const push = (entityType: InsightEvidence["entityType"], entityId: string, field?: string, observedValue?: string | number) => {
    if (!entityId) return;
    evidence.push({
      entityType,
      entityId,
      field,
      observedValue,
      href: entityHref(entityType as DomainEventEntityType, entityId, event.payload) ?? undefined,
    });
  };

  push(event.entityType as InsightEvidence["entityType"], event.entityId, "eventType", event.eventType);

  const payload = event.payload;
  const relatedKeys: Array<[InsightEvidence["entityType"], string]> = [
    ["account", "accountId"],
    ["opportunity", "opportunityId"],
    ["lead", "leadId"],
    ["requirement", "requirementId"],
    ["associate", "associateId"],
    ["candidate", "candidateId"],
    ["placement", "placementId"],
    ["contact", "contactId"],
    ["task", "taskId"],
  ];
  for (const [type, key] of relatedKeys) {
    const value = payload[key];
    if (typeof value === "string" && value) push(type, value, key);
  }

  // Enrich labels from live records when present
  if (event.entityType === "lead") {
    const lead = state.leads.find((item) => item.id === event.entityId);
    if (lead) {
      evidence[0] = { ...evidence[0], observedValue: `${lead.name} · ${lead.status}`, field: "lead" };
      if (lead.accountId) push("account", lead.accountId, "accountId");
    }
  }
  if (event.entityType === "opportunity") {
    const opportunity = (state.opportunities ?? []).find((item) => item.id === event.entityId);
    if (opportunity) {
      evidence[0] = {
        ...evidence[0],
        observedValue: `${opportunity.name} · ${opportunity.stage} · £${opportunity.amount}`,
        field: "opportunity",
      };
      push("account", opportunity.accountId, "accountId");
    }
  }
  if (event.entityType === "requirement" && state.tessiant) {
    const requirement = state.tessiant.requirements.find((item) => item.id === event.entityId);
    if (requirement) {
      evidence[0] = { ...evidence[0], observedValue: `${requirement.title} · ${requirement.stage}`, field: "requirement" };
      push("account", requirement.accountId, "accountId");
    }
  }
  if (event.entityType === "associate" && state.tessiant) {
    const associate = state.tessiant.associates.find((item) => item.id === event.entityId);
    if (associate) evidence[0] = { ...evidence[0], observedValue: `${associate.name} · ${associate.availability}`, field: "associate" };
  }
  if (event.entityType === "placement" && state.tessiant) {
    const placement = state.tessiant.placements.find((item) => item.id === event.entityId);
    if (placement) {
      evidence[0] = {
        ...evidence[0],
        observedValue: `${placement.assignmentStatus ?? placement.status} · ${placement.roleTitle ?? placement.id}`,
        field: "assignment",
      };
      push("associate", placement.associateId, "associateId");
      push("requirement", placement.requirementId, "requirementId");
    }
  }
  if (event.entityType === "candidate" && state.tessiant) {
    const candidate = state.tessiant.candidates.find((item) => item.id === event.entityId);
    if (candidate) {
      evidence[0] = { ...evidence[0], observedValue: candidate.shortlistStatus, field: "candidate" };
      push("requirement", candidate.requirementId, "requirementId");
      push("associate", candidate.associateId, "associateId");
    }
  }
  if (event.entityType === "account" && state.tessiant) {
    const account = state.tessiant.accounts.find((item) => item.id === event.entityId);
    if (account) evidence[0] = { ...evidence[0], observedValue: account.name, field: "account" };
  }

  // Deduplicate by entityType+entityId
  const seen = new Set<string>();
  return evidence.filter((item) => {
    const key = `${item.entityType}:${item.entityId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Deduplicate by eventId — safe for screen re-renders and adapter re-reads. */
export function uniqueEvents(events: DomainEvent[]): DomainEvent[] {
  const seen = new Set<string>();
  const out: DomainEvent[] = [];
  for (const event of events) {
    if (seen.has(event.eventId)) continue;
    seen.add(event.eventId);
    out.push(event);
  }
  return out;
}

export interface PulseFinancialBucket {
  suggested: number;
  pipeline: number;
  agreed: number;
  realised: number;
  currency: "GBP";
  note: string;
}

export interface PulseStaffingSnapshot {
  generatedAt: string;
  source: typeof PULSE_SOURCE;
  schemaVersion: typeof PULSE_SCHEMA_VERSION;
  network: {
    totalMembers: number;
    sampleSize: number;
    verifiedSample: number;
    siaSample: number;
  };
  requirements: {
    open: number;
    placed: number;
    onHoldOrLost: number;
    byStage: Record<string, number>;
  };
  capacitySignals: Array<{
    id: string;
    kind: "capacity_gap" | "sector_coverage" | "founder_dependency";
    title: string;
    detail: string;
    requirementId?: string;
    accountId?: string;
  }>;
  financials: PulseFinancialBucket;
  recentEvents: DomainEvent[];
}

function dayRateGbp(amount: number | null | undefined, unit: string | undefined): number {
  if (amount == null || !unit) return 0;
  if (unit === "day") return amount;
  if (unit === "hour") return amount * 8;
  if (unit === "month") return amount / 20;
  return 0;
}

export function getPulseSnapshot(state: CrmState, now = new Date()): PulseStaffingSnapshot {
  const tessiant = state.tessiant;
  const empty: PulseStaffingSnapshot = {
    generatedAt: now.toISOString(),
    source: PULSE_SOURCE,
    schemaVersion: PULSE_SCHEMA_VERSION,
    network: { totalMembers: 0, sampleSize: 0, verifiedSample: 0, siaSample: 0 },
    requirements: { open: 0, placed: 0, onHoldOrLost: 0, byStage: {} },
    capacitySignals: [],
    financials: {
      suggested: 0,
      pipeline: 0,
      agreed: 0,
      realised: 0,
      currency: "GBP",
      note: "Suggested, pipeline, agreed and realised kept distinct. No Tessiant staffing data loaded.",
    },
    recentEvents: [],
  };
  if (!tessiant) return empty;

  const byStage: Record<string, number> = {};
  for (const req of tessiant.requirements) {
    if (req.archived) continue;
    byStage[req.stage] = (byStage[req.stage] ?? 0) + 1;
  }

  const open = tessiant.requirements.filter((req) => !req.archived && req.outcome === "active" && req.stage !== "Placed").length;
  const placed = tessiant.requirements.filter((req) => req.stage === "Placed").length;
  const onHoldOrLost = tessiant.requirements.filter((req) => ["on_hold", "lost", "cancelled"].includes(req.outcome)).length;

  let suggested = 0;
  let pipeline = 0;
  let agreed = 0;
  let realised = 0;

  for (const candidate of tessiant.candidates) {
    const quote = candidate.quotedClientRate;
    const value = dayRateGbp(quote?.amount, quote?.unit);
    if (["suggested", "contacted", "availability_confirmed", "shortlisted"].includes(candidate.shortlistStatus)) suggested += value;
    if (["submitted_to_client", "interview", "offer", "validating", "quoted"].includes(candidate.shortlistStatus)) pipeline += value;
  }

  for (const placement of tessiant.placements) {
    const client = placement.terms.clientRate;
    const value = dayRateGbp(client?.amount, client?.unit);
    if (placement.status === "agreed") agreed += value;
    if (placement.status === "confirmed" || placement.status === "closed") {
      // Realised only when outcome supports recognition
      if (placement.outcome === "completed" || placement.status === "confirmed") realised += value;
      else agreed += value;
    }
  }

  const capacitySignals: PulseStaffingSnapshot["capacitySignals"] = [];

  const sapReq = tessiant.requirements.find((req) => req.id === "req_sap");
  if (sapReq) {
    const verifiedAvailable = tessiant.candidates.filter((candidate) => {
      if (candidate.requirementId !== sapReq.id) return false;
      const associate = tessiant.associates.find((item) => item.id === candidate.associateId);
      return Boolean(associate?.verifiedAt) && associate?.availability === "available" && candidate.matchScore >= 50;
    }).length;
    if (verifiedAvailable < 2) {
      capacitySignals.push({
        id: "sig_sap_capacity",
        kind: "capacity_gap",
        title: "SAP architecture capacity gap",
        detail: `Only ${verifiedAvailable} verified available associate(s) matched the SAP request.`,
        requirementId: sapReq.id,
      });
    }
  }

  const publicReq = tessiant.requirements.find((req) => req.id === "req_public");
  if (publicReq) {
    const coverage = tessiant.associates.filter((associate) =>
      associate.sectors.some((sector) => sector.toLowerCase().includes("public")),
    ).length;
    capacitySignals.push({
      id: "sig_public_coverage",
      kind: "sector_coverage",
      title: "Public-sector coverage below target offerings",
      detail: `Sample shows ${coverage} public-sector-aligned associates vs stated expansion interest.`,
      requirementId: publicReq.id,
    });
  }

  for (const account of tessiant.accounts) {
    if (account.primaryOwnerId && !account.secondaryOwnerId) {
      capacitySignals.push({
        id: `sig_founder_${account.id}`,
        kind: "founder_dependency",
        title: `Founder relationship concentration · ${account.name}`,
        detail: "Primary relationship owner set with no documented secondary owner.",
        accountId: account.id,
      });
    }
  }

  return {
    generatedAt: now.toISOString(),
    source: PULSE_SOURCE,
    schemaVersion: PULSE_SCHEMA_VERSION,
    network: {
      totalMembers: tessiant.networkStats.totalMembers,
      sampleSize: tessiant.networkStats.sampleSize,
      verifiedSample: tessiant.networkStats.verifiedSample,
      siaSample: tessiant.networkStats.siaSample,
    },
    requirements: { open, placed, onHoldOrLost, byStage },
    capacitySignals,
    financials: {
      suggested: Math.round(suggested),
      pipeline: Math.round(pipeline),
      agreed: Math.round(agreed),
      realised: Math.round(realised),
      currency: "GBP",
      note: "Suggested / pipeline / agreed / realised stay distinct and reconcile to seeded candidates and assignments — not the illustrative 500+ network figure.",
    },
    recentEvents: uniqueEvents(tessiant.domainEvents).slice(0, 40),
  };
}

export function placementMarginLabel(terms: {
  associateCost: { amount: number; currency: string; unit: string } | null;
  clientRate: { amount: number; currency: string; unit: string } | null;
}) {
  return estimatedMargin(terms.associateCost, terms.clientRate);
}
