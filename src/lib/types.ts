// Shared CRM data contracts. Sales is modelled on conventional Salesforce-style
// B2B consulting/staffing patterns (Leads → Accounts/Contacts/Opportunities).
// Not a claim of Tessiant's exact Salesforce org — standard CRM starting point.

import type { TessiantStateSlice } from "./tessiant-types";

export type { TessiantStateSlice } from "./tessiant-types";

/** Pre-opportunity lead qualification statuses (Salesforce-style). Closed outcomes live on Opportunities. */
export const LEAD_STATUSES = ["New", "Working", "Qualified", "Unqualified", "Converted"] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const TASK_STATUSES = ["pending", "in_progress", "completed", "dismissed"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const PRIORITIES = ["high", "medium", "low"] as const;
export type Priority = (typeof PRIORITIES)[number];

export const LEAD_SOURCES = [
  "Referral",
  "Associate introduction",
  "SIA introduction",
  "Inbound",
  "Campaign",
  "Website",
  "Event",
  "Partner",
  "Outbound",
  "Manual entry",
  "Existing client",
] as const;
export type LeadSource = (typeof LEAD_SOURCES)[number];

export const OPPORTUNITY_STAGES = [
  "Qualification",
  "Discovery",
  "Proposal",
  "Negotiation",
  "Closed Won",
  "Closed Lost",
] as const;
export type OpportunityStage = (typeof OPPORTUNITY_STAGES)[number];

export const OPPORTUNITY_TYPES = ["augmentation", "project team", "advisory", "consultancy", "mixed"] as const;
export type OpportunityType = (typeof OPPORTUNITY_TYPES)[number];

export const ACTIVITY_TYPES = ["call", "meeting", "email", "introduction", "note", "follow_up", "other"] as const;
export type SalesActivityType = (typeof ACTIVITY_TYPES)[number];

export interface Member {
  id: string;
  name: string;
  email: string;
  role: string;
}

export interface Lead {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  company: string | null;
  role: string | null;
  source: LeadSource;
  status: LeadStatus;
  ownerId: string | null;
  createdAt: string;
  /** Free-text override for the next action; otherwise derived from tasks and suggestions. */
  nextAction: string | null;
  /** Industry / sector of the prospect company. */
  sector?: string | null;
  /** Staffing / consultancy service interest. */
  serviceInterest?: string | null;
  /** Linked Tessiant/client account when known. */
  accountId?: string | null;
  convertedOpportunityId?: string | null;
  convertedContactId?: string | null;
  /** Associate or SIA who made the introduction, when the lead came through the network. */
  introducedByAssociateId?: string | null;
}

/** Client stakeholder — belongs to an account. */
export interface Contact {
  id: string;
  accountId: string;
  name: string;
  email: string;
  phone: string | null;
  role: string | null;
  ownerId: string | null;
  isPrimary: boolean;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Commercial opportunity. Pipeline amount ≠ agreed contract ≠ expected billing ≠ recognised revenue.
 */
export interface Opportunity {
  id: string;
  name: string;
  accountId: string;
  contactId: string | null;
  leadId: string | null;
  type: OpportunityType;
  stage: OpportunityStage;
  /** Estimated pipeline / opportunity value (not recognised revenue). */
  amount: number;
  currency: "GBP" | "EUR" | "USD";
  /** Win likelihood 0–100. */
  probability: number;
  expectedCloseDate: string;
  ownerId: string | null;
  services: string[];
  nextStep: string | null;
  /** Agreed contract value after Closed Won — still not automatically recognised revenue. */
  agreedContractValue: number | null;
  /** Expected billing from assignments / SOWs (forecast). */
  expectedBilling: number | null;
  /** Recognised / realised revenue when engagements complete. */
  recognisedRevenue: number | null;
  lostReason: string | null;
  /** Copied from the originating lead when converted; otherwise recorded origin. */
  source?: LeadSource | null;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
}

export type ActivityKind =
  | "signup"
  | "login"
  | "scan"
  | "report"
  | "enquiry"
  | "product"
  | "lead_created"
  | "status_change"
  | "owner_change"
  | "note"
  | "interaction"
  | "task"
  | "opportunity"
  | "conversion";

export interface ActivityEvent {
  id: string;
  leadId: string;
  kind: ActivityKind;
  title: string;
  detail?: string;
  occurredAt: string;
  source: string;
  actor?: string;
  accountId?: string | null;
  opportunityId?: string | null;
  contactId?: string | null;
  activityType?: SalesActivityType;
}

export interface Scan {
  id: string;
  leadId: string;
  website: string;
  score: number;
  status: "completed" | "running";
  completedAt: string;
  findings: string[];
  reportName: string;
}

export interface Note {
  id: string;
  leadId: string;
  body: string;
  authorId: string;
  createdAt: string;
  accountId?: string | null;
  opportunityId?: string | null;
  contactId?: string | null;
}

export type ConversationChannel = "email" | "whatsapp";

export interface ConversationMessage {
  id: string;
  leadId: string;
  channel: ConversationChannel;
  direction: "in" | "out";
  address: string;
  subject: string | null;
  body: string;
  at: string;
  actor: string;
}

export interface TaskHistoryEntry {
  at: string;
  actorId: string;
  action: string;
}

export interface Evidence {
  label: string;
  detail?: string;
  at?: string;
  source: string;
  kind: "fact" | "inference";
}

export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: Priority;
  due: string | null;
  ownerId: string | null;
  leadId: string | null;
  accountId?: string | null;
  opportunityId?: string | null;
  contactId?: string | null;
  origin: "manual" | "suggestion" | "copilot";
  evidence: Evidence[];
  history: TaskHistoryEntry[];
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

export type SuggestionRule = "signal_review" | "scan_review" | "engagement" | "enquiry_contact" | "stale";

export interface Suggestion {
  id: string;
  rule: SuggestionRule;
  title: string;
  reason: string;
  priority: Priority;
  leadId: string;
  evidence: Evidence[];
  suggestedDue: string;
}

export interface SuggestionDecision {
  decision: "accepted" | "dismissed" | "done";
  at: string;
  taskId?: string;
}

export interface CrmState {
  version: number;
  dataMode: "demo";
  seededAt: string;
  leads: Lead[];
  contacts: Contact[];
  opportunities: Opportunity[];
  events: ActivityEvent[];
  scans: Scan[];
  notes: Note[];
  messages: ConversationMessage[];
  tasks: Task[];
  members: Member[];
  decisions: Record<string, SuggestionDecision>;
  /** Tessiant staff-augmentation demo slice (optional on legacy stored state). */
  tessiant?: TessiantStateSlice;
  /** "Was this right?" ledger: the user's verdict on priorities, signals and Qiko-made tasks. */
  feedback?: Record<string, QikoFeedback>;
  /** Automation rules switched off by the user; absent means on. */
  automationPrefs?: Record<string, boolean>;
}

export type FeedbackVerdict = "right" | "partly" | "wrong";

export interface QikoFeedback {
  key: string;
  context: "priority" | "signal" | "task" | "insight";
  verdict: FeedbackVerdict;
  reason?: string;
  at: string;
}

export interface Session {
  userId: string;
  name: string;
  email: string;
  signedInAt: string;
  remember: boolean;
}

export type Execution =
  | { type: "create_task"; label: string; task: { title: string; description: string; leadId: string | null; priority: Priority; due: string | null } }
  | { type: "update_status"; label: string; leadId: string; status: LeadStatus }
  | { type: "open"; label: string; href: string };

export interface CopilotAnswer {
  id: string;
  question: string;
  answer: string;
  evidence: Evidence[];
  recommendation: string | null;
  executions: Execution[];
  grounded: boolean;
  at: string;
}
