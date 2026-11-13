// Introductions: who in the first-degree network has opened doors (recorded on leads), and who could
// open the next one for a brief (ranked from recorded skills, sectors and placement history). The
// second-degree reach per introducer is a showcase estimate and is labelled as such.

import type { CrmState, Lead, Opportunity, Task } from "./types";
import type { Associate, ClientRequirement } from "./tessiant-types";
import { isOpen } from "./insights";

export interface IntroductionMade {
  lead: Lead;
  opportunity: Opportunity | null;
  accountName: string | null;
  outcome: string;
}

export function introductionsBy(state: CrmState, associateId: string): IntroductionMade[] {
  return state.leads
    .filter((lead) => lead.introducedByAssociateId === associateId)
    .map((lead) => {
      const opportunity = lead.convertedOpportunityId ? state.opportunities.find((item) => item.id === lead.convertedOpportunityId) ?? null : null;
      const accountName = lead.accountId ? state.tessiant?.accounts.find((item) => item.id === lead.accountId)?.name ?? lead.company : lead.company;
      const outcome = opportunity ? (opportunity.stage === "Closed Won" ? "Won" : opportunity.stage === "Closed Lost" ? "Lost" : `In pipeline · ${opportunity.stage}`) : lead.status;
      return { lead, opportunity, accountName, outcome };
    })
    .sort((a, b) => b.lead.createdAt.localeCompare(a.lead.createdAt));
}

export interface Introducer {
  associate: Associate;
  overlap: string[];
  sectorMatch: boolean;
  introductionsMade: number;
  /** Showcase: matching profiles one introduction away via this person. */
  reach: number;
  score: number;
  request: Task | null;
}

const TAG = (associateId: string, requirementId: string) => `[intro-request:${associateId}:${requirementId}]`;

export function introductionRequestFor(state: CrmState, associateId: string, requirementId: string): Task | null {
  const tag = TAG(associateId, requirementId);
  return state.tasks.find((task) => task.description.includes(tag) && isOpen(task)) ?? null;
}

export function introductionRequestsBy(state: CrmState, associateId: string): Array<{ task: Task; requirement: ClientRequirement | null }> {
  const prefix = `[intro-request:${associateId}:`;
  return state.tasks
    .filter((task) => task.description.includes(prefix))
    .map((task) => {
      const match = task.description.match(/\[intro-request:[^:]+:([^\]]+)\]/);
      const requirement = match ? state.tessiant?.requirements.find((item) => item.id === match[1]) ?? null : null;
      return { task, requirement };
    });
}

/** First-degree associates best placed to introduce a candidate for this brief. Never the people already on the shortlist. */
export function introducersFor(state: CrmState, requirement: ClientRequirement, limit = 4): Introducer[] {
  const t = state.tessiant;
  if (!t) return [];
  const onShortlist = new Set(t.candidates.filter((item) => item.requirementId === requirement.id).map((item) => item.associateId));
  const wanted = [...requirement.mustHaveSkills, ...requirement.preferredSkills].map((skill) => skill.toLowerCase());
  const reachTable = t.networkStats.secondDegreeBySkill ?? {};
  const introducedBy = new Map<string, number>();
  for (const lead of state.leads) if (lead.introducedByAssociateId) introducedBy.set(lead.introducedByAssociateId, (introducedBy.get(lead.introducedByAssociateId) ?? 0) + 1);

  return t.associates
    .filter((associate) => associate.status === "active" && associate.source === "network" && !onShortlist.has(associate.id))
    .map((associate) => {
      const overlap = associate.skills.filter((skill) => wanted.includes(skill.toLowerCase()));
      const sectorMatch = associate.sectors.some((sector) => sector.toLowerCase() === requirement.sector.toLowerCase());
      const made = introducedBy.get(associate.id) ?? 0;
      const topSkill = overlap[0];
      const reachKey = topSkill ? Object.keys(reachTable).find((key) => key.toLowerCase() === topSkill.toLowerCase()) : undefined;
      const reach = reachKey ? Math.max(1, Math.round(reachTable[reachKey] / 3)) : overlap.length ? 2 : 0;
      const score = overlap.length * 3 + (sectorMatch ? 2 : 0) + Math.min(associate.priorPlacementCount, 4) + made * 3 + (associate.roleType === "SIA" ? 2 : 0);
      return { associate, overlap, sectorMatch, introductionsMade: made, reach, score, request: introductionRequestFor(state, associate.id, requirement.id) };
    })
    .filter((item) => item.overlap.length > 0 || (item.sectorMatch && item.associate.roleType === "SIA"))
    .sort((a, b) => b.score - a.score || a.associate.name.localeCompare(b.associate.name))
    .slice(0, limit);
}

export function introductionRequestTask(introducer: Introducer, requirement: ClientRequirement, accountName: string) {
  const { associate, overlap, reach } = introducer;
  return {
    title: `Ask ${associate.name} to introduce a ${requirement.title} candidate`,
    description: `${associate.name} (${associate.roleType === "SIA" ? "SIA" : associate.headline}) shares ${overlap.length ? overlap.join(", ") : requirement.sector} with the ${requirement.title} brief for ${accountName}. Ask who in their network they would put forward. Estimate: about ${reach} matching profiles one introduction away. ${TAG(associate.id, requirement.id)}`,
  };
}
