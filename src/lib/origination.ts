// Lead origination queue: where the next leads come from, before anyone asks. Every item is read
// from stored records (ending engagements, unpurchased interests, quiet stakeholders, network
// reach). It proposes; the user creates the lead or the task.

import type { CrmState, Contact, LeadSource } from "./types";
import { assignmentsEndingSoon } from "./tessiant-insights";
import { resolveAssignmentAccountId } from "./assignments";
import { opportunitiesForAccount } from "./sales-crm";
import { unpurchasedInterests } from "./record-intelligence";
import { formatDate } from "./format";

export type OriginationKind = "renewal" | "expansion" | "dormant" | "introduction" | "follow-on";

export interface OriginationItem {
  id: string;
  kind: OriginationKind;
  title: string;
  why: string;
  evidence: string;
  evidenceKind: "fact" | "inference";
  impact: 1 | 2 | 3;
  accountId: string | null;
  accountName: string | null;
  contact: Contact | null;
  associateId: string | null;
  /** What creating the lead should carry. */
  lead: { source: LeadSource; serviceInterest: string | null } | null;
  /** Task to raise instead of a lead, for asks that are not yet a prospect. */
  task: { title: string; description: string } | null;
}

const QUIET_DAYS = 45;

export function originationQueue(state: CrmState, now = Date.now()): OriginationItem[] {
  const items: OriginationItem[] = [];
  const accounts = state.tessiant?.accounts ?? [];
  const contactsOf = (accountId: string) => (state.contacts ?? []).filter((item) => item.accountId === accountId);
  const primaryContact = (accountId: string) => {
    const list = contactsOf(accountId);
    return list.find((item) => item.isPrimary) ?? list[0] ?? null;
  };
  const openOpps = (accountId: string) => opportunitiesForAccount(state, accountId).filter((item) => item.stage !== "Closed Won" && item.stage !== "Closed Lost");
  const hasOpenLead = (accountId: string, interest?: string | null) =>
    state.leads.some((lead) => lead.accountId === accountId && !["Converted", "Unqualified"].includes(lead.status) && (!interest || (lead.serviceInterest ?? "").toLowerCase() === interest.toLowerCase()));

  // 1. Engagements ending within 30 days → the next engagement conversation.
  const ending = assignmentsEndingSoon(state);
  const seenEnding = new Set<string>();
  for (const placement of ending) {
    const accountId = resolveAssignmentAccountId(state, placement);
    if (!accountId || seenEnding.has(accountId)) continue;
    seenEnding.add(accountId);
    const account = accounts.find((item) => item.id === accountId);
    if (!account) continue;
    const associate = state.tessiant?.associates.find((item) => item.id === placement.associateId);
    const contact = primaryContact(accountId);
    if (openOpps(accountId).length > 0 || hasOpenLead(accountId)) continue;
    items.push({
      id: `renewal:${placement.id}`,
      kind: "renewal",
      title: `${account.name}: ${associate?.name ?? "an associate"} finishes ${placement.terms.endDate ? formatDate(placement.terms.endDate) : "soon"}`,
      why: "An engagement ending with nothing behind it is the most reliable lead Tessiant has. Open the next conversation before the seat goes cold.",
      evidence: `Assignment end date on file · no open opportunity or lead at ${account.name}`,
      evidenceKind: "fact",
      impact: 3,
      accountId,
      accountName: account.name,
      contact,
      associateId: associate?.id ?? null,
      lead: contact ? { source: "Existing client", serviceInterest: placement.roleTitle ?? null } : null,
      task: contact ? null : { title: `Find a sponsor at ${account.name} before ${associate?.name ?? "the associate"} finishes`, description: `No client contact is recorded at ${account.name}. Assignment ${placement.id} ends ${placement.terms.endDate ?? "soon"}.` },
    });
  }

  // 2. Services the client said they want but has not bought.
  for (const account of accounts.filter((item) => item.status !== "inactive")) {
    for (const interest of unpurchasedInterests(state, account.id).slice(0, 1)) {
      const already = openOpps(account.id).some((opp) => opp.services.some((service) => service.toLowerCase() === interest.toLowerCase()));
      if (already || hasOpenLead(account.id, interest)) continue;
      const contact = primaryContact(account.id);
      items.push({
        id: `expansion:${account.id}:${interest}`,
        kind: "expansion",
        title: `${account.name} is interested in ${interest} and has not bought it`,
        why: "Recorded interest with nothing in pipeline. A warm client is cheaper to open than a cold prospect.",
        evidence: `Interest recorded on the account · purchased: ${(account.servicesPurchased ?? []).join(", ") || "nothing yet"}`,
        evidenceKind: "fact",
        impact: 2,
        accountId: account.id,
        accountName: account.name,
        contact,
        associateId: null,
        lead: contact ? { source: "Existing client", serviceInterest: interest } : null,
        task: contact ? null : { title: `Identify who owns ${interest} at ${account.name}`, description: `${account.name} lists ${interest} as an interest but no stakeholder is recorded.` },
      });
    }
  }

  // 3. Stakeholders gone quiet on accounts with nothing open.
  for (const account of accounts.filter((item) => item.status === "active")) {
    if (openOpps(account.id).length > 0) continue;
    const contact = primaryContact(account.id);
    if (!contact) continue;
    const last = state.events
      .filter((event) => event.contactId === contact.id || event.accountId === account.id)
      .map((event) => new Date(event.occurredAt).getTime())
      .sort((a, b) => b - a)[0];
    const days = last ? Math.floor((now - last) / 86_400_000) : null;
    if (days !== null && days < QUIET_DAYS) continue;
    if (items.some((item) => item.accountId === account.id)) continue;
    items.push({
      id: `dormant:${account.id}`,
      kind: "dormant",
      title: `${contact.name} at ${account.name} has gone quiet`,
      why: "Active client, nothing open, no touch in weeks. A light check-in keeps Tessiant first call when the next need appears.",
      evidence: days === null ? "No interaction recorded with this account" : `Last recorded touch ${days} days ago`,
      evidenceKind: "fact",
      impact: 1,
      accountId: account.id,
      accountName: account.name,
      contact,
      associateId: null,
      lead: null,
      task: { title: `Check in with ${contact.name} at ${account.name}`, description: `Nothing open at ${account.name}. ${days === null ? "No interaction recorded." : `Last touch ${days} days ago.`} Ask what is coming up next quarter.` },
    });
  }

  // 4. SIAs with sector reach who have not introduced anyone yet.
  const introducedBy = new Map<string, number>();
  for (const lead of state.leads) if (lead.introducedByAssociateId) introducedBy.set(lead.introducedByAssociateId, (introducedBy.get(lead.introducedByAssociateId) ?? 0) + 1);
  const sias = (state.tessiant?.associates ?? [])
    .filter((item) => item.roleType === "SIA" && item.status === "active" && item.sectors.length > 0)
    .map((sia) => ({
      sia,
      made: introducedBy.get(sia.id) ?? 0,
      targets: accounts.filter((account) => sia.sectors.includes(account.sector) && account.status !== "active").map((account) => account.name),
    }))
    // Introducers with a track record first, then those whose sector has prospects waiting; three at a time.
    .sort((a, b) => b.made - a.made || b.targets.length - a.targets.length || a.sia.name.localeCompare(b.sia.name))
    .slice(0, 3);
  for (const { sia, made, targets } of sias) {
    const sector = sia.sectors[0];
    items.push({
      id: `intro:${sia.id}`,
      kind: "introduction",
      title: `Ask ${sia.name} for a ${sector} introduction`,
      why: made > 0 ? `${sia.name} has opened ${made} door${made === 1 ? "" : "s"} already. SIAs who introduce once usually will again.` : `${sia.name} advises in ${sector} and has not yet introduced a prospect. SIA-sourced revenue is 4% of the total today; this is the number to move.`,
      evidence: `${sia.sectors.join(", ")} · ${made} recorded introduction${made === 1 ? "" : "s"}${targets.length ? ` · prospects in sector: ${targets.slice(0, 2).join(", ")}` : ""}`,
      evidenceKind: "inference",
      impact: made > 0 ? 3 : 2,
      accountId: null,
      accountName: null,
      contact: null,
      associateId: sia.id,
      lead: null,
      task: { title: `Ask ${sia.name} for an introduction in ${sector}`, description: `${sia.name} (SIA) · sectors ${sia.sectors.join(", ")}. ${targets.length ? `Prospects in sector: ${targets.join(", ")}.` : "Ask who in their network is planning change."}` },
    });
  }

  // 5. Won deals with nothing following them.
  for (const account of accounts) {
    const won = opportunitiesForAccount(state, account.id).filter((item) => item.stage === "Closed Won");
    if (won.length === 0 || openOpps(account.id).length > 0 || items.some((item) => item.accountId === account.id)) continue;
    const latest = [...won].sort((a, b) => (b.closedAt ?? "").localeCompare(a.closedAt ?? ""))[0];
    const contact = primaryContact(account.id);
    items.push({
      id: `followon:${latest.id}`,
      kind: "follow-on",
      title: `${account.name} bought once and has nothing in pipeline`,
      why: "A won engagement is proof of fit. The follow-on is usually the easiest deal of the year.",
      evidence: `${latest.name} won${latest.closedAt ? ` ${formatDate(latest.closedAt)}` : ""} · no open opportunity`,
      evidenceKind: "fact",
      impact: 2,
      accountId: account.id,
      accountName: account.name,
      contact,
      associateId: null,
      lead: contact ? { source: "Existing client", serviceInterest: latest.services[0] ?? null } : null,
      task: contact ? null : { title: `Find the sponsor of ${latest.name} at ${account.name}`, description: "Won engagement with no stakeholder recorded." },
    });
  }

  return items.sort((a, b) => b.impact - a.impact);
}
