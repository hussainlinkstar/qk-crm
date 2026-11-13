// Sourcing sweep: the resource manager's "trawl LinkedIn, the network and the internal CVs" step,
// shown as one pass Qiko makes in seconds. Internal and first-degree counts come from the recorded
// sample and the matcher. Second-degree and LinkedIn counts are showcase figures, labelled demo,
// deterministic per requirement, and never turned into named people.

import type { IconName } from "@/components/ui/Icon";
import type { IconTone } from "@/components/ui/IconTile";
import type { CrmState } from "./types";
import type { ClientRequirement } from "./tessiant-types";
import { rankMatches } from "./tessiant-matching";
import { secondDegreeReach } from "./showcase-signals";

export interface SweepStep {
  key: "cvs" | "network" | "second" | "linkedin";
  label: string;
  detail: string;
  count: number;
  icon: IconName;
  tone: IconTone;
  /** "recorded" is from CRM data; "demo" is a showcase figure. */
  basis: "recorded" | "demo";
  /** How long this step is shown running, in ms. */
  duration: number;
}

export interface SweepPlan {
  steps: SweepStep[];
  profilesScanned: number;
  shortlistable: number;
  verifiedAvailable: number;
  manualHours: number;
  sweepSeconds: number;
  secondaryNetworkTotal: number;
}

function hashOf(value: string) {
  let hash = 0;
  for (const char of value) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return hash;
}

export function sweepPlan(state: CrmState, requirement: ClientRequirement): SweepPlan {
  const t = state.tessiant;
  const associates = (t?.associates ?? []).filter((item) => item.status !== "inactive");
  const wanted = [...requirement.mustHaveSkills, ...requirement.preferredSkills].map((skill) => skill.toLowerCase());
  const skillHit = (skills: string[]) => skills.some((skill) => wanted.includes(skill.toLowerCase()));

  const cvs = associates.filter((item) => skillHit(item.skills)).length;
  const firstDegree = associates.filter((item) => skillHit(item.skills) && (item.source === "internal" || item.source === "network")).length;

  const ranked = rankMatches(associates, requirement, { placements: t?.placements ?? [], requirements: t?.requirements ?? [] });
  const shortlistable = ranked.filter((item) => item.presentation.suitabilityBand === "strong" || item.presentation.suitabilityBand === "good").length;
  const verifiedAvailable = ranked.filter(
    (item) => item.presentation.currentlyAvailable && (item.presentation.suitabilityBand === "strong" || item.presentation.suitabilityBand === "good"),
  ).length;

  const hash = hashOf(requirement.id);
  const secondDegree = secondDegreeReach(state, requirement);
  const linkedin = 12 + (hash % 29);
  const secondaryNetworkTotal = t?.networkStats.secondaryMembers ?? 3_100;
  const networkTotal = t?.networkStats.totalMembers ?? associates.length;

  const steps: SweepStep[] = [
    { key: "cvs", label: "Internal CV library", detail: `${cvs} profiles with matching skills`, count: cvs, icon: "file", tone: "brand", basis: "recorded", duration: 900 },
    { key: "network", label: "Tessiant network · 1st degree", detail: `${firstDegree} known associates`, count: firstDegree, icon: "users", tone: "brand", basis: "recorded", duration: 1000 },
    { key: "second", label: "2nd-degree network", detail: `${secondDegree} introductions reachable`, count: secondDegree, icon: "handshake", tone: "qiko", basis: "demo", duration: 1100 },
    { key: "linkedin", label: "LinkedIn · premium search", detail: `${linkedin} external profiles`, count: linkedin, icon: "globe", tone: "qiko", basis: "demo", duration: 1200 },
  ];

  return {
    steps,
    profilesScanned: networkTotal + secondaryNetworkTotal + linkedin,
    shortlistable,
    verifiedAvailable,
    manualHours: 3,
    sweepSeconds: Math.round(steps.reduce((sum, step) => sum + step.duration, 0) / 1000),
    secondaryNetworkTotal,
  };
}
