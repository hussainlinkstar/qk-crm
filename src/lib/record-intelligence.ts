// Presentation helpers over existing CRM + Pulse rules. No new engine, no invented edges.

import { liveAssignments, resolveAssignmentAccountId } from "./assignments";
import { addDays, todayKey } from "./format";
import { recommendedMatches } from "./requirement-recommendations";
import { generateTessiantInsights } from "./tessiant-pulse-rules";
import { assignmentsEndingSoon, verifiedAvailableMatchCount } from "./tessiant-insights";
import { needsProfileUpdate } from "./talent-network";
import type { CrmState, Opportunity, OpportunityType } from "./types";
import type { ClientRequirement } from "./tessiant-types";
import type { TessiantInsight } from "./tessiant-pulse-types";

export const STAFFING_OPP_TYPES: OpportunityType[] = ["augmentation", "project team", "mixed"];

export function isStaffingOpportunity(type: OpportunityType) {
  return STAFFING_OPP_TYPES.includes(type);
}

export function pendingInsightsCiting(
  insights: TessiantInsight[],
  entityIds: Iterable<string>,
): TessiantInsight[] {
  const ids = new Set(entityIds);
  return insights.filter(
    (item) => item.reviewStatus === "pending" && item.evidence.some((row) => ids.has(row.entityId)),
  );
}

export function recordEntityIds(
  state: CrmState,
  scope: { leadId?: string | null; opportunityId?: string | null; accountId?: string | null; requirementId?: string | null },
): string[] {
  const ids = new Set<string>();
  if (scope.leadId) ids.add(scope.leadId);
  if (scope.opportunityId) ids.add(scope.opportunityId);
  if (scope.requirementId) ids.add(scope.requirementId);
  if (scope.accountId) {
    ids.add(scope.accountId);
    for (const contact of state.contacts ?? []) {
      if (contact.accountId === scope.accountId) ids.add(contact.id);
    }
    for (const opportunity of state.opportunities ?? []) {
      if (opportunity.accountId === scope.accountId) ids.add(opportunity.id);
    }
    for (const requirement of state.tessiant?.requirements ?? []) {
      if (requirement.accountId === scope.accountId) ids.add(requirement.id);
    }
    for (const placement of state.tessiant?.placements ?? []) {
      if (resolveAssignmentAccountId(state, placement) === scope.accountId) {
        ids.add(placement.id);
        ids.add(placement.associateId);
      }
    }
  }
  if (scope.opportunityId) {
    for (const requirement of state.tessiant?.requirements ?? []) {
      if (requirement.linkedOpportunityId === scope.opportunityId) ids.add(requirement.id);
    }
  }
  return [...ids];
}

export function pendingInsightForRecord(
  state: CrmState,
  scope: { leadId?: string | null; opportunityId?: string | null; accountId?: string | null; requirementId?: string | null },
  now = Date.now(),
): TessiantInsight | null {
  const insights = generateTessiantInsights(state, now);
  return pendingInsightsCiting(insights, recordEntityIds(state, scope))[0] ?? null;
}

export function opportunityBrief(state: CrmState, opportunity: Opportunity, now = Date.now()) {
  const today = todayKey();
  const horizon = addDays(14, new Date(now));
  const account = state.tessiant?.accounts.find((item) => item.id === opportunity.accountId);
  const linkedReq = (state.tessiant?.requirements ?? []).find((item) => item.linkedOpportunityId === opportunity.id);
  const missing: string[] = [];
  if (!opportunity.contactId) missing.push("no contact");
  if (!opportunity.nextStep) missing.push("no next step");
  if (account && account.primaryOwnerId && !account.secondaryOwnerId) missing.push("no secondary owner");
  if (isStaffingOpportunity(opportunity.type)) {
    const reqId = linkedReq?.id;
    if (reqId && verifiedAvailableMatchCount(state, reqId) === 0) missing.push("0 verified matches");
  }

  let why = `${opportunity.stage} · ${opportunity.type}`;
  if (opportunity.expectedCloseDate <= horizon && opportunity.stage !== "Closed Won" && opportunity.stage !== "Closed Lost") {
    why = `Closing ${opportunity.expectedCloseDate}`;
  } else if (!opportunity.nextStep && ["Proposal", "Negotiation"].includes(opportunity.stage)) {
    why = "Stalled — no next step";
  } else if (missing.includes("0 verified matches")) {
    why = "Coverage gap on staffing demand";
  } else if (opportunity.type === "advisory") {
    why = "Advisory / SIA — pipeline only until won";
  }

  return {
    why,
    missing: missing.join(", ") || "Nothing blocking",
    next: opportunity.nextStep?.trim() || "Set a next step",
    type: opportunity.type,
  };
}

export interface RelationshipPerson {
  id: string;
  label: string;
  role: string;
  href: string;
}

export function accountRelationshipStrip(state: CrmState, accountId: string): RelationshipPerson[] {
  const account = state.tessiant?.accounts.find((item) => item.id === accountId);
  if (!account) return [];
  const people: RelationshipPerson[] = [];
  const primary = state.members.find((item) => item.id === account.primaryOwnerId);
  const secondary = state.members.find((item) => item.id === account.secondaryOwnerId);
  if (primary) {
    people.push({ id: primary.id, label: primary.name, role: "Primary owner", href: `/sales/accounts/${accountId}` });
  }
  if (secondary) {
    people.push({ id: secondary.id, label: secondary.name, role: "Secondary owner", href: `/sales/accounts/${accountId}` });
  }
  for (const contact of (state.contacts ?? []).filter((item) => item.accountId === accountId).slice(0, 4)) {
    people.push({
      id: contact.id,
      label: contact.name,
      role: contact.role || "Contact",
      href: `/sales/contacts`,
    });
  }
  const today = todayKey();
  const live = liveAssignments(state, today).filter((item) => resolveAssignmentAccountId(state, item) === accountId);
  for (const placement of live.slice(0, 3)) {
    const associate = state.tessiant?.associates.find((item) => item.id === placement.associateId);
    if (!associate) continue;
    people.push({
      id: associate.id,
      label: associate.name,
      role: "Live associate",
      href: `/staffing/associates/${associate.id}`,
    });
  }
  const siaOnReqs = (state.tessiant?.candidates ?? []).filter((candidate) => {
    if (candidate.shortlistStatus !== "shortlisted" && candidate.shortlistStatus !== "interview") return false;
    const req = state.tessiant?.requirements.find((item) => item.id === candidate.requirementId);
    if (!req || req.accountId !== accountId) return false;
    const associate = state.tessiant?.associates.find((item) => item.id === candidate.associateId);
    return associate?.roleType === "SIA" || associate?.roleType === "executive_advisor";
  });
  for (const candidate of siaOnReqs.slice(0, 2)) {
    const associate = state.tessiant?.associates.find((item) => item.id === candidate.associateId);
    if (!associate) continue;
    people.push({
      id: associate.id,
      label: associate.name,
      role: "SIA on requirement",
      href: `/staffing/associates/${associate.id}`,
    });
  }
  const seen = new Set<string>();
  return people.filter((person) => {
    if (seen.has(person.id)) return false;
    seen.add(person.id);
    return true;
  });
}

export function unpurchasedInterests(state: CrmState, accountId: string) {
  const account = state.tessiant?.accounts.find((item) => item.id === accountId);
  if (!account) return [];
  const purchased = new Set((account.servicesPurchased ?? []).map((item) => item.trim().toLowerCase()));
  return (account.offeringInterests ?? []).filter((item) => !purchased.has(item.trim().toLowerCase()));
}

export function opportunityTypeFromInterest(interest: string): OpportunityType {
  const text = interest.toLowerCase();
  if (/augment|staff/.test(text)) return "augmentation";
  if (/advis|sia/.test(text)) return "advisory";
  if (/consult/.test(text)) return "consultancy";
  if (/project|team/.test(text)) return "project team";
  return "mixed";
}

function previewRequirement(state: CrmState, opportunity: Opportunity): ClientRequirement | null {
  const existing = (state.tessiant?.requirements ?? []).find((item) => item.linkedOpportunityId === opportunity.id);
  if (existing) return existing;
  const account = state.tessiant?.accounts.find((item) => item.id === opportunity.accountId);
  if (!account) return null;
  const category =
    opportunity.type === "advisory" ? "advisory" : opportunity.type === "project team" ? "project team" : "augmentation";
  return {
    id: `preview-${opportunity.id}`,
    accountId: opportunity.accountId,
    title: opportunity.name,
    category,
    description: "",
    sector: account.sector,
    mustHaveSkills: opportunity.services.slice(0, 2).length ? opportunity.services.slice(0, 2) : ["Programme management"],
    preferredSkills: [],
    seniority: "senior",
    roleType: category === "advisory" ? "SIA" : "consultant",
    location: "UK hybrid",
    workingMode: "hybrid",
    startDate: todayKey(),
    durationWeeks: 12,
    headcount: 1,
    rateMin: null,
    rateMax: null,
    currency: opportunity.currency,
    rateUnit: "day",
    ownerId: opportunity.ownerId,
    requestDate: todayKey(),
    notes: "",
    stage: "Sourcing",
    outcome: "active",
    outcomeReason: null,
    linkedOpportunityId: opportunity.id,
    stageHistory: [],
    offeringAlignment: opportunity.services,
    archived: false,
    createdAt: opportunity.createdAt,
    updatedAt: opportunity.updatedAt,
  };
}

export function staffingCoveragePreview(state: CrmState, opportunity: Opportunity, limit = 3) {
  if (!isStaffingOpportunity(opportunity.type) || !state.tessiant) {
    const sia = accountRelationshipStrip(state, opportunity.accountId).filter((item) => item.role.startsWith("SIA"));
    return {
      sentence: sia.length
        ? `${sia.map((item) => item.label).join(", ")} already shortlisted as SIA/advisor on this account.`
        : "No SIA shortlisted on this account.",
      associates: [] as Array<{ id: string; name: string; band: string; availability: string; href: string }>,
      verifiedCount: 0,
    };
  }
  const requirement = previewRequirement(state, opportunity);
  if (!requirement) {
    return { sentence: "No account on this opportunity.", associates: [], verifiedCount: 0 };
  }
  const recs = recommendedMatches(state, requirement, limit);
  const associates = recs.items.map((item) => ({
    id: item.associate.id,
    name: item.associate.name,
    band: item.presentation.suitabilityBand,
    availability: item.presentation.availabilityLabel,
    href: `/staffing/associates/${item.associate.id}`,
  }));
  const sentence =
    recs.verifiedCount > 0
      ? `${recs.verifiedCount} verified available match${recs.verifiedCount === 1 ? "" : "es"} on the linked requirement.`
      : recs.emptyMessage ??
        (associates.length
          ? `${associates.length} compact preview${associates.length === 1 ? "" : "s"} from the same matcher — not a shortlist.`
          : "0 verified available matches for this staffing demand.");
  return { sentence, associates, verifiedCount: recs.verifiedCount };
}

export function staffingDeskFindings(state: CrmState, now = Date.now()) {
  const t = state.tessiant;
  if (!t) return [];
  const stale = t.associates.filter((item) => item.status === "active" && needsProfileUpdate(item)).length;
  const zeroMatch = t.requirements.filter(
    (req) => !req.archived && req.outcome === "active" && req.stage !== "Placed" && verifiedAvailableMatchCount(state, req.id) === 0,
  ).length;
  const ending = assignmentsEndingSoon(state, todayKey()).length;
  const capacity = generateTessiantInsights(state, now).find(
    (item) => item.reviewStatus === "pending" && item.ruleId === "offering_mismatch",
  );
  const findings: Array<{ id: string; label: string; href: string; count: number }> = [];
  if (stale) {
    findings.push({
      id: "stale",
      label: `${stale} profile${stale === 1 ? "" : "s"} need a re-verify`,
      href: "/staffing/associates?view=needs_update",
      count: stale,
    });
  }
  if (zeroMatch) {
    findings.push({
      id: "zero",
      label: `${zeroMatch} req${zeroMatch === 1 ? "" : "s"} with 0 verified matches`,
      href: "/staffing/requirements?view=open&layout=board",
      count: zeroMatch,
    });
  }
  if (ending) {
    findings.push({
      id: "ending",
      label: `${ending} assignment${ending === 1 ? "" : "s"} ending / renewal`,
      href: "/staffing/placements?view=ending30",
      count: ending,
    });
  }
  if (capacity) {
    findings.push({
      id: "capacity",
      label: capacity.title,
      href: "/pulse/knowledge/capability",
      count: 1,
    });
  }
  return findings;
}
