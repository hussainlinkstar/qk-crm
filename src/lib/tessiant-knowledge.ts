import type { KnowledgeBlockDefinition } from "./tessiant-pulse-types";

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
