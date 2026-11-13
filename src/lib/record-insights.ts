// "Qiko on this record" for every entity: one verdict, the facts behind it (labelled fact or
// inference), and the next step. Read-only over CRM state; every builder reuses an existing lib.

import type { IconName } from "@/components/ui/Icon";
import type { IconTone } from "@/components/ui/IconTile";
import type { Contact, CrmState, Opportunity, Suggestion } from "./types";
import type { Associate, ClientRequirement, Placement } from "./tessiant-types";
import type { LeadView, Workspace } from "./insights";
import { isOpen } from "./insights";
import { salesRelationshipIntel } from "./sales-relationship";
import { isStaffingOpportunity, opportunityBrief, staffingCoveragePreview } from "./record-intelligence";
import { contactIntelligence } from "./contact-intelligence";
import { engagementInsights } from "./commercial-intelligence";
import { opportunitiesForAccount, weightedPipelineValue } from "./sales-crm";
import { assignmentAttentionKind, availabilityAttentionReason, availableMatchingRequirementIds } from "./talent-network-intel";
import { needsProfileUpdate } from "./talent-network";
import { associateCommittedCapacity, resolveAssignmentAccountId } from "./assignments";
import { requirementSignals } from "./staffing-intelligence";
import { recommendedMatches } from "./requirement-recommendations";
import { daysOpen, requisitionCounts } from "./requisition";
import { assignmentRenewalStatus, formatCandidateProgress, verifiedAvailableMatchCount } from "./tessiant-insights";
import { recommendationsForAssignment } from "./assignment-recommendations";
import { compactMoney } from "./home-tessiant";
import { formatDate, plural, timeAgo, todayKey } from "./format";

export interface RecordInsightFact {
  text: string;
  kind: "fact" | "inference";
}

export interface RecordInsightData {
  headline: string;
  tone: IconTone;
  icon: IconName;
  facts: RecordInsightFact[];
  next: string;
  /** What Qiko could not find on the record. Honest gaps, so the verdict is read with them in mind. */
  unknowns?: string[];
}

const DAY = 86_400_000;

function fact(text: string): RecordInsightFact {
  return { text, kind: "fact" };
}

function infer(text: string): RecordInsightFact {
  return { text, kind: "inference" };
}

// — Lead ————————————————————————————————————————————————————————

function leadInsightCore(state: CrmState, workspace: Workspace, lead: LeadView, now = Date.now()): RecordInsightData & { suggestion: Suggestion | null } {
  const suggestion = workspace.suggestions.find((item) => item.leadId === lead.id) ?? null;
  const relationship = salesRelationshipIntel(state, { leadId: lead.id }, now);
  const events = workspace.byLead.get(lead.id) ?? [];
  const recent = events.filter((event) => now - new Date(event.occurredAt).getTime() <= 30 * DAY).length;
  const facts: RecordInsightFact[] = [
    fact(`Engagement ${lead.engagementScore}/100 · ${plural(recent, "activity", "activities")} in the last 30 days`),
    fact(lead.lastActivity ? `Last activity: ${lead.lastActivity.title} · ${timeAgo(lead.lastActivity.occurredAt, now)}` : "No activity recorded yet"),
    infer(`${relationship.strength} relationship. ${relationship.strengthWhy}`),
  ];
  if (suggestion) facts.push(infer(suggestion.reason));

  if (lead.status === "Converted") {
    return { headline: "Converted. Work the linked opportunity.", tone: "success", icon: "checkCircle", facts, next: "Progress the opportunity on the board", suggestion: null };
  }
  if (lead.status === "Unqualified") {
    return { headline: "Marked unqualified.", tone: "info", icon: "circle", facts, next: "Nothing planned. Re-qualify only if a new signal arrives", suggestion: null };
  }
  if (suggestion) {
    return {
      headline: suggestion.title,
      tone: suggestion.priority === "high" ? "danger" : "warning",
      icon: "zap",
      facts,
      next: `${suggestion.title}${suggestion.suggestedDue ? ` by ${formatDate(suggestion.suggestedDue)}` : ""}`,
      suggestion,
    };
  }
  return {
    headline: lead.openTasks[0] ? `Follow-up planned: ${lead.openTasks[0].title}` : `${lead.status} lead · ${lead.nextActionLabel}`,
    tone: lead.engagementScore >= 60 ? "success" : "info",
    icon: lead.engagementScore >= 60 ? "trendUp" : "userCheck",
    facts,
    next: lead.nextActionLabel,
    suggestion: null,
  };
}

// — Account ——————————————————————————————————————————————————————

function accountInsightCore(state: CrmState, accountId: string, now = Date.now()): RecordInsightData {
  const account = state.tessiant?.accounts.find((item) => item.id === accountId);
  const relationship = salesRelationshipIntel(state, { accountId }, now);
  const open = opportunitiesForAccount(state, accountId).filter((item) => item.stage !== "Closed Won" && item.stage !== "Closed Lost");
  const pipeline = open.reduce((sum, item) => sum + item.amount, 0);
  const ending = engagementInsights(state).find((item) => item.accountId === accountId) ?? null;
  const uncovered = (state.tessiant?.requirements ?? []).filter(
    (req) => req.accountId === accountId && !req.archived && req.outcome === "active" && req.stage !== "Placed" && verifiedAvailableMatchCount(state, req.id) === 0,
  );
  const singleOwner = Boolean(account?.primaryOwnerId && !account.secondaryOwnerId);
  const facts: RecordInsightFact[] = [
    fact(`${plural(open.length, "open opportunity", "open opportunities")} · ${compactMoney(pipeline)} pipeline`),
    fact(relationship.lastInteraction ? `Last touch: ${relationship.lastInteraction.title} · ${timeAgo(relationship.lastInteraction.at, now)}` : "No meaningful interaction recorded"),
    infer(`${relationship.strength} relationship. ${relationship.strengthWhy}`),
  ];
  if (relationship.network.length) facts.push(fact(`${plural(relationship.network.length, "person", "people")} in the network recorded on this account`));

  if (singleOwner) {
    return { headline: "Only one relationship owner is recorded", tone: "warning", icon: "users", facts, next: "Add a second senior owner before the next proposal" };
  }
  if (ending) {
    return { headline: ending.title, tone: "warning", icon: "calendar", facts: [fact(ending.detail), ...facts], next: "Plan the re-engage conversation now" };
  }
  if (uncovered.length) {
    return { headline: `${plural(uncovered.length, "open requirement")} without verified cover`, tone: "danger", icon: "shield", facts, next: `Review sourcing on ${uncovered[0].title}` };
  }
  return { headline: `${relationship.strength} relationship, ${relationship.coverageLabel.toLowerCase()}`, tone: relationship.strength === "Strong" ? "success" : "info", icon: "handshake", facts, next: relationship.nextAction };
}

// — Contact ——————————————————————————————————————————————————————

function contactInsightCore(state: CrmState, contact: Contact, now = Date.now()): RecordInsightData {
  const signals = contactIntelligence(state, now).filter((item) => item.contactId === contact.id || (item.contactId === null && item.accountId === contact.accountId));
  const open = opportunitiesForAccount(state, contact.accountId).filter((item) => item.stage !== "Closed Won" && item.stage !== "Closed Lost");
  const events = (state.events ?? [])
    .filter((event) => event.contactId === contact.id || event.accountId === contact.accountId || event.title.toLowerCase().includes(contact.name.toLowerCase()))
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
  const openTasks = state.tasks.filter((task) => isOpen(task) && (task.contactId === contact.id || task.accountId === contact.accountId));
  const facts: RecordInsightFact[] = [
    fact(contact.isPrimary ? "Primary stakeholder on the account" : "Secondary stakeholder"),
    fact(events[0] ? `Last touch: ${events[0].title} · ${timeAgo(events[0].occurredAt, now)}` : "No interaction recorded"),
    fact(`${plural(open.length, "open opportunity", "open opportunities")} on the account · ${plural(openTasks.length, "open follow-up")}`),
  ];
  const top = signals[0];
  if (top) {
    const tone: IconTone = top.kind === "Engagement ending" ? "warning" : top.kind === "Going quiet" ? "warning" : "info";
    return { headline: top.kind === "Engagement ending" ? top.title : `${top.kind}: ${top.title}`, tone, icon: top.kind === "Going quiet" ? "clock" : top.kind === "Engagement ending" ? "calendar" : "users", facts: [infer(top.detail), ...facts], next: top.actionLabel === "Plan a touch" ? "Plan the next conversation and log it" : top.actionLabel };
  }
  return { headline: "Relationship is current", tone: "success", icon: "userCheck", facts, next: openTasks[0]?.title ?? "Keep the cadence: log the next conversation" };
}

// — Opportunity ——————————————————————————————————————————————————

function opportunityInsightCore(state: CrmState, opportunity: Opportunity, now = Date.now()): RecordInsightData {
  const brief = opportunityBrief(state, opportunity, now);
  const relationship = salesRelationshipIntel(state, { opportunityId: opportunity.id }, now);
  const coverage = staffingCoveragePreview(state, opportunity);
  const facts: RecordInsightFact[] = [
    fact(`${opportunity.stage} · ${opportunity.probability}% · weighted ${compactMoney(weightedPipelineValue(opportunity))} of ${compactMoney(opportunity.amount)}`),
    fact(brief.missing === "Nothing blocking" ? "Nothing blocking on the record" : `Missing: ${brief.missing}`),
    infer(coverage.sentence),
    infer(`${relationship.strength} relationship. ${relationship.strengthWhy}`),
  ];
  const tone: IconTone = brief.why.startsWith("Coverage") ? "danger" : brief.why.startsWith("Stalled") ? "warning" : brief.why.startsWith("Closing") ? "info" : "qiko";
  const icon: IconName = brief.why.startsWith("Coverage") ? "shield" : brief.why.startsWith("Stalled") ? "clock" : brief.why.startsWith("Closing") ? "calendar" : "target";
  return { headline: brief.why, tone, icon, facts, next: brief.next };
}

// — Associate ————————————————————————————————————————————————————

function associateInsightCore(state: CrmState, associate: Associate, today = todayKey()): RecordInsightData {
  const availability = availabilityAttentionReason(associate, today);
  const assignment = assignmentAttentionKind(state, associate, today);
  const matches = availableMatchingRequirementIds(state).has(associate.id);
  const committed = associateCommittedCapacity(state, associate.id, today);
  const facts: RecordInsightFact[] = [
    fact(`${Math.max(0, 100 - committed)}% capacity free · availability ${associate.availability}${associate.nextAvailableDate ? ` from ${formatDate(associate.nextAvailableDate)}` : ""}`),
    fact(associate.verifiedAt ? `Profile verified ${formatDate(associate.verifiedAt)}` : "Profile not verified"),
    fact(`${plural(associate.priorPlacementCount, "prior placement")} · ${associate.sectors.slice(0, 3).join(", ") || "no sectors recorded"}`),
  ];
  if (assignment === "conflict") {
    return { headline: "Listed available while fully deployed", tone: "danger", icon: "alert", facts, next: "Correct availability or the assignment capacity" };
  }
  if (availability) {
    return {
      headline: availability === "unknown" ? "Availability is unknown" : "Availability last confirmed over 90 days ago",
      tone: "warning",
      icon: "clock",
      facts,
      next: "Confirm availability before shortlisting",
    };
  }
  if (matches) {
    return { headline: "Strong fit for an open requirement", tone: "qiko", icon: "target", facts: [infer("Skills and sector match an open brief on record; availability is current."), ...facts], next: "Shortlist against the matching requirement" };
  }
  if (needsProfileUpdate(associate, today)) {
    return { headline: "Profile needs a refresh", tone: "warning", icon: "userCheck", facts, next: "Re-verify CV and availability" };
  }
  return { headline: "Profile is current", tone: "success", icon: "checkCircle", facts, next: assignment === "verify" ? "Verify assignment documents and rates" : "No action needed right now" };
}

// — Requirement ——————————————————————————————————————————————————

function requirementInsightCore(state: CrmState, requirement: ClientRequirement, today = todayKey()): RecordInsightData {
  const signal = requirementSignals(state, today).find((item) => item.requirementId === requirement.id) ?? null;
  const verified = verifiedAvailableMatchCount(state, requirement.id);
  const counts = requisitionCounts(state, requirement.id);
  const top = recommendedMatches(state, requirement, 1).items[0];
  const facts: RecordInsightFact[] = [
    fact(`${verified} verified available · ${formatCandidateProgress(counts)}`),
    fact(`Starts ${formatDate(requirement.startDate)} · ${daysOpen(requirement)} days open · ${plural(requirement.headcount, "position")}`),
  ];
  if (top) facts.push(infer(`${top.associate.name} is the top recorded match (${top.presentation.suitabilityBand}). ${top.reason}`));
  if (signal) {
    const tone: IconTone = signal.kind === "No coverage" || signal.kind === "Start date passed" ? "danger" : "warning";
    const icon: IconName = signal.kind === "No coverage" ? "shield" : signal.kind === "Starts soon" ? "calendar" : signal.kind === "Stalled" ? "clock" : "alert";
    return { headline: `${signal.kind}: ${signal.title}`, tone, icon, facts, next: signal.actionLabel };
  }
  return { headline: requirement.stage === "Placed" ? "Filled" : "On track with verified cover", tone: "success", icon: "checkCircle", facts, next: requirement.stage === "Placed" ? "Track the assignment" : "Progress the shortlist to interview" };
}

// — Assignment ———————————————————————————————————————————————————

function assignmentInsightCore(state: CrmState, assignment: Placement, today = todayKey()): RecordInsightData & { recommendationKind: "renewal" | "redeploy" | null } {
  const rec = recommendationsForAssignment(state, assignment.id, today)[0] ?? null;
  const renewal = assignmentRenewalStatus(assignment, today);
  const end = assignment.terms.endDate;
  const daysLeft = end ? Math.round((new Date(`${end}T00:00:00`).getTime() - new Date(`${today}T00:00:00`).getTime()) / DAY) : null;
  const account = state.tessiant?.accounts.find((item) => item.id === resolveAssignmentAccountId(state, assignment));
  const facts: RecordInsightFact[] = [
    fact(end ? `Ends ${formatDate(end)}${daysLeft !== null ? ` · ${daysLeft} days left` : ""}` : "Open-ended engagement"),
    fact(`${assignment.capacityPercent ?? 100}% capacity · renewal ${renewal.replaceAll("_", " ")}${account ? ` · ${account.name}` : ""}`),
  ];
  if (rec) {
    facts.push(infer(rec.why));
    return { headline: rec.detected, tone: rec.kind === "renewal" ? "warning" : "qiko", icon: rec.kind === "renewal" ? "refresh" : "rocket", facts, next: rec.actionLabel, recommendationKind: rec.kind };
  }
  if (renewal === "renewal_due" || renewal === "ending") {
    return { headline: "Ending soon with no decision recorded", tone: "warning", icon: "calendar", facts, next: "Confirm extension or plan redeployment", recommendationKind: null };
  }
  return { headline: "Running to plan", tone: "success", icon: "checkCircle", facts, next: "Log client feedback at the next checkpoint", recommendationKind: null };
}


// — What Qiko doesn't know ————————————————————————————————————————
// Each wrapper adds the record's honest gaps so every "Qiko on this record" block carries them.

export function leadInsight(state: CrmState, workspace: Workspace, lead: LeadView, now = Date.now()) {
  const unknowns = [
    !lead.phone && "Phone number",
    !lead.company && "Company",
    !lead.role && "Role",
    !lead.sector && "Sector",
    !lead.serviceInterest && "Service interest",
    !lead.accountId && "Linked account",
    !lead.ownerId && "Owner",
    (lead.source === "SIA introduction" || lead.source === "Associate introduction") && !lead.introducedByAssociateId && "Who introduced them",
  ].filter((item): item is string => Boolean(item));
  return { ...leadInsightCore(state, workspace, lead, now), unknowns };
}

export function accountInsight(state: CrmState, accountId: string, now = Date.now()): RecordInsightData {
  const account = state.tessiant?.accounts.find((item) => item.id === accountId);
  const contacts = (state.contacts ?? []).filter((item) => item.accountId === accountId);
  const unknowns = account
    ? [
        !account.website && "Website",
        contacts.length === 0 && "A named stakeholder",
        !account.secondaryOwnerId && "Second relationship owner",
        !(account.servicesPurchased ?? []).length && "What they have bought before",
        !account.notes?.trim() && "Overview notes",
      ].filter((item): item is string => Boolean(item))
    : [];
  return { ...accountInsightCore(state, accountId, now), unknowns };
}

export function contactInsight(state: CrmState, contact: Contact, now = Date.now()): RecordInsightData {
  const touched = state.events.some((event) => event.contactId === contact.id);
  const unknowns = [!contact.phone && "Phone number", !contact.role && "Role", !touched && "Any recorded interaction", !contact.notes?.trim() && "Notes"].filter((item): item is string => Boolean(item));
  return { ...contactInsightCore(state, contact, now), unknowns };
}

export function opportunityInsight(state: CrmState, opportunity: Opportunity, now = Date.now()): RecordInsightData {
  const linked = (state.tessiant?.requirements ?? []).some((item) => item.linkedOpportunityId === opportunity.id);
  const unknowns = [
    !opportunity.contactId && "Sponsor contact",
    !opportunity.nextStep && "Next step",
    opportunity.services.length === 0 && "Services in scope",
    !opportunity.source && "Where it came from",
    isStaffingOpportunity(opportunity.type) && !linked && opportunity.stage !== "Closed Lost" && "Staffing requirement behind it",
  ].filter((item): item is string => Boolean(item));
  return { ...opportunityInsightCore(state, opportunity, now), unknowns };
}

export function associateInsight(state: CrmState, associate: Associate, today = todayKey()): RecordInsightData {
  const unknowns = [
    !associate.rate && "Day rate",
    !associate.verifiedAt && "Verification",
    associate.availability === "unknown" && "Availability",
    associate.availability !== "available" && associate.availability !== "unknown" && !associate.nextAvailableDate && "Next available date",
    !associate.email && "Email",
    associate.sectors.length === 0 && "Sectors",
    !(associate.documents ?? []).length && "CV on file",
  ].filter((item): item is string => Boolean(item));
  return { ...associateInsightCore(state, associate, today), unknowns };
}

export function requirementInsight(state: CrmState, requirement: ClientRequirement, today = todayKey()): RecordInsightData {
  const unknowns = [!requirement.rateMax && "Rate band", !requirement.linkedOpportunityId && "Linked deal", !requirement.description?.trim() && "Brief description", requirement.mustHaveSkills.length === 0 && "Must-have skills"].filter(
    (item): item is string => Boolean(item),
  );
  return { ...requirementInsightCore(state, requirement, today), unknowns };
}

export function assignmentInsight(state: CrmState, assignment: Placement, today = todayKey()) {
  const unknowns = [!assignment.terms?.endDate && "End date", !assignment.terms?.clientRate && "Client rate", !assignment.terms?.associateCost && "Associate cost", !assignment.renewalDate && "Renewal date", !assignment.ownerId && "Owner"].filter(
    (item): item is string => Boolean(item),
  );
  return { ...assignmentInsightCore(state, assignment, today), unknowns };
}
