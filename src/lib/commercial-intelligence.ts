// Commercial prompts from recorded assignments, contacts, and open opportunities.
// An ending date is not a renewal, and a named contact is not a new deal.

import { resolveAssignmentAccountId } from "./assignments";
import { formatDate, todayKey } from "./format";
import { opportunityBrief } from "./record-intelligence";
import { assignmentsEndingSoon } from "./tessiant-insights";
import type { CrmState, Opportunity } from "./types";

export interface EngagementInsight {
  id: string;
  accountId: string;
  accountName: string;
  contactId: string | null;
  contactName: string | null;
  assignmentId: string;
  title: string;
  detail: string;
}

export function engagementInsights(state: CrmState, today = todayKey()): EngagementInsight[] {
  const ending = assignmentsEndingSoon(state, today);
  const byAccount = new Map<string, typeof ending>();
  for (const placement of ending) {
    const accountId = resolveAssignmentAccountId(state, placement);
    if (!accountId) continue;
    const list = byAccount.get(accountId) ?? [];
    list.push(placement);
    byAccount.set(accountId, list);
  }

  const insights: EngagementInsight[] = [];
  for (const [accountId, placements] of byAccount) {
    const account = state.tessiant?.accounts.find((item) => item.id === accountId);
    if (!account) continue;
    const contacts = (state.contacts ?? []).filter((item) => item.accountId === accountId);
    const contact = contacts.find((item) => item.isPrimary) ?? contacts[0] ?? null;
    const soonest = [...placements].sort((a, b) => (a.terms.endDate ?? "").localeCompare(b.terms.endDate ?? ""))[0];
    const associate = state.tessiant?.associates.find((item) => item.id === soonest.associateId);
    const end = soonest.terms.endDate ? formatDate(soonest.terms.endDate) : "soon";
    const extra = placements.length > 1 ? ` ${placements.length} assignments end within 30 days.` : "";
    insights.push({
      id: `end:${accountId}`,
      accountId,
      accountName: account.name,
      contactId: contact?.id ?? null,
      contactName: contact?.name ?? null,
      assignmentId: soonest.id,
      title: contact
        ? `Re-engage ${contact.name} at ${account.name} to explore the next engagement.`
        : `${account.name} has an engagement ending ${end}. No contact is recorded.`,
      detail: `${associate?.name ?? "An associate"}'s assignment ends ${end}.${extra} Recorded end date — not a confirmed renewal.`,
    });
  }

  return insights.sort((a, b) => a.accountName.localeCompare(b.accountName));
}

/** Same signal on the opportunity board and the list. */
export function opportunitySignal(state: CrmState, opportunity: Opportunity): string | null {
  if (opportunity.stage === "Closed Won" || opportunity.stage === "Closed Lost") return null;
  const brief = opportunityBrief(state, opportunity);
  if (brief.why.startsWith("Closing") || brief.why.startsWith("Stalled") || brief.why.startsWith("Coverage")) {
    return brief.why;
  }
  return null;
}
