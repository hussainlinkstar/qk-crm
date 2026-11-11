import { networkIntelligenceView } from "./network-intelligence";
import type { PulseStaffingSnapshot } from "./pulse-adapter";
import type { CrmState } from "./types";
import type { KnowledgeBlockDefinition, KnowledgeBlockId, TessiantInsight } from "./tessiant-pulse-types";

/** Tessiant knowledge-block configuration — not new platform subsystems. */
export const TESSIANT_KNOWLEDGE_BLOCKS: KnowledgeBlockDefinition[] = [
  {
    id: "network",
    title: "Associate Network Intelligence",
    purpose: "What capabilities exist, who is actually available, and where are the gaps?",
    owner: "Resource management",
    dataSources: ["tessiant-crm associates", "availability verification", "offerings"],
    requiredFields: ["roleType", "skills", "sectors", "availability", "verifiedAt", "offerings"],
    businessRules: [
      "Prefer verified + available associates for capacity math",
      "Network total is aggregate KPI; sample profiles are labelled separately",
      "Suppress inventing coverage when required fields are missing",
    ],
    signalDefinitions: [
      "verified_available_capacity",
      "skills_sector_coverage_gap",
      "stale_verification",
      "offering_alignment_gap",
    ],
    actions: ["Verify availability for relevant associates", "Prioritise scarce specialist sourcing"],
    outcomeMeasures: ["Verified capacity lift", "Reduced uncovered open demand"],
    displayComponents: ["mix-charts", "gap-table", "insight-cards"],
    updatedAt: "2026-11-06",
    priority: "P0",
  },
  {
    id: "augmentation",
    title: "Augmentation & Placement Intelligence",
    purpose: "Where are placements stalling, and how can resource managers improve delivery?",
    owner: "Delivery operations",
    dataSources: ["requirements", "candidates", "placements", "stage history"],
    requiredFields: ["stage", "updatedAt", "matchFlags", "shortlistStatus", "placement.status"],
    businessRules: [
      "Stage age uses updatedAt / stageHistory timestamps",
      "Coverage gap: open requirement with <2 verified available matches",
      "Funnel denominators must be disclosed",
    ],
    signalDefinitions: ["coverage_gap", "stalled_requirement", "interview_bottleneck", "fill_funnel"],
    actions: ["Review sourcing or clarify constraints", "Unblock stalled requirement"],
    outcomeMeasures: ["Days-to-shortlist", "Placement conversion", "Gross margin when units comparable"],
    displayComponents: ["funnel", "bottleneck-list", "insight-cards"],
    updatedAt: "2026-11-06",
    priority: "P0",
  },
  {
    id: "commercial",
    title: "Commercial & Relationship Intelligence",
    purpose: "Where could Tessiant expand existing accounts, and where is relationship dependency risky?",
    owner: "Account leadership",
    dataSources: ["accounts", "relationship owners", "SIA candidates", "placements", "CRM leads"],
    requiredFields: ["primaryOwnerId", "secondaryOwnerId", "offeringInterests", "linked placements/opportunities"],
    businessRules: [
      "Cross-sell is potential only — never realised revenue without confirming event",
      "SIA contribution counts only recorded opportunities/placements",
      "No invented external leads or scraping",
    ],
    signalDefinitions: ["relationship_concentration", "possible_cross_sell", "sia_contribution"],
    actions: ["Assign secondary owner", "Review advisory/consulting opportunity"],
    outcomeMeasures: ["Secondary coverage", "Pipeline potential (labelled)", "Confirmed SIA-linked outcomes"],
    displayComponents: ["account-risk", "pipeline-split", "insight-cards"],
    updatedAt: "2026-11-06",
    priority: "P0",
  },
  {
    id: "capability",
    title: "Strategic Capability Intelligence",
    purpose: "Can Tessiant's network support growth into new sectors and offerings?",
    owner: "Leadership",
    dataSources: ["sector mix", "open/lost demand", "verified capacity", "offerings"],
    requiredFields: ["sectors", "verifiedAt", "availability", "requirement.sector"],
    businessRules: [
      "Readiness uses verified specialists, not CV keyword counts alone",
      "Do not claim market demand prediction without external data",
    ],
    signalDefinitions: ["public_sector_readiness", "repeated_unmet_demand"],
    actions: ["Validate public-sector delivery readiness before new offering commitment"],
    outcomeMeasures: ["Verified coverage vs prospect demand"],
    displayComponents: ["readiness-panel", "insight-cards"],
    updatedAt: "2026-11-06",
    priority: "P1",
  },
];

export function getKnowledgeBlock(id: string) {
  return TESSIANT_KNOWLEDGE_BLOCKS.find((block) => block.id === id) ?? null;
}

export type KnowledgeLiveMetric = {
  label: string;
  value: string;
  hint?: string;
};

export type KnowledgeInsightCounts = {
  total: number;
  pending: number;
  accepted: number;
  rejected: number;
};

export type NetworkMixSummary = {
  networkTotal: number;
  sampleSize: number;
  verifiedAvailable: number;
  byRole: Record<string, number>;
  bySector: Record<string, number>;
};

export type PlacementFunnelSummary = {
  denominator: number;
  stages: Array<{ stage: string; count: number }>;
  lostOrHeld: number;
};

/** Count insights already filtered to a single knowledge block. */
export function summarizeBlockInsights(insights: TessiantInsight[]): KnowledgeInsightCounts {
  return {
    total: insights.length,
    pending: insights.filter((item) => item.reviewStatus === "pending").length,
    accepted: insights.filter((item) => item.reviewStatus === "accepted").length,
    rejected: insights.filter((item) => item.reviewStatus === "rejected").length,
  };
}

/**
 * Live headline metrics for knowledge overview/detail cards.
 * Uses CRM snapshot helpers already computed by Pulse — does not regenerate rules.
 */
export function getKnowledgeBlockLiveMetrics(
  blockId: KnowledgeBlockId,
  input: {
    mix: NetworkMixSummary | null;
    funnel: PlacementFunnelSummary | null;
    snapshot: PulseStaffingSnapshot | null;
    state: CrmState | null;
  },
): KnowledgeLiveMetric[] {
  const { mix, funnel, snapshot, state } = input;
  const tessiant = state?.tessiant;

  switch (blockId) {
    case "network": {
      const view = state ? networkIntelligenceView(state) : null;
      return [
        {
          label: "Verified available",
          value: String(view?.verifiedAvailable ?? mix?.verifiedAvailable ?? 0),
          hint: `Sample ${view?.sampleSize ?? mix?.sampleSize ?? 0} · not ${view?.networkTotal ?? mix?.networkTotal ?? 524}`,
        },
        {
          label: "Capacity vs demand",
          value: `${view?.verifiedAvailable ?? 0}/${view?.openDemandHeadcount ?? 0}`,
          hint: "Verified available / open headcount",
        },
        {
          label: "Thin coverage",
          value: String(view?.thinCoverageCount ?? 0),
          hint: "Open reqs with <2 verified matches",
        },
      ];
    }
    case "augmentation": {
      const sourcing = funnel?.stages.find((row) => row.stage === "Sourcing")?.count ?? 0;
      const interview = funnel?.stages.find((row) => row.stage === "Interview")?.count ?? 0;
      return [
        {
          label: "Open requirements",
          value: String(snapshot?.requirements.open ?? 0),
          hint: `Funnel denom. ${funnel?.denominator ?? 0}`,
        },
        {
          label: "In sourcing",
          value: String(sourcing),
        },
        {
          label: "In interview",
          value: String(interview),
          hint: funnel ? `Lost/hold ${funnel.lostOrHeld}` : undefined,
        },
        {
          label: "Placed",
          value: String(snapshot?.requirements.placed ?? 0),
        },
      ];
    }
    case "commercial": {
      const accounts = tessiant?.accounts ?? [];
      const singleOwner = accounts.filter((account) => account.primaryOwnerId && !account.secondaryOwnerId).length;
      return [
        {
          label: "Accounts",
          value: String(accounts.length),
        },
        {
          label: "Single-owner risk",
          value: String(singleOwner),
          hint: "Primary without secondary",
        },
        {
          label: "Pipeline potential",
          value: `£${(snapshot?.financials.pipeline ?? 0).toLocaleString("en-GB")}`,
          hint: "Not realised",
        },
        {
          label: "Realised day-rate",
          value: `£${(snapshot?.financials.realised ?? 0).toLocaleString("en-GB")}`,
        },
      ];
    }
    case "capability": {
      const sectors = Object.keys(mix?.bySector ?? {}).length;
      const open = snapshot?.requirements.open ?? 0;
      return [
        {
          label: "Sectors covered",
          value: String(sectors),
          hint: "In workspace sample",
        },
        {
          label: "Open demand",
          value: String(open),
        },
        {
          label: "Verified capacity",
          value: String(mix?.verifiedAvailable ?? 0),
        },
        {
          label: "SIA sample",
          value: String(snapshot?.network.siaSample ?? 0),
        },
      ];
    }
    default:
      return [];
  }
}

/** Short value-chain labels for the “How this block works” visual. */
export const KNOWLEDGE_VALUE_FLOW = [
  "CRM · Network · Requirements · Assignments",
  "Tessiant knowledge block",
  "Rules & intelligence processing",
  "Insights and recommendations",
  "Approved actions",
  "Recorded outcomes and value",
] as const;

export const KNOWLEDGE_BLOCK_INITIALS: Record<string, string> = {
  network: "AN",
  augmentation: "AP",
  commercial: "CR",
  capability: "SC",
};
