// Contact intelligence: what the recorded stakeholder file says, derived read-only from CRM state.
// No persistence. Each signal names the record it came from and the next step the user can take.

import type { CrmState } from "./types";
import { engagementInsights } from "./commercial-intelligence";
import { isOpen } from "./insights";
import { plural, timeAgo } from "./format";

export interface ContactSignal {
  id: string;
  kind: "Going quiet" | "No primary contact" | "Engagement ending" | "Single stakeholder";
  title: string;
  detail: string;
  contactId: string | null;
  accountId: string;
  actionLabel: string;
}

export interface StakeholderCoverageRow {
  accountId: string;
  accountName: string;
  contacts: number;
  openOpportunities: number;
  hasPrimary: boolean;
}

const DAY = 86_400_000;

function lastTouchFor(state: CrmState, contactId: string, accountId: string, name: string): string | null {
  const needle = name.toLowerCase();
  let latest: string | null = null;
  for (const event of state.events ?? []) {
    const hit = event.contactId === contactId || event.accountId === accountId || event.title.toLowerCase().includes(needle);
    if (!hit) continue;
    if (!latest || event.occurredAt > latest) latest = event.occurredAt;
  }
  return latest;
}

export function stakeholderCoverage(state: CrmState): StakeholderCoverageRow[] {
  const accounts = state.tessiant?.accounts ?? [];
  return accounts
    .map((account) => {
      const contacts = (state.contacts ?? []).filter((item) => item.accountId === account.id);
      const openOpportunities = (state.opportunities ?? []).filter(
        (item) => item.accountId === account.id && item.stage !== "Closed Won" && item.stage !== "Closed Lost",
      ).length;
      return {
        accountId: account.id,
        accountName: account.name,
        contacts: contacts.length,
        openOpportunities,
        hasPrimary: contacts.some((item) => item.isPrimary),
      };
    })
    .sort((a, b) => b.openOpportunities - a.openOpportunities || b.contacts - a.contacts);
}

export function contactIntelligence(state: CrmState, now = Date.now()): ContactSignal[] {
  const signals: ContactSignal[] = [];
  const coverage = stakeholderCoverage(state);
  const openTaskContactIds = new Set(state.tasks.filter(isOpen).map((task) => task.contactId).filter(Boolean));

  // Contacts on accounts with live pipeline that nobody has touched for 14+ days.
  for (const contact of state.contacts ?? []) {
    const row = coverage.find((item) => item.accountId === contact.accountId);
    if (!row || row.openOpportunities === 0) continue;
    if (openTaskContactIds.has(contact.id)) continue;
    const last = lastTouchFor(state, contact.id, contact.accountId, contact.name);
    const age = last ? (now - new Date(last).getTime()) / DAY : Infinity;
    if (age < 14) continue;
    signals.push({
      id: `quiet-${contact.id}`,
      kind: "Going quiet",
      title: `${contact.name} · ${row.accountName}`,
      detail: last
        ? `Last recorded touch ${timeAgo(last, now)} while ${plural(row.openOpportunities, "opportunity", "opportunities")} ${row.openOpportunities === 1 ? "is" : "are"} open.`
        : `No recorded interaction while ${plural(row.openOpportunities, "opportunity", "opportunities")} ${row.openOpportunities === 1 ? "is" : "are"} open.`,
      contactId: contact.id,
      accountId: contact.accountId,
      actionLabel: "Plan a touch",
    });
  }

  // Accounts with pipeline but no primary stakeholder, or only one stakeholder.
  for (const row of coverage) {
    if (row.openOpportunities === 0) continue;
    if (row.contacts === 0 || !row.hasPrimary) {
      signals.push({
        id: `primary-${row.accountId}`,
        kind: "No primary contact",
        title: row.accountName,
        detail:
          row.contacts === 0
            ? `${plural(row.openOpportunities, "open opportunity", "open opportunities")} with no named stakeholder.`
            : `${plural(row.contacts, "contact")} recorded, none marked primary.`,
        contactId: null,
        accountId: row.accountId,
        actionLabel: "Open account",
      });
    } else if (row.contacts === 1) {
      signals.push({
        id: `single-${row.accountId}`,
        kind: "Single stakeholder",
        title: row.accountName,
        detail: "One contact carries the whole relationship. Multi-thread before the next proposal.",
        contactId: (state.contacts ?? []).find((item) => item.accountId === row.accountId)?.id ?? null,
        accountId: row.accountId,
        actionLabel: "Open account",
      });
    }
  }

  for (const insight of engagementInsights(state).filter((item) => item.contactId)) {
    signals.push({
      id: `ending-${insight.id}`,
      kind: "Engagement ending",
      title: insight.title,
      detail: insight.detail,
      contactId: insight.contactId,
      accountId: insight.accountId,
      actionLabel: "Re-engage",
    });
  }

  const rank: Record<ContactSignal["kind"], number> = { "Engagement ending": 0, "Going quiet": 1, "No primary contact": 2, "Single stakeholder": 3 };
  return signals.sort((a, b) => rank[a.kind] - rank[b.kind]);
}
