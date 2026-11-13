// Tessiant staff-augmentation domain contracts (Demo V1).
// Kept separate from core Sales types so Qiko CRM behaviour stays intact.

import type { TessiantPulseState } from "./tessiant-pulse-types";

export const ASSOCIATE_ROLE_TYPES = ["specialist", "consultant", "programme_manager", "SIA", "executive_advisor"] as const;
export type AssociateRoleType = (typeof ASSOCIATE_ROLE_TYPES)[number];

export const ASSOCIATE_ROLE_LABELS: Record<AssociateRoleType, string> = {
  specialist: "Specialist",
  consultant: "Consultant",
  programme_manager: "Programme manager",
  SIA: "SIA",
  executive_advisor: "Executive advisor",
};

export type TalentEngagementStatus = "available" | "deployed" | "limited" | "unavailable" | "inactive";

export const ASSOCIATE_SOURCES = ["internal", "network", "external"] as const;
export type AssociateSource = (typeof ASSOCIATE_SOURCES)[number];

export const ASSOCIATE_STATUSES = ["active", "unverified", "inactive"] as const;
export type AssociateStatus = (typeof ASSOCIATE_STATUSES)[number];

export const AVAILABILITY_STATUSES = ["available", "limited", "unavailable", "unknown"] as const;
export type AvailabilityStatus = (typeof AVAILABILITY_STATUSES)[number];

export const WORKING_MODES = ["remote", "hybrid", "onsite"] as const;
export type WorkingMode = (typeof WORKING_MODES)[number];

export const SENIORITY_LEVELS = ["mid", "senior", "principal", "executive"] as const;
export type SeniorityLevel = (typeof SENIORITY_LEVELS)[number];

export const REQUIREMENT_CATEGORIES = ["augmentation", "project team", "advisory"] as const;
export type RequirementCategory = (typeof REQUIREMENT_CATEGORIES)[number];

export const REQUIREMENT_STAGES = [
  "New Requirement",
  "Sourcing",
  "Validation",
  "Interview",
  "Commercials",
  "Placed",
] as const;
export type RequirementStage = (typeof REQUIREMENT_STAGES)[number];

export const REQUIREMENT_OUTCOMES = ["active", "on_hold", "lost", "cancelled", "archived"] as const;
export type RequirementOutcome = (typeof REQUIREMENT_OUTCOMES)[number];

export const REQUIREMENT_PRIORITIES = ["high", "medium", "low"] as const;
export type RequirementPriority = (typeof REQUIREMENT_PRIORITIES)[number];

/** Operations-facing pipeline labels for staffing command centre (maps over stored stages/outcomes). */
export const OPS_PIPELINE_STAGES = [
  "New",
  "Sourcing",
  "Shortlisting",
  "Interview",
  "Offer/Commercials",
  "Filled",
  "On Hold",
  "Closed",
] as const;
export type OpsPipelineStage = (typeof OPS_PIPELINE_STAGES)[number];

/** Candidate progression on a requisition (Oliv/ATS-style). Legacy values are normalized at read time. */
export const SHORTLIST_STATUSES = [
  "suggested",
  "contacted",
  "availability_confirmed",
  "shortlisted",
  "submitted_to_client",
  "interview",
  "offer",
  "placed",
  "rejected",
] as const;
export type ShortlistStatus = (typeof SHORTLIST_STATUSES)[number];

export const SHORTLIST_STATUS_LABELS: Record<ShortlistStatus, string> = {
  suggested: "Suggested",
  contacted: "Contacted",
  availability_confirmed: "Availability confirmed",
  shortlisted: "Shortlisted",
  submitted_to_client: "Submitted to client",
  interview: "Interview",
  offer: "Offer",
  placed: "Placed",
  rejected: "Rejected",
};

/** Commercial placement event statuses (Pulse / confirmation lifecycle). */
export const PLACEMENT_STATUSES = ["draft", "agreed", "confirmed", "closed"] as const;
export type PlacementStatus = (typeof PLACEMENT_STATUSES)[number];

/** Operational assignment lifecycle after a placement is confirmed. */
export const ASSIGNMENT_STATUSES = ["upcoming", "active", "extended", "completed", "cancelled"] as const;
export type AssignmentStatus = (typeof ASSIGNMENT_STATUSES)[number];

export const ASSIGNMENT_STATUS_LABELS: Record<AssignmentStatus, string> = {
  upcoming: "Upcoming",
  active: "Active",
  extended: "Extended",
  completed: "Completed",
  cancelled: "Cancelled",
};

export interface AssignmentDocument {
  id: string;
  name: string;
  kind: "contract" | "sow" | "timesheet" | "other";
  ref: string;
  uploadedAt: string;
}

export interface AssignmentNote {
  id: string;
  body: string;
  authorId: string;
  createdAt: string;
  kind: "note" | "renewal" | "status" | "placement" | "feedback";
}

export const RATE_UNITS = ["day", "hour", "month"] as const;
export type RateUnit = (typeof RATE_UNITS)[number];

export interface MoneyRate {
  amount: number;
  currency: "GBP" | "EUR" | "USD";
  unit: RateUnit;
}

export interface AssociateDocument {
  id: string;
  kind: "cv" | "certificate" | "other";
  name: string;
  ref: string;
  uploadedAt: string;
  verifiedAt: string | null;
  version: number;
}

export interface AssociateExperience {
  id: string;
  title: string;
  organisation: string;
  sector: string;
  startDate: string;
  endDate: string | null;
  summary: string;
}

export interface AssociateActivityNote {
  id: string;
  body: string;
  authorId: string;
  createdAt: string;
  kind: "note" | "availability" | "follow_up" | "commercial";
}

export interface Associate {
  id: string;
  name: string;
  roleType: AssociateRoleType;
  headline: string;
  seniority: SeniorityLevel;
  skills: string[];
  sectors: string[];
  location: string;
  workingMode: WorkingMode;
  availability: AvailabilityStatus;
  nextAvailableDate: string | null;
  rate: MoneyRate | null;
  /** Client-facing agreed rate when placed — optional, restricted visibility. */
  agreedRate?: MoneyRate | null;
  contractNotes?: string;
  source: AssociateSource;
  cvRef: string;
  verifiedAt: string | null;
  ownerId: string | null;
  notes: string;
  tags: string[];
  status: AssociateStatus;
  languages: string[];
  offerings: string[];
  priorPlacementCount: number;
  /** Professional summary for talent profile. */
  summary?: string;
  specialisations?: string[];
  email?: string | null;
  phone?: string | null;
  profileUpdatedAt?: string;
  documents?: AssociateDocument[];
  experience?: AssociateExperience[];
  activityNotes?: AssociateActivityNote[];
}

export interface ClientAccount {
  id: string;
  name: string;
  industry: string;
  sector: string;
  primaryOwnerId: string | null;
  secondaryOwnerId: string | null;
  offeringInterests: string[];
  /** Services purchased historically (distinct from open opportunity pipeline). */
  servicesPurchased?: string[];
  linkedLeadId: string | null;
  notes: string;
  status: "active" | "prospect" | "inactive";
  website?: string | null;
  billingCurrency?: "GBP" | "EUR" | "USD";
}

export interface StageHistoryEntry {
  stage: RequirementStage;
  at: string;
  actorId: string;
  reason?: string;
}

export interface ClientRequirement {
  id: string;
  accountId: string;
  title: string;
  category: RequirementCategory;
  description: string;
  sector: string;
  mustHaveSkills: string[];
  preferredSkills: string[];
  seniority: SeniorityLevel;
  roleType: AssociateRoleType | "any";
  location: string;
  workingMode: WorkingMode | "flexible";
  startDate: string;
  durationWeeks: number;
  headcount: number;
  rateMin: number | null;
  rateMax: number | null;
  currency: MoneyRate["currency"];
  rateUnit: RateUnit;
  ownerId: string | null;
  requestDate: string;
  notes: string;
  stage: RequirementStage;
  outcome: RequirementOutcome;
  outcomeReason: string | null;
  /** Staffing urgency for resource managers — defaults to medium when absent on legacy records. */
  priority?: RequirementPriority;
  /** Linked CRM sales opportunity / lead for commercial context. */
  linkedOpportunityId?: string | null;
  stageHistory: StageHistoryEntry[];
  offeringAlignment: string[];
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CandidateValidation {
  availabilityConfirmed: boolean;
  costConfirmed: boolean;
  indicativeCost: MoneyRate | null;
  notes: string;
  verifiedAt: string | null;
}

export type InterviewRecommendation = "advance" | "hold" | "reject";

export interface InterviewRatings {
  /** 1–5 each. */
  technical: number;
  communication: number;
  fit: number;
}

export interface InterviewFeedback {
  heldAt: string | null;
  outcome: "pending" | "positive" | "neutral" | "negative";
  summary: string;
  /** Structured scorecard, when the interviewer filled one in. */
  ratings?: InterviewRatings;
  recommend?: InterviewRecommendation;
  /** Who gave the feedback: the Tessiant interviewer or the client panel. */
  by?: "team" | "client";
  strengths?: string;
  concerns?: string;
}

export interface RequirementCandidate {
  id: string;
  requirementId: string;
  associateId: string;
  matchScore: number;
  matchReasons: string[];
  matchGaps: string[];
  matchFlags: Array<"verified" | "unverified" | "unavailable" | "missing_data" | "manual_override">;
  shortlistStatus: ShortlistStatus;
  rankOverride: number | null;
  overrideReason: string | null;
  sourcedExternally: boolean;
  validation: CandidateValidation;
  interview: InterviewFeedback;
  quotedClientRate: MoneyRate | null;
  /** Set when rejected — shown on timeline and candidate card. */
  rejectionReason?: string | null;
  /** Last outbound contact note for this requisition. */
  lastContactNote?: string | null;
  lastContactAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PlacementTerms {
  associateCost: MoneyRate | null;
  clientRate: MoneyRate | null;
  startDate: string | null;
  endDate: string | null;
  notes: string;
}

/**
 * Assignment / deployment record. A confirmed placement creates or activates one.
 * `status` remains the commercial placement event; `assignmentStatus` is the ops lifecycle.
 */
export interface Placement {
  id: string;
  requirementId: string;
  associateId: string;
  candidateId: string;
  /** Denormalised client account for deployment views. */
  accountId?: string;
  /** Role performed on the engagement (defaults to requirement title). */
  roleTitle?: string;
  /** Responsible resource manager. */
  ownerId?: string | null;
  workingPattern?: WorkingMode | "flexible";
  /**
   * Agreed capacity on this engagement (100 = full-time).
   * Overlapping assignments allowed when capacity permits — do not assume 100% lock.
   */
  capacityPercent?: number;
  renewalDate?: string | null;
  assignmentStatus?: AssignmentStatus;
  documents?: AssignmentDocument[];
  engagementNotes?: AssignmentNote[];
  /** Linked CRM task for renewal / redeployment follow-up. */
  followUpTaskId?: string | null;
  /** Confirmed date the associate becomes free again after completion. */
  confirmedAvailableDate?: string | null;
  status: PlacementStatus;
  terms: PlacementTerms;
  placementDate: string | null;
  outcome: "open" | "completed" | "ended_early" | null;
  /** Optional renewal flag for assignment desk — derived if missing. */
  renewalStatus?: "on_track" | "renewal_due" | "ending" | "open_ended";
  createdAt: string;
  updatedAt: string;
}

/** Alias used by assignment desk UI. */
export type Assignment = Placement;

/**
 * Structured CRM → Pulse domain events (Demo V1).
 * Stable IDs + entity refs + timestamps let Pulse retrieve underlying evidence.
 * Not a claim of live Salesforce / SharePoint / LinkedIn integrations.
 */
export type TessiantDomainEventType =
  | "lead.created"
  | "lead.qualified"
  | "lead.converted"
  | "opportunity.created"
  | "opportunity.progressed"
  | "opportunity.won"
  | "opportunity.lost"
  | "associate.created"
  | "associate.updated"
  | "associate.availability_changed"
  | "associate.availability_verified"
  | "requirement.created"
  | "requirement.opened"
  | "requirement.stage_changed"
  | "candidate.suggested"
  | "candidate.shortlisted"
  | "candidate.removed_from_shortlist"
  | "candidate.contacted"
  | "candidate.submitted_to_client"
  | "candidate.interviewed"
  | "candidate.rejected"
  | "candidate.status_changed"
  | "candidate.external_recorded"
  | "candidate.validation_completed"
  | "interview.completed"
  | "offer.created"
  | "offer.agreed"
  | "quote.sent"
  | "quote.agreed"
  | "placement.confirmed"
  | "placement.closed"
  | "assignment.started"
  | "assignment.activated"
  | "assignment.extended"
  | "assignment.completed"
  | "assignment.cancelled"
  | "assignment.renewal_followup"
  | "task.completed"
  | "account.relationship_owner_changed"
  | "client.feedback_recorded";

export type DomainEventEntityType =
  | "associate"
  | "requirement"
  | "candidate"
  | "placement"
  | "account"
  | "task"
  | "lead"
  | "opportunity"
  | "contact";

export interface DomainEvent {
  eventId: string;
  eventType: TessiantDomainEventType;
  entityType: DomainEventEntityType;
  entityId: string;
  timestamp: string;
  actor: string;
  source: "tessiant-crm";
  schemaVersion: 1;
  /** Enough for Pulse to open source records and reconstruct evidence. */
  payload: Record<string, unknown>;
}

/** Aggregate network KPI — not the sample table row count. */
export interface NetworkStats {
  totalMembers: number;
  sampleSize: number;
  activeSample: number;
  siaSample: number;
  verifiedSample: number;
  /** Showcase: people reachable through one introduction from the network. Demo figure. */
  secondaryMembers?: number;
  /** Showcase: second-degree profiles per skill, used for "could fill" reach. Demo figures. */
  secondDegreeBySkill?: Record<string, number>;
}

export interface TessiantStateSlice {
  networkStats: NetworkStats;
  associates: Associate[];
  accounts: ClientAccount[];
  requirements: ClientRequirement[];
  candidates: RequirementCandidate[];
  placements: Placement[];
  domainEvents: DomainEvent[];
  /** Pulse review/outcome persistence for Tessiant intelligence demo. */
  pulse?: TessiantPulseState;
}
