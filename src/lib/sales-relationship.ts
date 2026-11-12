// Relationship intelligence for Sales lead/opportunity details.
// Evidence is ID-backed (owner, contact, placement, event, message). No invented graph edges.

import { deriveAssignmentStatus, isLiveAssignment, resolveAssignmentAccountId } from "./assignments";
import { todayKey } from "./format";
import type { ActivityEvent, ActivityKind, CrmState, Lead, Opportunity } from "./types";

const MEANINGFUL_KINDS = new Set<ActivityKind>([
  "interaction",
  "note",
  "enquiry",
  "conversion",
  "opportunity",
]);

const SKIP_KINDS = new Set<ActivityKind>(["scan", "login", "signup", "product", "lead_created"]);

export type RelationshipStrength = "Strong" | "Developing" | "Limited" | "Unknown";

export type RelationshipHrefKind = "associate" | "account" | "contact" | "opportunity";

export interface RelationshipLink {
  id: string;
  name: string;
  detail: string;
  href: string;
  kind: RelationshipHrefKind;
}

export interface RelationshipRecommendation {
  text: string;
  source: string;
  links: RelationshipLink[];
}

export interface SalesRelationshipIntel {
  strength: RelationshipStrength;
  strengthWhy: string;
  ownerName: string;
  network: RelationshipLink[];
  clients: RelationshipLink[];
  lastInteraction: { title: string; at: string; source: string } | null;
  missing: string[];
  coverageLabel: string;
  nextAction: string;
  recommendation: RelationshipRecommendation | null;
}

function memberName(state: CrmState, id: string | null | undefined) {
  if (!id) return null;
  return state.members.find((item) => item.id === id)?.name ?? null;
}

function lastMeaningfulInteraction(
  state: CrmState,
  scope: { leadId?: string | null; accountId?: string | null; opportunityId?: string | null; contactId?: string | null },
) {
  const rows: { title: string; at: string; source: string }[] = [];
  const matches = (event: ActivityEvent) => {
    if (scope.leadId && event.leadId === scope.leadId) return true;
    if (scope.opportunityId && event.opportunityId === scope.opportunityId) return true;
    if (scope.contactId && event.contactId === scope.contactId) return true;
    if (scope.accountId && event.accountId === scope.accountId) return true;
    return false;
  };

  for (const event of state.events ?? []) {
    if (!matches(event) || SKIP_KINDS.has(event.kind)) continue;
    const typed =
      event.activityType === "call" ||
      event.activityType === "meeting" ||
      event.activityType === "email" ||
      event.activityType === "introduction";
    if (!MEANINGFUL_KINDS.has(event.kind) && !typed) continue;
    rows.push({
      title: event.title,
      at: event.occurredAt,
      source: event.activityType ?? event.kind,
    });
  }

  if (scope.leadId) {
    for (const message of state.messages ?? []) {
      if (message.leadId !== scope.leadId) continue;
      rows.push({
        title: message.subject || `${message.channel} ${message.direction === "in" ? "received" : "sent"}`,
        at: message.at,
        source: message.channel,
      });
    }
    for (const note of state.notes ?? []) {
      if (note.leadId !== scope.leadId && note.accountId !== scope.accountId) continue;
      rows.push({ title: note.body.slice(0, 80), at: note.createdAt, source: "note" });
    }
  } else if (scope.accountId) {
    for (const note of state.notes ?? []) {
      if (note.accountId !== scope.accountId) continue;
      rows.push({ title: note.body.slice(0, 80), at: note.createdAt, source: "note" });
    }
  }

  rows.sort((a, b) => b.at.localeCompare(a.at));
  return rows[0] ?? null;
}

function networkOnAccount(state: CrmState, accountId: string): RelationshipLink[] {
  const links: RelationshipLink[] = [];
  const today = todayKey();
  const seen = new Set<string>();

  for (const placement of state.tessiant?.placements ?? []) {
    if (resolveAssignmentAccountId(state, placement) !== accountId) continue;
    const associate = state.tessiant?.associates.find((item) => item.id === placement.associateId);
    if (!associate || seen.has(associate.id)) continue;
    seen.add(associate.id);
    const live = isLiveAssignment(placement, today);
    const status = deriveAssignmentStatus(placement, today);
    const sia = associate.roleType === "SIA" || associate.roleType === "executive_advisor";
    links.push({
      id: associate.id,
      name: associate.name,
      detail: live
        ? `${sia ? "SIA" : "Associate"} on ${placement.roleTitle || "assignment"}`
        : `Past ${sia ? "SIA" : "associate"} · ${status}`,
      href: `/staffing/associates/${associate.id}`,
      kind: "associate",
    });
  }

  for (const candidate of state.tessiant?.candidates ?? []) {
    if (candidate.shortlistStatus !== "shortlisted" && candidate.shortlistStatus !== "interview") continue;
    const req = state.tessiant?.requirements.find((item) => item.id === candidate.requirementId);
    if (!req || req.accountId !== accountId) continue;
    const associate = state.tessiant?.associates.find((item) => item.id === candidate.associateId);
    if (!associate || seen.has(associate.id)) continue;
    const sia = associate.roleType === "SIA" || associate.roleType === "executive_advisor";
    if (!sia) continue;
    seen.add(associate.id);
    links.push({
      id: associate.id,
      name: associate.name,
      detail: `SIA ${candidate.shortlistStatus} on ${req.title}`,
      href: `/staffing/associates/${associate.id}`,
      kind: "associate",
    });
  }

  return links;
}

function clientLinks(
  state: CrmState,
  accountId: string,
  currentOpportunityId?: string | null,
): RelationshipLink[] {
  const account = state.tessiant?.accounts.find((item) => item.id === accountId);
  if (!account) return [];
  const links: RelationshipLink[] = [
    {
      id: account.id,
      name: account.name,
      detail: account.servicesPurchased?.length
        ? `Client · ${account.servicesPurchased.slice(0, 2).join(", ")}`
        : "Linked account",
      href: `/sales/accounts/${account.id}`,
      kind: "account",
    },
  ];
  for (const contact of (state.contacts ?? []).filter((item) => item.accountId === accountId).slice(0, 3)) {
    links.push({
      id: contact.id,
      name: contact.name,
      detail: contact.role || (contact.isPrimary ? "Primary contact" : "Contact"),
      href: `/sales/contacts?contact=${contact.id}`,
      kind: "contact",
    });
  }
  for (const opportunity of state.opportunities ?? []) {
    if (opportunity.accountId !== accountId || opportunity.id === currentOpportunityId) continue;
    if (opportunity.stage === "Closed Lost") continue;
    links.push({
      id: opportunity.id,
      name: opportunity.name,
      detail: opportunity.stage === "Closed Won" ? "Won opportunity" : `${opportunity.stage} opportunity`,
      href: `/sales/pipeline?opportunity=${opportunity.id}`,
      kind: "opportunity",
    });
  }
  return links;
}

function scoreStrength(input: {
  hasAccount: boolean;
  hasOwner: boolean;
  hasContact: boolean;
  hasSecondary: boolean;
  liveAssociates: number;
  pastAssociates: number;
  recentTouch: boolean;
  wonOnAccount: boolean;
}): { strength: RelationshipStrength; why: string } {
  if (!input.hasAccount && !input.hasOwner && !input.hasContact) {
    return { strength: "Unknown", why: "No owner, contact or client account is recorded." };
  }
  let score = 0;
  const evidence: string[] = [];
  if (input.hasOwner) {
    score += 1;
    evidence.push("an assigned owner");
  }
  if (input.hasContact) {
    score += 1;
    evidence.push("a named contact");
  }
  if (input.hasSecondary) {
    score += 1;
    evidence.push("a secondary owner");
  }
  if (input.liveAssociates > 0) {
    score += 2;
    evidence.push(
      input.liveAssociates === 1
        ? "a live associate assignment"
        : `${input.liveAssociates} live associate assignments`,
    );
  } else if (input.pastAssociates > 0) {
    score += 1;
    evidence.push("a past assignment on the account");
  }
  if (input.wonOnAccount) {
    score += 1;
    evidence.push("a won opportunity on this client");
  }
  if (input.recentTouch) {
    score += 1;
    evidence.push("a recent recorded interaction");
  }

  if (!input.hasAccount && score <= 1) {
    return {
      strength: score === 0 ? "Unknown" : "Limited",
      why: score === 0 ? "No relationship evidence is recorded." : `Only ${evidence.join(" and ")} on this lead — no client account yet.`,
    };
  }

  if (score >= 5) {
    return { strength: "Strong", why: `Recorded evidence includes ${evidence.join(", ")}.` };
  }
  if (score >= 3) {
    return { strength: "Developing", why: `Some coverage: ${evidence.join(", ")}.` };
  }
  if (score >= 1) {
    return { strength: "Limited", why: `Thin file: ${evidence.join(", ")}.` };
  }
  return { strength: "Unknown", why: "No relationship evidence is recorded." };
}

export function salesRelationshipIntel(
  state: CrmState,
  scope: { leadId?: string | null; opportunityId?: string | null; accountId?: string | null },
  now = Date.now(),
): SalesRelationshipIntel {
  const opportunity = scope.opportunityId
    ? (state.opportunities ?? []).find((item) => item.id === scope.opportunityId) ?? null
    : null;
  const lead: Lead | null = scope.leadId
    ? (state.leads ?? []).find((item) => item.id === scope.leadId) ?? null
    : opportunity?.leadId
      ? (state.leads ?? []).find((item) => item.id === opportunity.leadId) ?? null
      : null;
  const linkedOpp: Opportunity | null =
    opportunity ??
    (lead?.convertedOpportunityId
      ? (state.opportunities ?? []).find((item) => item.id === lead.convertedOpportunityId) ?? null
      : (state.opportunities ?? []).find((item) => item.leadId === lead?.id) ?? null);

  const accountId = scope.accountId ?? linkedOpp?.accountId ?? lead?.accountId ?? null;
  const account = accountId ? state.tessiant?.accounts.find((item) => item.id === accountId) : null;
  const accountContact = accountId
    ? (state.contacts ?? []).find((item) => item.accountId === accountId && item.isPrimary) ??
      (state.contacts ?? []).find((item) => item.accountId === accountId) ??
      null
    : null;
  const contactId = linkedOpp?.contactId ?? lead?.convertedContactId ?? accountContact?.id ?? null;
  const ownerId = linkedOpp?.ownerId ?? lead?.ownerId ?? account?.primaryOwnerId ?? null;
  const ownerName = memberName(state, ownerId) ?? "Unassigned";
  const network = accountId ? networkOnAccount(state, accountId) : [];
  const liveAssociates = network.filter((item) => item.detail.startsWith("Associate on") || item.detail.startsWith("SIA on")).length;
  const pastAssociates = network.length - liveAssociates;
  const clients = accountId ? clientLinks(state, accountId, linkedOpp?.id) : [];
  const lastInteraction = lastMeaningfulInteraction(state, {
    leadId: lead?.id,
    accountId,
    opportunityId: linkedOpp?.id,
    contactId,
  });
  const fourteenDays = 14 * 24 * 60 * 60 * 1000;
  const recentTouch = Boolean(lastInteraction && now - new Date(lastInteraction.at).getTime() <= fourteenDays);
  const wonOnAccount = Boolean(
    accountId &&
      (state.opportunities ?? []).some(
        (item) => item.accountId === accountId && item.stage === "Closed Won" && item.id !== linkedOpp?.id,
      ),
  );

  const missing: string[] = [];
  if (!ownerId) missing.push("relationship owner");
  if (!accountId) missing.push("client account");
  if (!contactId) missing.push("named contact");
  if (account && !account.secondaryOwnerId) missing.push("secondary owner");
  if (accountId && network.length === 0) missing.push("associate/SIA on this account");
  if (!lastInteraction) missing.push("last meaningful interaction");

  const { strength, why } = scoreStrength({
    hasAccount: Boolean(account),
    hasOwner: Boolean(ownerId),
    hasContact: Boolean(contactId),
    hasSecondary: Boolean(account?.secondaryOwnerId),
    liveAssociates,
    pastAssociates,
    recentTouch,
    wonOnAccount,
  });

  const coverageLabel =
    missing.length === 0
      ? "Coverage is complete on recorded fields."
      : `Missing: ${missing.join(", ")}.`;

  const nextAction =
    linkedOpp?.nextStep?.trim() ||
    lead?.nextAction?.trim() ||
    (missing.includes("named contact")
      ? "Add a stakeholder on the account"
      : missing.includes("relationship owner")
        ? "Assign a relationship owner"
        : "Log the next client conversation");

  return {
    strength,
    strengthWhy: why,
    ownerName,
    network,
    clients,
    lastInteraction,
    missing,
    coverageLabel,
    nextAction,
    recommendation: null,
  };
}
