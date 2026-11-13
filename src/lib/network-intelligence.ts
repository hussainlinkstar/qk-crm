// Associate Network Intelligence — current sample snapshot only. No invented trends.

import type { ChartPoint } from "@/components/pulse/PulseLiveChart";
import { leadSourceSummary } from "./sales-growth";
import { verifiedAvailableMatchCount } from "./tessiant-insights";
import { PULSE_RULE_CONFIG } from "./tessiant-pulse-rules";
import type { TessiantInsight } from "./tessiant-pulse-types";
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

export type NetworkBubbleTone = "growing" | "established" | "attention" | "gap";

export interface NetworkKnowledgeBubble {
  id: string;
  label: string;
  mapLabel: string;
  sub: string;
  mapSub?: string;
  size: number;
  x: number;
  y: number;
  tone: NetworkBubbleTone;
  strength: string;
  agent: string;
  summary: string;
  stats: [string, string][];
  source: string;
  insightId?: string;
  href?: string;
}

function skillCount(associates: { skills: string[] }[], skill: string) {
  return associates.filter((associate) =>
    associate.skills.some((item) => item.toLowerCase() === skill.toLowerCase()),
  ).length;
}

function skillDemand(open: { mustHaveSkills: string[]; headcount?: number }[], skill: string) {
  return open
    .filter((req) => req.mustHaveSkills.some((item) => item.toLowerCase() === skill.toLowerCase()))
    .reduce((sum, req) => sum + (req.headcount || 1), 0);
}

/** Patterns the Network Intelligence block has learned from Tessiant CRM sample fields. */
export function networkKnowledgeBubbles(state: CrmState, insights: TessiantInsight[] = []): NetworkKnowledgeBubble[] {
  const view = networkIntelligenceView(state);
  const associates = state.tessiant?.associates ?? [];
  const open = openRequirements(state);
  const verified = associates.filter(isVerifiedAvailable);
  const sources = leadSourceSummary(state);
  const referralCount = (sources.find((row) => row.id === "referral")?.count ?? 0) + (sources.find((row) => row.id === "network")?.count ?? 0);
  const inboundCount = sources.find((row) => row.id === "inbound")?.count ?? 0;
  const totalLeads = Math.max(1, state.leads.length);
  const referralShare = Math.round((referralCount / totalLeads) * 100);
  const introductionActivities = (state.events ?? []).filter((item) => item.activityType === "introduction").length;
  const sapDemand = skillDemand(open, "SAP") + skillDemand(open, "S/4HANA");
  const sapCapacity = verified.filter((associate) =>
    associate.skills.some((skill) => /sap|s\/4hana/i.test(skill)),
  ).length;
  const programmeCount = skillCount(associates, "Programme management");
  const changeCount = skillCount(associates, "Change management");
  const publicDemand = skillDemand(open, "Public sector");
  const publicCapacity = verified.filter((associate) =>
    associate.sectors?.some((sector) => /public/i.test(sector)) ||
    associate.skills.some((skill) => /public/i.test(skill)),
  ).length;
  const stale = associates.filter((associate) => !associate.verifiedAt).length;
  const siaCount = associates.filter((associate) => associate.roleType === "SIA" || associate.roleType === "executive_advisor").length;

  const sapInsight = insights.find((item) => /sap/i.test(item.title) || item.ruleId === "offering_mismatch");
  const coverageInsight = insights.find((item) => item.ruleId === "coverage_gap");
  const siaInsight = insights.find((item) => item.ruleId === "sia_contribution");

  const bubbles: NetworkKnowledgeBubble[] = [
    {
      id: "referrals",
      label: "Referrals",
      mapLabel: "Referrals",
      sub: referralCount > 0 ? `${referralShare}% of leads` : "Warm intros",
      size: 112,
      x: 46,
      y: 48,
      tone: "growing",
      strength: "Pattern · strong",
      agent: "Network Intelligence",
      summary:
        referralCount > 0
          ? `Referral and associate/SIA introductions account for ${referralCount} of ${state.leads.length} leads in the Tessiant sample${introductionActivities ? ` · ${introductionActivities} introduction activities logged` : ""}. Warm network paths are the priority follow-up before cold inbound.`
          : "No referral-labelled leads in the current sample yet. Associate and SIA introductions are still the preferred warm path when they appear.",
      stats: [
        [String(referralCount), "referral / network leads"],
        [String(inboundCount), "inbound / website"],
        [`${referralShare}%`, "of lead book"],
        [String(introductionActivities), "intro activities"],
      ],
      source: "From Tessiant CRM leads (Referral, Associate introduction, SIA introduction) and introduction activities",
      insightId: siaInsight?.id,
      href: "/sales/leads",
    },
    {
      id: "sap",
      label: "SAP capacity",
      mapLabel: "SAP",
      sub: sapCapacity < sapDemand ? "Below demand" : "Covered",
      mapSub: sapCapacity < sapDemand ? "Gap" : "Ok",
      size: 92,
      x: 22,
      y: 30,
      tone: sapCapacity < sapDemand ? "gap" : "established",
      strength: sapCapacity < sapDemand ? "Gap" : "Pattern",
      agent: "Network Intelligence",
      summary: `${sapDemand} open SAP-tagged headcount against ${sapCapacity} verified available SAP specialist(s) in the seeded sample. Prioritise scarce specialist sourcing when capacity sits below demand.`,
      stats: [
        [String(sapDemand), "open SAP demand"],
        [String(sapCapacity), "verified available"],
        [String(view.openRequirementCount), "open requirements"],
        [String(siaCount), "SIA / advisors"],
      ],
      source: "From associates.skills, verifiedAt, availability and open requirement must-haves",
      insightId: sapInsight?.id,
      href: "/staffing/associates",
    },
    {
      id: "coverage",
      label: "Thin coverage",
      mapLabel: "Coverage",
      sub: `${view.thinCoverageCount} thin`,
      size: 84,
      x: 70,
      y: 26,
      tone: view.thinCoverageCount > 0 ? "attention" : "established",
      strength: view.thinCoverageCount > 0 ? "Needs attention" : "Healthy",
      agent: "Network Intelligence",
      summary: `${view.thinCoverageCount} of ${view.openRequirementCount} open requirements have fewer than ${PULSE_RULE_CONFIG.coverageGapMinVerifiedAvailable} verified available matches in sample.`,
      stats: [
        [String(view.thinCoverageCount), "thin requirements"],
        [String(view.openRequirementCount), "open requirements"],
        [String(view.verifiedAvailable), "verified available"],
        [`${view.verifiedAvailable}/${view.openDemandHeadcount}`, "capacity vs demand"],
      ],
      source: "From open requirements matched to verified available associates",
      insightId: coverageInsight?.id,
      href: "/staffing/requirements",
    },
    {
      id: "bench",
      label: "Verified bench",
      mapLabel: "Bench",
      sub: `${view.verifiedAvailable} ready`,
      size: 78,
      x: 78,
      y: 56,
      tone: "established",
      strength: "Company pattern",
      agent: "Network Intelligence",
      summary: `${view.verifiedAvailable} associates in the seeded sample of ${view.sampleSize} are verified, available, and active. Illustrative network total (${view.networkTotal}) is not used as a denominator.`,
      stats: [
        [String(view.verifiedAvailable), "verified available"],
        [String(view.sampleSize), "sample profiles"],
        [String(view.networkTotal), "illustrative total"],
        [String(stale), "unverified in sample"],
      ],
      source: "From associates.verifiedAt, availability and status",
      href: "/staffing/associates",
    },
    {
      id: "programme",
      label: "Programme strength",
      mapLabel: "Programme",
      sub: `${programmeCount} in sample`,
      size: 76,
      x: 28,
      y: 72,
      tone: "established",
      strength: "Pattern",
      agent: "Network Intelligence",
      summary: `Programme management appears on ${programmeCount} seeded profiles — one of the denser capability clusters operators use when staffing transformation work.`,
      stats: [
        [String(programmeCount), "programme profiles"],
        [String(changeCount), "change profiles"],
        [String(view.sampleSize), "sample size"],
        [String(skillDemand(open, "Programme management")), "open programme demand"],
      ],
      source: "From associates.skills in the Tessiant CRM sample",
      href: "/staffing/associates",
    },
    {
      id: "change",
      label: "Change specialists",
      mapLabel: "Change",
      sub: `${changeCount} tagged`,
      size: 72,
      x: 58,
      y: 78,
      tone: "growing",
      strength: "Pattern",
      agent: "Network Intelligence",
      summary: `${changeCount} sample associates carry change-management skills against ${skillDemand(open, "Change management")} open change-tagged headcount.`,
      stats: [
        [String(changeCount), "change profiles"],
        [String(skillDemand(open, "Change management")), "open change demand"],
        [String(verified.filter((a) => a.skills.some((s) => /change/i.test(s))).length), "verified change"],
        [String(view.verifiedAvailable), "verified bench"],
      ],
      source: "From associates.skills and open requirement must-haves",
      href: "/staffing/associates",
    },
    {
      id: "public",
      label: "Public sector",
      mapLabel: "Public",
      sub: publicCapacity < publicDemand || publicDemand === 0 ? "Gap" : "Ready",
      mapSub: "Gap",
      size: 70,
      x: 16,
      y: 54,
      tone: publicCapacity < Math.max(publicDemand, 1) ? "gap" : "attention",
      strength: "Gap",
      agent: "Network Intelligence",
      summary:
        publicDemand > 0
          ? `${publicDemand} open public-sector tagged demand with ${publicCapacity} verified available specialist(s) in sample. Validate readiness before committing new public-sector offerings.`
          : `No open public-sector must-have demand in sample right now · ${publicCapacity} verified profiles still carry public-sector tagging for readiness checks.`,
      stats: [
        [String(publicDemand), "open public demand"],
        [String(publicCapacity), "verified public"],
        [String(view.openRequirementCount), "open requirements"],
        [String(stale), "unverified profiles"],
      ],
      source: "From associate sectors/skills and open requirement must-haves",
      href: "/staffing/requirements",
    },
  ];

  return bubbles;
}
