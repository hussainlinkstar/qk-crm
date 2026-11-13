// Founder-dependency score: how much an account relationship rests on one person. Built from
// recorded ownership, stakeholder breadth and who actually logged the interactions. Ownership and
// contacts have no history in the store, so the trend reflects interaction concentration only.

import type { ActivityEvent, CrmState } from "./types";
import { opportunitiesForAccount } from "./sales-crm";

export type DependencyBand = "low" | "medium" | "high";

export interface FounderDependency {
  score: number;
  band: DependencyBand;
  /** Who the relationship rests on, when one person dominates. */
  keyPerson: string | null;
  keyPersonShare: number;
  drivers: Array<{ label: string; points: number; kind: "fact" | "inference" }>;
  /** Monthly score, oldest first, last six month-ends plus now. */
  trend: number[];
  /** Change versus three months ago. Positive means more dependent. */
  delta: number;
}

const MONTH = 30 * 86_400_000;
const WINDOW = 180 * 86_400_000;

function accountEvents(state: CrmState, accountId: string): ActivityEvent[] {
  const opportunityIds = new Set(opportunitiesForAccount(state, accountId).map((item) => item.id));
  const leadIds = new Set(state.leads.filter((lead) => lead.accountId === accountId).map((lead) => lead.id));
  return state.events.filter((event) => event.accountId === accountId || leadIds.has(event.leadId) || (event.opportunityId ? opportunityIds.has(event.opportunityId) : false));
}

function concentration(events: ActivityEvent[], at: number): { share: number; actor: string | null; count: number } {
  const window = events.filter((event) => {
    const t = new Date(event.occurredAt).getTime();
    return t <= at && t > at - WINDOW && event.actor && event.actor !== "System";
  });
  if (window.length === 0) return { share: 0, actor: null, count: 0 };
  const byActor = new Map<string, number>();
  for (const event of window) byActor.set(event.actor!, (byActor.get(event.actor!) ?? 0) + 1);
  const [actor, count] = [...byActor.entries()].sort((a, b) => b[1] - a[1])[0];
  return { share: count / window.length, actor, count: window.length };
}

export function founderDependency(state: CrmState, accountId: string, now = Date.now()): FounderDependency | null {
  const account = state.tessiant?.accounts.find((item) => item.id === accountId);
  if (!account) return null;
  const contacts = (state.contacts ?? []).filter((item) => item.accountId === accountId);
  const events = accountEvents(state, accountId);
  const owners = [account.primaryOwnerId, account.secondaryOwnerId].filter(Boolean).length;

  const ownershipPoints = owners === 0 ? 25 : owners === 1 ? 35 : 0;
  const breadthPoints = contacts.length === 0 ? 20 : contacts.length === 1 ? 20 : contacts.length === 2 ? 10 : 0;

  const scoreAt = (at: number) => {
    const c = concentration(events, at);
    const concentrationPoints = c.count >= 3 ? Math.round(45 * c.share) : c.count > 0 ? 25 : 15;
    return Math.min(100, ownershipPoints + breadthPoints + concentrationPoints);
  };

  const current = concentration(events, now);
  const score = scoreAt(now);
  const trend: number[] = [];
  for (let back = 6; back >= 0; back -= 1) trend.push(scoreAt(now - back * MONTH));
  const delta = score - trend[Math.max(0, trend.length - 4)];

  const drivers: FounderDependency["drivers"] = [
    {
      label: owners === 0 ? "No relationship owner recorded" : owners === 1 ? "One relationship owner, no second" : "Two owners recorded",
      points: ownershipPoints,
      kind: "fact",
    },
    {
      label: contacts.length === 0 ? "No client stakeholder on file" : contacts.length === 1 ? "A single client stakeholder" : `${contacts.length} client stakeholders`,
      points: breadthPoints,
      kind: "fact",
    },
    {
      label:
        current.count >= 3
          ? `${current.actor} logged ${Math.round(current.share * 100)}% of the last ${current.count} interactions`
          : current.count > 0
            ? `Only ${current.count} interaction${current.count === 1 ? "" : "s"} in six months, too few to read`
            : "No interactions recorded in six months",
      points: current.count >= 3 ? Math.round(45 * current.share) : current.count > 0 ? 25 : 15,
      kind: "inference",
    },
  ];

  return {
    score,
    band: score >= 65 ? "high" : score >= 40 ? "medium" : "low",
    keyPerson: current.count >= 3 && current.share >= 0.6 ? current.actor : owners === 1 ? state.members.find((item) => item.id === account.primaryOwnerId)?.name ?? null : null,
    keyPersonShare: current.share,
    drivers,
    trend,
    delta,
  };
}

export function dependencyLabel(band: DependencyBand): string {
  return band === "high" ? "Rests on one person" : band === "medium" ? "Thin cover" : "Well covered";
}
