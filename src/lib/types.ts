// Shared CRM data contracts. The UI only talks to these types, so the demo data
// provider can later be swapped for real Qiko services without touching screens.

export const LEAD_STATUSES = ["New", "Contacted", "Qualified", "Won", "Lost"] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const TASK_STATUSES = ["pending", "in_progress", "completed", "dismissed"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const PRIORITIES = ["high", "medium", "low"] as const;
export type Priority = (typeof PRIORITIES)[number];

export const LEAD_SOURCES = ["Qiko Signal", "Website", "Free audit", "Manual entry"] as const;
export type LeadSource = (typeof LEAD_SOURCES)[number];

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
  | "task";

export interface ActivityEvent {
  id: string;
  leadId: string;
  kind: ActivityKind;
  title: string;
  detail?: string;
  occurredAt: string;
  source: string;
  actor?: string;
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
  due: string | null; // YYYY-MM-DD
  ownerId: string | null;
  leadId: string | null;
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
  events: ActivityEvent[];
  scans: Scan[];
  notes: Note[];
  messages: ConversationMessage[];
  tasks: Task[];
  members: Member[];
  decisions: Record<string, SuggestionDecision>;
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
