// Showcase signals: what Qiko could surface with the client's full data and a premium LinkedIn
// account. Built on recorded CRM facts (open requirements, past clients, quoted rates) plus seeded
// second-degree network figures. Every signal is flagged `demo` and never names an unrecorded person.

import type { CrmState, Opportunity } from "./types";
import type { ClientRequirement } from "./tessiant-types";
import { verifiedAvailableMatchCount } from "./tessiant-insights";
import { completedAssignments, resolveAssignmentAccountId } from "./assignments";
import { plural } from "./format";

export interface ShowcaseSignal {
  id: string;
  kind: "Network reach" | "Hiring signal" | "Rate benchmark" | "Bench risk";
  title: string;
  detail: string;
  evidence: string;
  action: string;
  impact: 1 | 2 | 3;
  demo: boolean;
  requirementId?: string;
  accountId?: string;
  opportunityId?: string;
  href: string;
}

function hashOf(value: string) {
  let hash = 0;
  for (const char of value) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return hash;
}

function openRequirements(state: CrmState): ClientRequirement[] {
  return (state.tessiant?.requirements ?? []).filter((req) => !req.archived && req.outcome === "active" && req.stage !== "Placed");
}

/** Second-degree profiles that match a requirement's must-have skills, from the seeded reach table. */
export function secondDegreeReach(state: CrmState, requirement: ClientRequirement): number {
  const table = state.tessiant?.networkStats.secondDegreeBySkill ?? {};
  const keys = Object.keys(table);
  let best = 0;
  for (const skill of requirement.mustHaveSkills) {
    const key = keys.find((item) => item.toLowerCase() === skill.toLowerCase());
    if (key) best = Math.max(best, table[key]);
  }
  return best || 3 + (hashOf(requirement.id) % 7);
}

export function showcaseSignals(state: CrmState): ShowcaseSignal[] {
  const t = state.tessiant;
  if (!t) return [];
  const signals: ShowcaseSignal[] = [];
  const secondary = t.networkStats.secondaryMembers ?? 0;

  // Network reach: open briefs with thin verified cover that second-degree introductions could fill.
  for (const req of openRequirements(state)) {
    const verified = verifiedAvailableMatchCount(state, req.id);
    if (verified >= 2) continue;
    const reach = secondDegreeReach(state, req);
    const viaCount = Math.max(2, Math.min(5, Math.round(reach / 2)));
    const account = t.accounts.find((item) => item.id === req.accountId)?.name ?? "the client";
    signals.push({
      id: `reach-${req.id}`,
      kind: "Network reach",
      title: `${plural(reach, "second-degree connection")} could fill ${req.title}`,
      detail: `Only ${verified} verified available in the first-degree network, but ${reach} matching profiles sit one introduction away via ${viaCount} associates. Ask for introductions before going to market for ${account}.`,
      evidence: `${secondary.toLocaleString("en-GB")} second-degree profiles indexed · ${req.mustHaveSkills.slice(0, 2).join(", ")} · estimate`,
      action: "Request introductions",
      impact: 3,
      demo: true,
      requirementId: req.id,
      accountId: req.accountId,
      href: `/staffing/requirements/${req.id}`,
    });
  }

  // Hiring signals: past clients with completed work and no open pipeline.
  const openOppAccounts = new Set((state.opportunities ?? []).filter((item) => item.stage !== "Closed Won" && item.stage !== "Closed Lost").map((item) => item.accountId));
  const pastClientIds = new Set(completedAssignments(state).map((item) => resolveAssignmentAccountId(state, item)).filter(Boolean) as string[]);
  for (const accountId of pastClientIds) {
    if (openOppAccounts.has(accountId)) continue;
    const account = t.accounts.find((item) => item.id === accountId);
    if (!account) continue;
    const roles = 2 + (hashOf(accountId) % 4);
    signals.push({
      id: `hiring-${accountId}`,
      kind: "Hiring signal",
      title: `${account.name} is advertising ${plural(roles, "role")} Tessiant has delivered before`,
      detail: `A past client with completed work and no open opportunity. Public job posts match ${account.servicesPurchased?.[0] ?? "work"} Tessiant has already delivered there.`,
      evidence: `Completed assignment on record · ${plural(roles, "matching public post")} · estimate`,
      action: "Originate an opportunity",
      impact: 2,
      demo: true,
      accountId,
      href: `/sales/accounts/${accountId}`,
    });
  }

  // Rate benchmark: deals in Proposal or Negotiation with a linked requirement rate band.
  for (const opportunity of (state.opportunities ?? []).filter((item) => item.stage === "Proposal" || item.stage === "Negotiation")) {
    const req = t.requirements.find((item) => item.linkedOpportunityId === opportunity.id);
    if (!req?.rateMax) continue;
    const market = Math.round((req.rateMax * (0.86 + (hashOf(opportunity.id) % 10) / 100)) / 10) * 10;
    const above = req.rateMax > market;
    signals.push({
      id: `rate-${opportunity.id}`,
      kind: "Rate benchmark",
      title: `${opportunity.name}: quoted band ${above ? "above" : "within"} market`,
      detail: `Market day rate for ${req.title.toLowerCase()} is around £${market.toLocaleString("en-GB")}. The brief's band tops out at £${req.rateMax.toLocaleString("en-GB")}. ${
        above ? "Expect pushback in negotiation unless scarcity is argued." : "Room to hold price; scarcity supports the band."
      }`,
      evidence: `Benchmark from indexed contract rates · ${req.sector} · estimate`,
      action: above ? "Prepare the scarcity case" : "Hold the band",
      impact: 2,
      demo: true,
      opportunityId: opportunity.id,
      accountId: opportunity.accountId,
      href: `/sales/pipeline?opportunity=${opportunity.id}`,
    });
  }

  return signals;
}

export function showcaseSignalForOpportunity(state: CrmState, opportunity: Opportunity): ShowcaseSignal | null {
  return showcaseSignals(state).find((item) => item.opportunityId === opportunity.id) ?? null;
}
