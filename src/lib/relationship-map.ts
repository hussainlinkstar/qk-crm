// Relationship map for one account: who Tessiant knows there, who delivers there, who introduced
// them, and which deals bind it together. Every node and edge is read from stored records; the
// map adds no inference beyond "these records reference each other".

import type { CrmState, Lead, Opportunity } from "./types";
import { liveAssignments, resolveAssignmentAccountId } from "./assignments";
import { contactsForAccount, opportunitiesForAccount } from "./sales-crm";
import { compactMoney } from "./home-tessiant";
import { formatDate, todayKey } from "./format";

export type MapNodeKind = "account" | "owner" | "contact" | "associate" | "sia" | "deal" | "requirement";

export interface MapNode {
  id: string;
  kind: MapNodeKind;
  label: string;
  sub: string;
  href: string | null;
  /** Ring sector the node sits in; nodes share a sector when they are the same kind of relationship. */
  group: "team" | "stakeholders" | "delivery" | "deals" | "introducers";
  /** Live relationships draw solid; past ones draw faint. */
  live: boolean;
  /** Why this node matters, one line. */
  why: string;
}

export interface MapEdge {
  id: string;
  from: string;
  to: string;
  label: string;
  kind: "owns" | "stakeholder" | "placed" | "introduced" | "deal" | "requires" | "delivered";
  live: boolean;
}

export interface RelationshipMapData {
  nodes: MapNode[];
  edges: MapEdge[];
  /** Named introduction paths: introducer → lead → account, when recorded. */
  introductions: Array<{ introducerId: string; introducerName: string; leadName: string; outcome: string }>;
  counts: Record<Exclude<MapNodeKind, "account">, number>;
}

function stageLabel(opportunity: Opportunity): string {
  return opportunity.stage === "Closed Won" ? "Won" : opportunity.stage === "Closed Lost" ? "Lost" : opportunity.stage;
}

export function relationshipMap(state: CrmState, accountId: string): RelationshipMapData | null {
  const account = state.tessiant?.accounts.find((item) => item.id === accountId);
  if (!account) return null;
  const nodes: MapNode[] = [];
  const edges: MapEdge[] = [];
  const seen = new Set<string>();
  const add = (node: MapNode) => {
    if (seen.has(node.id)) return;
    seen.add(node.id);
    nodes.push(node);
  };

  add({ id: `account:${account.id}`, kind: "account", label: account.name, sub: account.sector || account.industry, href: null, group: "stakeholders", live: true, why: "" });
  const centre = `account:${account.id}`;

  // Tessiant team
  for (const [memberId, role] of [
    [account.primaryOwnerId, "Primary owner"],
    [account.secondaryOwnerId, "Secondary owner"],
  ] as const) {
    const member = memberId ? state.members.find((item) => item.id === memberId) : null;
    if (!member) continue;
    add({ id: `owner:${member.id}`, kind: "owner", label: member.name, sub: role, href: null, group: "team", live: true, why: `${role} on this account. Relationship continuity depends on them.` });
    edges.push({ id: `e_own_${member.id}`, from: `owner:${member.id}`, to: centre, label: role, kind: "owns", live: true });
  }

  // Client stakeholders
  for (const contact of contactsForAccount(state, accountId)) {
    const touches = state.events.filter((event) => event.contactId === contact.id).length;
    add({
      id: `contact:${contact.id}`,
      kind: "contact",
      label: contact.name,
      sub: contact.role || "Stakeholder",
      href: "/sales/contacts",
      group: "stakeholders",
      live: true,
      why: `${contact.isPrimary ? "Primary stakeholder" : "Stakeholder"}. ${touches ? `${touches} recorded ${touches === 1 ? "interaction" : "interactions"}.` : "No interaction recorded yet."}`,
    });
    edges.push({ id: `e_con_${contact.id}`, from: centre, to: `contact:${contact.id}`, label: contact.isPrimary ? "primary contact" : "contact", kind: "stakeholder", live: true });
  }

  // Delivery: associates placed here, live or past
  const today = todayKey();
  const live = new Set(liveAssignments(state, today).map((item) => item.id));
  const placements = (state.tessiant?.placements ?? []).filter((item) => resolveAssignmentAccountId(state, item) === accountId);
  for (const placement of placements) {
    const associate = state.tessiant?.associates.find((item) => item.id === placement.associateId);
    if (!associate) continue;
    const isLive = live.has(placement.id);
    const isSia = associate.roleType === "SIA";
    const requirement = state.tessiant?.requirements.find((item) => item.id === placement.requirementId);
    add({
      id: `associate:${associate.id}`,
      kind: isSia ? "sia" : "associate",
      label: associate.name,
      sub: isSia ? "Senior Industry Advisor" : associate.headline,
      href: `/staffing/associates/${associate.id}`,
      group: isSia ? "introducers" : "delivery",
      live: isLive,
      why: `${isLive ? "Currently deployed" : "Previously deployed"}${requirement ? ` as ${placement.roleTitle ?? requirement.title}` : ""}${placement.terms?.endDate ? `, ${isLive ? "ends" : "ended"} ${formatDate(placement.terms.endDate)}` : ""}.`,
    });
    edges.push({ id: `e_plc_${placement.id}`, from: `associate:${associate.id}`, to: centre, label: isLive ? "deployed" : "past engagement", kind: isLive ? "placed" : "delivered", live: isLive });
  }

  // Introductions recorded on leads linked to this account
  const introductions: RelationshipMapData["introductions"] = [];
  const leads: Lead[] = state.leads.filter((lead) => lead.accountId === accountId || lead.convertedOpportunityId && opportunitiesForAccount(state, accountId).some((opp) => opp.id === lead.convertedOpportunityId));
  for (const lead of leads) {
    if (!lead.introducedByAssociateId) continue;
    const introducer = state.tessiant?.associates.find((item) => item.id === lead.introducedByAssociateId);
    if (!introducer) continue;
    const isSia = introducer.roleType === "SIA";
    add({
      id: `associate:${introducer.id}`,
      kind: isSia ? "sia" : "associate",
      label: introducer.name,
      sub: isSia ? "Senior Industry Advisor" : introducer.headline,
      href: `/staffing/associates/${introducer.id}`,
      group: "introducers",
      live: true,
      why: `Introduced ${lead.name} (${lead.role ?? "contact"}). Lead is ${lead.status.toLowerCase()}.`,
    });
    edges.push({ id: `e_intro_${lead.id}`, from: `associate:${introducer.id}`, to: centre, label: `introduced ${lead.name.split(" ")[0]}`, kind: "introduced", live: true });
    const converted = lead.convertedOpportunityId ? state.opportunities.find((item) => item.id === lead.convertedOpportunityId) : null;
    introductions.push({
      introducerId: introducer.id,
      introducerName: introducer.name,
      leadName: lead.name,
      outcome: converted ? `${stageLabel(converted)} · ${compactMoney(converted.amount)}` : lead.status,
    });
  }

  // Deals
  for (const opportunity of opportunitiesForAccount(state, accountId)) {
    const isOpen = opportunity.stage !== "Closed Won" && opportunity.stage !== "Closed Lost";
    add({
      id: `deal:${opportunity.id}`,
      kind: "deal",
      label: opportunity.name,
      sub: `${stageLabel(opportunity)} · ${compactMoney(opportunity.amount)}`,
      href: `/sales/pipeline?opportunity=${opportunity.id}`,
      group: "deals",
      live: isOpen || opportunity.stage === "Closed Won",
      why: isOpen ? `Open at ${opportunity.stage}, ${opportunity.probability}% likelihood, expected ${formatDate(opportunity.expectedCloseDate)}.` : opportunity.stage === "Closed Won" ? `Won${opportunity.closedAt ? ` ${formatDate(opportunity.closedAt)}` : ""}. Agreed value is not recognised revenue.` : `Lost${opportunity.lostReason ? `: ${opportunity.lostReason}` : ""}.`,
    });
    edges.push({ id: `e_deal_${opportunity.id}`, from: centre, to: `deal:${opportunity.id}`, label: stageLabel(opportunity).toLowerCase(), kind: "deal", live: isOpen });
    if (opportunity.contactId && seen.has(`contact:${opportunity.contactId}`)) {
      edges.push({ id: `e_dealc_${opportunity.id}`, from: `contact:${opportunity.contactId}`, to: `deal:${opportunity.id}`, label: "sponsor", kind: "stakeholder", live: isOpen });
    }
  }

  // Open requirements (the staffing side of a deal)
  for (const requirement of (state.tessiant?.requirements ?? []).filter((item) => item.accountId === accountId && item.outcome === "active" && item.stage !== "Placed")) {
    add({ id: `req:${requirement.id}`, kind: "requirement", label: requirement.title, sub: `${requirement.stage} · starts ${formatDate(requirement.startDate)}`, href: `/staffing/requirements/${requirement.id}`, group: "deals", live: true, why: `Open requirement at ${requirement.stage}. Needs ${requirement.mustHaveSkills.slice(0, 2).join(", ")}.` });
    const linked = requirement.linkedOpportunityId && seen.has(`deal:${requirement.linkedOpportunityId}`) ? `deal:${requirement.linkedOpportunityId}` : centre;
    edges.push({ id: `e_req_${requirement.id}`, from: linked, to: `req:${requirement.id}`, label: "requires", kind: "requires", live: true });
  }

  const counts = { owner: 0, contact: 0, associate: 0, sia: 0, deal: 0, requirement: 0 };
  for (const node of nodes) if (node.kind !== "account") counts[node.kind] += 1;

  return { nodes, edges, introductions, counts };
}
