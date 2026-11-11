// Associate Network Intelligence — current sample snapshot only. No invented trends.

import type { ChartPoint } from "@/components/pulse/PulseLiveChart";
import { verifiedAvailableMatchCount } from "./tessiant-insights";
import { PULSE_RULE_CONFIG } from "./tessiant-pulse-rules";
import type { CrmState } from "./types";

function isVerifiedAvailable(associate: { verifiedAt: string | null; availability: string; status: string }) {
  return Boolean(associate.verifiedAt) && associate.availability === "available" && associate.status === "active";
}

function openRequirements(state: CrmState) {
  return (state.tessiant?.requirements ?? []).filter(
    (req) => !req.archived && req.outcome === "active" && req.stage !== "Placed",
  );
}

const SKILL_CHART_LABEL: Record<string, string> = {
  "Programme management": "Programme",
  "Change management": "Change",
  Cybersecurity: "Cyber",
  "Board advisory": "Board",
  "Retail strategy": "Rt. strat",
  "Retail transformation": "Retail tx",
  "Public sector": "Public",
  "S/4HANA": "S/4HANA",
  "Solution architecture": "Sol. arch",
  "Finance transformation": "Finance",
  "HR transformation": "HR",
  "Stakeholder management": "Stakeholders",
  "Change delivery": "Delivery",
  "Agile delivery": "Agile",
  "Operating model": "Op. model",
  "Data platforms": "Data",
  Architecture: "Architect.",
  Advisory: "Advisory",
  PMO: "PMO",
  SAP: "SAP",
};

function chartLabel(value: string) {
  return SKILL_CHART_LABEL[value] ?? (value.length > 10 ? `${value.slice(0, 9)}…` : value);
}

export interface NetworkIntelligenceView {
  sampleSize: number;
  networkTotal: number;
  verifiedAvailable: number;
  openDemandHeadcount: number;
  thinCoverageCount: number;
  openRequirementCount: number;
  skillSeries: ChartPoint[];
  demandSeries: ChartPoint[];
  capacitySeries: ChartPoint[];
  sampleNote: string;
}

export function networkIntelligenceView(state: CrmState): NetworkIntelligenceView {
  const associates = state.tessiant?.associates ?? [];
  const sampleSize = associates.length;
  const networkTotal = state.tessiant?.networkStats.totalMembers ?? 0;
  const verified = associates.filter(isVerifiedAvailable);
  const open = openRequirements(state);
  const openDemandHeadcount = open.reduce((sum, req) => sum + (req.headcount || 1), 0);
  const thinCoverageCount = open.filter(
    (req) => verifiedAvailableMatchCount(state, req.id) < PULSE_RULE_CONFIG.coverageGapMinVerifiedAvailable,
  ).length;

  const skillCounts = new Map<string, number>();
  for (const associate of associates) {
    for (const skill of associate.skills) {
      skillCounts.set(skill, (skillCounts.get(skill) ?? 0) + 1);
    }
  }
  const skillSeries = [...skillCounts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 5)
    .map(([l, v]) => ({ l: chartLabel(l), v, title: l }));

  const demandBySkill = new Map<string, number>();
  for (const req of open) {
    for (const skill of req.mustHaveSkills) {
      demandBySkill.set(skill, (demandBySkill.get(skill) ?? 0) + (req.headcount || 1));
    }
  }
  const demandRows = [...demandBySkill.entries()]
    .map(([skill, demand]) => {
      const capacity = verified.filter((associate) =>
        associate.skills.some((item) => item.toLowerCase() === skill.toLowerCase()),
      ).length;
      return { skill, demand, capacity, gap: demand - capacity };
    })
    .sort((a, b) => b.gap - a.gap || b.demand - a.demand || a.skill.localeCompare(b.skill))
    .slice(0, 5);
  const demandSeries = demandRows.map((row) => ({ l: chartLabel(row.skill), v: row.demand, title: row.skill }));
  const capacitySeries = demandRows.map((row) => ({ l: chartLabel(row.skill), v: row.capacity, title: row.skill }));

  return {
    sampleSize,
    networkTotal,
    verifiedAvailable: verified.length,
    openDemandHeadcount,
    thinCoverageCount,
    openRequirementCount: open.length,
    skillSeries,
    demandSeries,
    capacitySeries,
    sampleNote: `Seeded sample of ${sampleSize} profiles. Illustrative Tessiant network total is ${networkTotal} — not used as a chart denominator.`,
  };
}
