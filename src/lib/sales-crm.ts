// Tessiant Sales helpers — Salesforce-style B2B consulting/staffing CRM patterns.

import type { CrmState, Lead, LeadSource, LeadStatus, Opportunity, OpportunityStage } from "./types";
import { liveAssignments, resolveAssignmentAccountId } from "./assignments";
import { todayKey } from "./format";

const LEGACY_LEAD_STATUS: Record<string, LeadStatus> = {
  Contacted: "Working",
  Won: "Converted",
  Lost: "Unqualified",
  New: "New",
  Working: "Working",
  Qualified: "Qualified",
  Unqualified: "Unqualified",
  Converted: "Converted",
};

const LEGACY_LEAD_SOURCE: Record<string, LeadSource> = {
  "Qiko Signal": "Website",
  "Free audit": "Website",
  Website: "Website",
  "Manual entry": "Manual entry",
  Referral: "Referral",
  Event: "Event",
  Partner: "Partner",
  Outbound: "Outbound",
  "Existing client": "Existing client",
};

export function normalizeLeadStatus(status: string): LeadStatus {
  return LEGACY_LEAD_STATUS[status] ?? "New";
}

export function normalizeLeadSource(source: string): LeadSource {
  return LEGACY_LEAD_SOURCE[source] ?? "Manual entry";
}

export function adaptLeadRecord(lead: Lead): Lead {
  return {
    ...lead,
    status: normalizeLeadStatus(lead.status),
    source: normalizeLeadSource(lead.source),
    sector: lead.sector ?? null,
    serviceInterest: lead.serviceInterest ?? null,
    accountId: lead.accountId ?? null,
  };
}

export function isOpenLead(status: string) {
  const normalized = normalizeLeadStatus(status);
  return normalized !== "Converted" && normalized !== "Unqualified";
}

export function stageProbability(stage: OpportunityStage): number {
  switch (stage) {
    case "Qualification":
      return 10;
    case "Discovery":
      return 25;
    case "Proposal":
      return 50;
    case "Negotiation":
      return 75;
    case "Closed Won":
      return 100;
    case "Closed Lost":
      return 0;
  }
}

/** Weighted pipeline value — never treat as recognised revenue. */
export function weightedPipelineValue(opportunity: Opportunity) {
  if (opportunity.stage === "Closed Lost") return 0;
  if (opportunity.stage === "Closed Won") return opportunity.agreedContractValue ?? opportunity.amount;
  return Math.round((opportunity.amount * (opportunity.probability || stageProbability(opportunity.stage))) / 100);
}

export function commercialBuckets(state: CrmState) {
  const opps = state.opportunities ?? [];
  let pipeline = 0;
  let weighted = 0;
  let agreed = 0;
  let expectedBilling = 0;
  let recognised = 0;
  for (const opportunity of opps) {
    if (opportunity.stage !== "Closed Won" && opportunity.stage !== "Closed Lost") {
      pipeline += opportunity.amount;
      weighted += weightedPipelineValue(opportunity);
    }
    if (opportunity.stage === "Closed Won") {
      agreed += opportunity.agreedContractValue ?? opportunity.amount;
      expectedBilling += opportunity.expectedBilling ?? 0;
      recognised += opportunity.recognisedRevenue ?? 0;
    }
  }
  return { pipeline, weighted, agreed, expectedBilling, recognised };
}

export function opportunitiesForAccount(state: CrmState, accountId: string) {
  return (state.opportunities ?? []).filter((item) => item.accountId === accountId);
}

export function contactsForAccount(state: CrmState, accountId: string) {
  return (state.contacts ?? []).filter((item) => item.accountId === accountId);
}

export function client360(state: CrmState, accountId: string) {
  const account = state.tessiant?.accounts.find((item) => item.id === accountId);
  if (!account) return null;
  const today = todayKey();
  const contacts = contactsForAccount(state, accountId);
  const opportunities = opportunitiesForAccount(state, accountId);
  const requirements = (state.tessiant?.requirements ?? []).filter((item) => item.accountId === accountId);
  const assignments = (state.tessiant?.placements ?? []).filter(
    (item) => resolveAssignmentAccountId(state, item) === accountId,
  );
  const live = liveAssignments(state, today).filter((item) => resolveAssignmentAccountId(state, item) === accountId);
  const past = assignments.filter((item) => !live.some((liveItem) => liveItem.id === item.id));
  const openPipeline = opportunities.filter((item) => item.stage !== "Closed Won" && item.stage !== "Closed Lost");
  const won = opportunities.filter((item) => item.stage === "Closed Won");
  const tasks = state.tasks.filter(
    (task) =>
      task.accountId === accountId ||
      (task.leadId && state.leads.find((lead) => lead.id === task.leadId)?.accountId === accountId) ||
      (task.opportunityId && opportunities.some((opp) => opp.id === task.opportunityId)),
  );
  const events = state.events.filter(
    (event) =>
      event.accountId === accountId ||
      (event.leadId && state.leads.find((lead) => lead.id === event.leadId)?.accountId === accountId) ||
      (event.opportunityId && opportunities.some((opp) => opp.id === event.opportunityId)),
  );
  const primary = state.members.find((item) => item.id === account.primaryOwnerId);
  const secondary = state.members.find((item) => item.id === account.secondaryOwnerId);

  return {
    account,
    contacts,
    opportunities,
    openPipeline,
    won,
    requirements,
    activeRequirements: requirements.filter((item) => item.outcome === "active" && item.stage !== "Placed"),
    liveAssignments: live,
    pastAssignments: past,
    tasks: tasks.filter((task) => task.status === "pending" || task.status === "in_progress"),
    events: events.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt)).slice(0, 40),
    primary,
    secondary,
    founderDependency: Boolean(account.primaryOwnerId && !account.secondaryOwnerId),
    commercial: {
      pipeline: openPipeline.reduce((sum, item) => sum + item.amount, 0),
      agreed: won.reduce((sum, item) => sum + (item.agreedContractValue ?? item.amount), 0),
      expectedBilling: won.reduce((sum, item) => sum + (item.expectedBilling ?? 0), 0),
      recognised: won.reduce((sum, item) => sum + (item.recognisedRevenue ?? 0), 0),
    },
  };
}

export const OPPORTUNITY_STAGE_HINTS: Record<OpportunityStage, string> = {
  Qualification: "Confirm need, budget signal and fit",
  Discovery: "Scope services and stakeholders",
  Proposal: "Commercial proposal with client",
  Negotiation: "Terms, rates and contracting",
  "Closed Won": "Hand to delivery / staffing",
  "Closed Lost": "Capture reason and learn",
};
