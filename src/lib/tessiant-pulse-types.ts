// Tessiant configuration of Qiko Pulse intelligence contracts (Demo V1).
// Platform lifecycle (review → task → outcome → value) is reusable; rules/labels are Tessiant-specific.

export const PULSE_TENANT_ID = "tessiant-demo" as const;

export const KNOWLEDGE_BLOCK_IDS = ["network", "augmentation", "commercial", "capability"] as const;
export type KnowledgeBlockId = (typeof KNOWLEDGE_BLOCK_IDS)[number];

export type InsightPriority = "high" | "medium" | "low";
export type InsightConfidence = "verified" | "partial" | "needs-review";
export type InsightReviewStatus = "pending" | "accepted" | "rejected";

export interface InsightEvidence {
  entityType: "associate" | "requirement" | "candidate" | "account" | "placement" | "opportunity" | "lead" | "contact" | "task";
  entityId: string;
  field?: string;
  observedValue?: string | number;
  href?: string;
}

export interface TessiantInsight {
  id: string;
  tenantId: typeof PULSE_TENANT_ID;
  knowledgeBlockId: KnowledgeBlockId;
  ruleId: string;
  title: string;
  summary: string;
  priority: InsightPriority;
  evidence: InsightEvidence[];
  generatedAt: string;
  dataAsOf: string;
  confidence: InsightConfidence;
  recommendedAction: { type: string; label: string; suggestedOwnerId?: string };
  reviewStatus: InsightReviewStatus;
  reviewReason?: string;
  taskId?: string;
  outcomeId?: string;
}

export interface KnowledgeBlockDefinition {
  id: KnowledgeBlockId;
  title: string;
  purpose: string;
  owner: string;
  dataSources: string[];
  requiredFields: string[];
  businessRules: string[];
  signalDefinitions: string[];
  actions: string[];
  outcomeMeasures: string[];
  displayComponents: string[];
  updatedAt: string;
  priority: "P0" | "P1";
}

export type PulseOutcomeStatus = "completed" | "not_pursued" | "unsuccessful" | "pending";

export interface PulseValueAttribution {
  realisedRevenue: number | null;
  pipelinePotential: number | null;
  estimatedTimeSavedHours: number | null;
  directCostSavings: number | null;
  qualitativeBenefit: string | null;
  currency: "GBP";
  notes: string;
  sourceEntityIds: string[];
}

export interface PulseInsightReview {
  insightId: string;
  decision: "accepted" | "rejected";
  at: string;
  reviewerId: string;
  reason?: string;
  taskId?: string;
}

export interface PulseOutcome {
  id: string;
  insightId: string;
  taskId: string | null;
  status: PulseOutcomeStatus;
  summary: string;
  value: PulseValueAttribution;
  createdAt: string;
  updatedAt: string;
}

export interface TessiantPulseState {
  reviews: Record<string, PulseInsightReview>;
  outcomes: PulseOutcome[];
  /** Stable IDs already attributed to value — prevent double counting. */
  attributedSourceKeys: string[];
}
