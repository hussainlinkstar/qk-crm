// Automations with a human in the loop. Each rule reads the store and proposes one concrete action
// per matching record; nothing runs until someone approves it. Approvals and dismissals are
// recorded in `decisions` under an `auto:` key so a proposal never comes back once answered.

import type { CrmState } from "./types";
import { crm } from "./crm-store";
import { liveAssignments, resolveAssignmentAccountId } from "./assignments";
import { isStaffingOpportunity } from "./record-intelligence";
import { verifiedAvailableMatchCount } from "./tessiant-insights";
import { isOpen } from "./insights";
import { addDays, formatDate, todayKey } from "./format";

export type AutomationRuleId = "won_to_requirement" | "renewal_outreach" | "coverage_sweep" | "lead_follow_up";

export interface AutomationRule {
  id: AutomationRuleId;
  name: string;
  trigger: string;
  action: string;
}

export const AUTOMATION_RULES: AutomationRule[] = [
  { id: "won_to_requirement", name: "Closed Won opens the requirement", trigger: "A staffing deal moves to Closed Won with no requirement behind it", action: "Draft the requirement from the deal so sourcing starts the same day" },
  { id: "renewal_outreach", name: "Renewal outreach before the end date", trigger: "An assignment ends within 45 days and nobody owns the renewal conversation", action: "Create the renewal outreach task for the account owner" },
  { id: "coverage_sweep", name: "Sweep when a brief has no cover", trigger: "An open brief has no verified available match", action: "Run the matcher across the network and refresh the shortlist" },
  { id: "lead_follow_up", name: "Chase a lead that went quiet", trigger: "A New or Working lead has had no activity for 14 days and no open task", action: "Create a follow-up task for the lead owner" },
];

export interface AutomationProposal {
  id: string;
  rule: AutomationRule;
  title: string;
  why: string;
  evidence: string;
  href: string | null;
  /** Runs the action and returns the toast line, plus the task it created when there is one. */
  approve: () => { message: string; taskId?: string };
}

const DAY = 86_400_000;

export function automationEnabled(state: CrmState, ruleId: AutomationRuleId): boolean {
  return state.automationPrefs?.[ruleId] !== false;
}

export function automationProposals(state: CrmState, now = Date.now()): AutomationProposal[] {
  const t = state.tessiant;
  if (!t) return [];
  const today = todayKey();
  const answered = (key: string) => Boolean(state.decisions[key]);
  const proposals: AutomationProposal[] = [];
  const rule = (id: AutomationRuleId) => AUTOMATION_RULES.find((item) => item.id === id)!;

  if (automationEnabled(state, "won_to_requirement")) {
    for (const opportunity of (state.opportunities ?? []).filter((item) => item.stage === "Closed Won" && isStaffingOpportunity(item.type))) {
      const key = `auto:won_to_requirement:${opportunity.id}`;
      if (answered(key) || t.requirements.some((item) => item.linkedOpportunityId === opportunity.id)) continue;
      const account = t.accounts.find((item) => item.id === opportunity.accountId)?.name ?? "the client";
      proposals.push({
        id: key,
        rule: rule("won_to_requirement"),
        title: `Draft the requirement behind ${opportunity.name}`,
        why: `Won for ${account}${opportunity.closedAt ? ` on ${formatDate(opportunity.closedAt)}` : ""} with no staffing brief recorded. Every day without one is a day sourcing has not started.`,
        evidence: `Closed Won · ${opportunity.services.join(", ") || opportunity.type} · no requirement linked`,
        href: `/sales/pipeline?opportunity=${opportunity.id}`,
        approve: () => {
          const result = crm.createRequirementFromOpportunity(opportunity.id);
          crm.recordAutomationDecision(key, "done");
          return { message: result.ok ? `Requirement drafted from ${opportunity.name}` : result.error };
        },
      });
    }
  }

  if (automationEnabled(state, "renewal_outreach")) {
    for (const placement of liveAssignments(state, today)) {
      const end = placement.terms.endDate;
      if (!end || end > addDays(45) || end < today) continue;
      const key = `auto:renewal_outreach:${placement.id}`;
      const tag = `[renewal:${placement.id}]`;
      if (answered(key) || state.tasks.some((task) => task.description.includes(tag) && isOpen(task))) continue;
      const accountId = resolveAssignmentAccountId(state, placement);
      const account = t.accounts.find((item) => item.id === accountId);
      const associate = t.associates.find((item) => item.id === placement.associateId);
      const requirement = t.requirements.find((item) => item.id === placement.requirementId);
      const days = Math.round((new Date(end).getTime() - now) / DAY);
      proposals.push({
        id: key,
        rule: rule("renewal_outreach"),
        title: `Open the renewal conversation at ${account?.name ?? "the client"}`,
        why: `${associate?.name ?? "The associate"} finishes in ${days} days. Clients decide extensions about a month out; after that the seat goes to market.`,
        evidence: `Assignment ends ${formatDate(end)} · no renewal task open`,
        href: `/staffing/placements/${placement.id}`,
        approve: () => {
          const taskId = crm.createTask(
            {
              title: `Renewal outreach · ${associate?.name ?? "associate"} at ${account?.name ?? "client"}`,
              description: `Assignment ends ${formatDate(end)}. Ask ${account?.name ?? "the client"} whether ${associate?.name ?? "the associate"} continues, and on what terms. ${tag}${requirement ? ` [requirement:${requirement.id}]` : ""}`,
              priority: days <= 21 ? "high" : "medium",
              due: addDays(Math.max(1, days - 21)),
              ownerId: placement.ownerId ?? account?.primaryOwnerId ?? "me",
              leadId: null,
              accountId: accountId ?? null,
            },
            "suggestion",
            [{ label: `Assignment ends ${formatDate(end)}`, source: "Assignments", kind: "fact" }],
          );
          crm.recordAutomationDecision(key, "done", taskId);
          return { message: "Renewal outreach task created", taskId };
        },
      });
    }
  }

  if (automationEnabled(state, "coverage_sweep")) {
    for (const requirement of t.requirements.filter((item) => !item.archived && item.outcome === "active" && item.stage !== "Placed")) {
      const key = `auto:coverage_sweep:${requirement.id}`;
      if (answered(key) || verifiedAvailableMatchCount(state, requirement.id) > 0) continue;
      const candidates = t.candidates.filter((item) => item.requirementId === requirement.id).length;
      proposals.push({
        id: key,
        rule: rule("coverage_sweep"),
        title: `Sweep the network for ${requirement.title}`,
        why: `No verified available match on the shortlist${candidates ? ` (${candidates} candidate${candidates === 1 ? "" : "s"} recorded, none verified and free)` : ""}. The matcher runs in seconds; waiting costs days.`,
        evidence: `0 verified available · starts ${formatDate(requirement.startDate)} · ${requirement.mustHaveSkills.slice(0, 2).join(", ")}`,
        href: `/staffing/requirements/${requirement.id}`,
        approve: () => {
          const found = crm.findMatches(requirement.id);
          crm.recordAutomationDecision(key, "done");
          return { message: `Sweep done: ${found} match${found === 1 ? "" : "es"} refreshed for ${requirement.title}` };
        },
      });
    }
  }

  if (automationEnabled(state, "lead_follow_up")) {
    // The stalest three only: a wall of chase-ups is noise, not a proposal.
    const quiet = state.leads
      .filter((item) => item.status === "New" || item.status === "Working")
      .map((lead) => ({ lead, last: state.events.filter((event) => event.leadId === lead.id).map((event) => new Date(event.occurredAt).getTime()).sort((a, b) => b - a)[0] ?? new Date(lead.createdAt).getTime() }))
      .sort((a, b) => a.last - b.last)
      .map((item) => item.lead)
      .slice(0, 3);
    for (const lead of quiet) {
      const key = `auto:lead_follow_up:${lead.id}`;
      if (answered(key)) continue;
      const last = state.events.filter((event) => event.leadId === lead.id).map((event) => new Date(event.occurredAt).getTime()).sort((a, b) => b - a)[0] ?? new Date(lead.createdAt).getTime();
      const days = Math.floor((now - last) / DAY);
      if (days < 14 || state.tasks.some((task) => task.leadId === lead.id && isOpen(task))) continue;
      proposals.push({
        id: key,
        rule: rule("lead_follow_up"),
        title: `Chase ${lead.name}${lead.company ? ` at ${lead.company}` : ""}`,
        why: `${lead.status} lead with nothing logged for ${days} days and no task open. Leads that go three weeks quiet rarely come back on their own.`,
        evidence: `Last activity ${days} days ago · ${lead.source}`,
        href: `/sales/leads/${lead.id}`,
        approve: () => {
          const taskId = crm.createTask(
            { title: `Follow up with ${lead.name}`, description: `No activity for ${days} days. Source: ${lead.source}.${lead.serviceInterest ? ` Interest: ${lead.serviceInterest}.` : ""}`, priority: "medium", due: addDays(2), ownerId: lead.ownerId ?? "me", leadId: lead.id, accountId: lead.accountId ?? null },
            "suggestion",
            [{ label: `${days} days without activity`, source: "Lead activity", kind: "fact" }],
          );
          crm.recordAutomationDecision(key, "done", taskId);
          return { message: `Follow-up task created for ${lead.name}`, taskId };
        },
      });
    }
  }

  return proposals;
}

export function automationHistory(state: CrmState): Array<{ key: string; decision: "done" | "dismissed"; at: string }> {
  return Object.entries(state.decisions)
    .filter(([key]) => key.startsWith("auto:"))
    .map(([key, value]) => ({ key, decision: (value.decision === "done" ? "done" : "dismissed") as "done" | "dismissed", at: value.at }))
    .sort((a, b) => b.at.localeCompare(a.at));
}
