// Sales growth insights from recorded Tessiant relationships only.
// No inferred personal ties, no invented prospects, no external research.

import { liveAssignments, resolveAssignmentAccountId } from "./assignments";
import { addDays, todayKey } from "./format";
import type { CrmState, LeadSource, Opportunity } from "./types";
import type { Placement } from "./tessiant-types";

export type GrowthKind = "single_owner" | "staffing_no_consulting" | "network_connection";
export type GrowthAction = "review" | "followup" | "opportunity";

export interface GrowthInsight {
  id: string;
  kind: GrowthKind;
  accountId: string;
  accountName: string;
  detected: string;
  risk: string;
  evidence: string;
  actionLabel: string;
  actions: GrowthAction[];
  opportunityId: string | null;
  associateId: string | null;
  assignmentId: string | null;
  leadId: string | null;
  accountHref: string;
}

export const LEAD_SOURCE_BUCKETS = [
  {
    id: "referral",
    label: "Referral / founder introductions",
    sources: ["Referral"] as const,
  },
  {
    id: "network",
    label: "Associate / SIA introductions",
    sources: ["Associate introduction", "SIA introduction"] as const,
  },
  {
    id: "inbound",
    label: "Inbound enquiries",
    sources: ["Inbound", "Website"] as const,
  },
  {
    id: "campaign",
    label: "Campaign-generated leads",
    sources: ["Campaign", "Event"] as const,
  },
  {
    id: "other",
    label: "Other sources",
    sources: ["Partner", "Outbound", "Manual entry", "Existing client"] as const,
  },
] as const;

export type LeadSourceBucketId = (typeof LEAD_SOURCE_BUCKETS)[number]["id"];

const CONSULTING_TYPES = new Set(["consultancy", "advisory"]);
const MAX_INSIGHTS = 3;

function accountName(state: CrmState, accountId: string) {
  return state.tessiant?.accounts.find((item) => item.id === accountId)?.name ?? "Account";
}

function memberName(state: CrmState, id: string | null | undefined) {
  if (!id) return null;
  return state.members.find((item) => item.id === id)?.name ?? null;
}

function associateName(state: CrmState, id: string | null | undefined) {
  if (!id) return null;
  return state.tessiant?.associates.find((item) => item.id === id)?.name ?? null;
}

function isConsultingOpportunity(opportunity: Opportunity) {
  if (CONSULTING_TYPES.has(opportunity.type)) return true;
  return opportunity.services.some((item) => /consult|advis|\bsia\b/i.test(item));
}

function opportunitiesFor(state: CrmState, accountId: string) {
  return (state.opportunities ?? []).filter((item) => item.accountId === accountId);
}

function assignmentsFor(state: CrmState, accountId: string): Placement[] {
  return (state.tessiant?.placements ?? []).filter(
    (item) => resolveAssignmentAccountId(state, item) === accountId,
  );
}

function leadSourceBucketId(source: string): LeadSourceBucketId {
  for (const bucket of LEAD_SOURCE_BUCKETS) {
    if ((bucket.sources as readonly string[]).includes(source)) return bucket.id;
  }
  return "other";
}

export function leadSourceSummary(state: CrmState) {
  const counts: Record<LeadSourceBucketId, number> = {
    referral: 0,
    network: 0,
    inbound: 0,
    campaign: 0,
    other: 0,
  };
  for (const lead of state.leads) {
    counts[leadSourceBucketId(lead.source)] += 1;
  }
  return LEAD_SOURCE_BUCKETS.map((bucket) => ({
    id: bucket.id,
    label: bucket.label,
    count: counts[bucket.id],
    href: "/sales/leads",
  }));
}

function singleOwnerInsight(state: CrmState, accountId: string): GrowthInsight | null {
  const account = state.tessiant?.accounts.find((item) => item.id === accountId);
  if (!account || account.status === "inactive") return null;
  if (!account.primaryOwnerId || account.secondaryOwnerId) return null;
  const owner = memberName(state, account.primaryOwnerId) ?? "the primary owner";
  return {
    id: `growth:owner:${account.id}`,
    kind: "single_owner",
    accountId: account.id,
    accountName: account.name,
    detected: `${account.name} has a single documented relationship owner.`,
    risk: "Client continuity depends on one person. Consider establishing a second senior contact.",
    evidence: `Primary owner on record: ${owner}. No secondary owner is documented.`,
    actionLabel: "Assign follow-up",
    actions: ["review", "followup"],
    opportunityId: null,
    associateId: null,
    assignmentId: null,
    leadId: account.linkedLeadId,
    accountHref: `/sales/accounts/${account.id}`,
  };
}

function staffingWithoutConsultingInsight(state: CrmState, accountId: string, today: string): GrowthInsight | null {
  const live = liveAssignments(state, today).filter((item) => resolveAssignmentAccountId(state, item) === accountId);
  if (live.length === 0) return null;
  const opps = opportunitiesFor(state, accountId);
  if (opps.some(isConsultingOpportunity)) return null;
  const placement = live[0];
  const associate = associateName(state, placement?.associateId);
  const staffingCount = live.length;
  return {
    id: `growth:staffing:${accountId}`,
    kind: "staffing_no_consulting",
    accountId,
    accountName: accountName(state, accountId),
    detected: `${accountName(state, accountId)} has staffing engagements but no related consulting opportunity.`,
    risk: "Existing delivery work is not yet represented as a consultancy pipeline. This is a possible follow-on, not realised revenue.",
    evidence: associate
      ? `${associate} has a recorded assignment (${staffingCount} staffing record${staffingCount === 1 ? "" : "s"}). No consultancy or advisory opportunity is on the account.`
      : `${staffingCount} recorded staffing assignment${staffingCount === 1 ? "" : "s"} and no consultancy or advisory opportunity.`,
    actionLabel: "Create opportunity",
    actions: ["review", "opportunity"],
    opportunityId: null,
    associateId: placement?.associateId ?? null,
    assignmentId: placement?.id ?? null,
    leadId: state.tessiant?.accounts.find((item) => item.id === accountId)?.linkedLeadId ?? null,
    accountHref: `/sales/accounts/${accountId}`,
  };
}

function networkConnectionInsight(state: CrmState, accountId: string, today: string): GrowthInsight | null {
  const placements = assignmentsFor(state, accountId).filter((item) => item.associateId);
  if (placements.length === 0) return null;
  const open = opportunitiesFor(state, accountId).filter(
    (item) => item.stage !== "Closed Won" && item.stage !== "Closed Lost",
  );
  if (open.length === 0) return null;

  const placement = placements.find((item) => liveAssignments(state, today).some((live) => live.id === item.id)) ?? placements[0];
  const associate = associateName(state, placement.associateId);
  if (!associate) return null;
  const opportunity =
    open.find((item) => item.id !== placement.requirementId) ??
    open[0];
  return {
    id: `growth:network:${accountId}:${placement.id}`,
    kind: "network_connection",
    accountId,
    accountName: accountName(state, accountId),
    detected: `${associate} has a recorded connection to ${accountName(state, accountId)}.`,
    risk: `Use the recorded assignment as context for ${opportunity.name} — not an inferred personal introduction.`,
    evidence: `${associate} assignment on record. Open opportunity: ${opportunity.name}.`,
    actionLabel: "Assign follow-up",
    actions: ["review", "followup"],
    opportunityId: opportunity.id,
    associateId: placement.associateId,
    assignmentId: placement.id,
    leadId: opportunity.leadId,
    accountHref: `/sales/accounts/${accountId}`,
  };
}

function preferredInsightForAccount(state: CrmState, accountId: string, today: string): GrowthInsight | null {
  const owner = singleOwnerInsight(state, accountId);
  const network = networkConnectionInsight(state, accountId, today);
  const staffing = staffingWithoutConsultingInsight(state, accountId, today);
  if (owner) return owner;
  if (staffing) return staffing;
  return network;
}

export function salesGrowthInsights(state: CrmState, today = todayKey()): GrowthInsight[] {
  const accounts = (state.tessiant?.accounts ?? []).filter((item) => item.status !== "inactive");
  const candidates = accounts
    .map((account) => preferredInsightForAccount(state, account.id, today))
    .filter((item): item is GrowthInsight => Boolean(item));

  const owners = candidates.filter((item) => item.kind === "single_owner");
  const staffing = candidates.filter((item) => item.kind === "staffing_no_consulting");
  const network = candidates.filter((item) => item.kind === "network_connection");

  const recs: GrowthInsight[] = [];
  const used = new Set<string>();
  for (const list of [owners, staffing, network]) {
    for (const item of list) {
      if (used.has(item.accountId)) continue;
      used.add(item.accountId);
      recs.push(item);
      if (recs.length >= MAX_INSIGHTS) return recs;
    }
  }
  return recs;
}

export function consultingFollowOnDraft(state: CrmState, accountId: string) {
  const account = state.tessiant?.accounts.find((item) => item.id === accountId);
  if (!account) return null;
  const contact = (state.contacts ?? []).find((item) => item.accountId === accountId && item.isPrimary) ?? (state.contacts ?? []).find((item) => item.accountId === accountId);
  return {
    name: `${account.name} · consultancy follow-on`,
    accountId,
    contactId: contact?.id ?? null,
    leadId: account.linkedLeadId ?? null,
    type: "consultancy" as const,
    stage: "Qualification" as const,
    amount: 0,
    currency: "GBP" as const,
    expectedCloseDate: addDays(30),
    ownerId: account.primaryOwnerId,
    services: ["Consultancy"],
    nextStep: "Qualify consulting follow-on from recorded staffing work — pipeline only",
    source: "Existing client" as LeadSource,
    agreedContractValue: null,
    expectedBilling: null,
    recognisedRevenue: null,
    lostReason: null,
  };
}
