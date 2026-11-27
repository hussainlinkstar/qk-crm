export const STAGES = ["New", "Contacted", "Replied", "Signed up", "Audit run", "Checkout started", "Paid", "Lost"] as const;
export type Stage = (typeof STAGES)[number];

export const SOURCES = ["Manual", "CSV", "Apollo", "Signal", "Website"] as const;
export type Source = (typeof SOURCES)[number];

export const PLANS = ["None", "Free", "Pro"] as const;
export type Plan = (typeof PLANS)[number];

export const CHANNELS = ["email", "whatsapp", "linkedin"] as const;
export type Channel = (typeof CHANNELS)[number];

export const AUDIT_STATUSES = ["Queued", "Ready", "Sent", "Viewed", "Claimed", "Held"] as const;
export type AuditStatus = (typeof AUDIT_STATUSES)[number];

export type SignalEvent = "account_created" | "first_audit" | "checkout_started" | "subscription_paid" | "subscription_cancelled";

export interface Owner {
  id: string;
  name: string;
}

export interface Note {
  id: string;
  text: string;
  at: string;
  author: string;
}

export interface LeadTask {
  id: string;
  text: string;
  due: string;
  done: boolean;
}

export interface TimelineEvent {
  id: string;
  at: string;
  channel: Channel | "signal" | "note" | "audit";
  kind: "sent" | "delivered" | "opened" | "clicked" | "replied" | "signal" | "note" | "audit" | "system";
  summary: string;
  campaignId?: string;
  sequenceId?: string;
  templateId?: string;
}

export interface StageMark {
  stage: Stage;
  at: string;
}

export interface ProspectAudit {
  status: AuditStatus;
  tier: "Fast";
  aio: number | null;
  seo: number | null;
  topProblem: string;
  fixes: string[];
  lockedCount: number;
  unreadable: boolean;
  token: string;
  sentAt?: string;
  viewedAt?: string;
  claimedAt?: string;
}

export interface SignalAccount {
  linked: boolean;
  plan: Plan;
  auditsRun: number;
  aio: number | null;
  seo: number | null;
  lastLogin: string | null;
  lastAuditAt: string | null;
  checkout: "none" | "started" | "paid" | "cancelled";
  linkedAt: string | null;
}

export interface Lead {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  company: string;
  website: string;
  country: string;
  industry: string;
  title: string;
  source: Source;
  apolloSearch?: string;
  ownerId: string | null;
  stage: Stage;
  plan: Plan;
  tags: string[];
  notes: Note[];
  tasks: LeadTask[];
  dnc: Record<Channel, boolean>;
  lostReason?: string;
  manualCheck: boolean;
  whatsappOptIn: boolean;
  signal: SignalAccount;
  audit: ProspectAudit | null;
  history: StageMark[];
  timeline: TimelineEvent[];
  createdAt: string;
}

export interface Segment {
  id: string;
  name: string;
  filter: LeadQuery;
}

export interface LeadQuery {
  q?: string;
  stage?: Stage | "";
  source?: Source | "";
  country?: string;
  industry?: string;
  plan?: Plan | "";
  ownerId?: string;
  preset?: "" | "no-audit-7d" | "checkout-abandoned";
}

export type TemplateCategory = "Sequence" | "Campaign" | "Trigger" | "Letter";

export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  fallbacks: Record<string, string>;
  offerEnd: string;
  category?: TemplateCategory;
  paused?: boolean;
}

export interface Campaign {
  id: string;
  name: string;
  templateId: string;
  segmentId: string;
  status: "draft" | "scheduled" | "sent";
  scheduledFor?: string;
  timezoneNote: string;
}

export interface SequenceStep {
  templateId: string;
  waitDays: number;
}

export interface Sequence {
  id: string;
  name: string;
  steps: SequenceStep[];
  stopOnReply: boolean;
  stopOnSignup: boolean;
  stopOnPaid: boolean;
  stopOnUnsubscribe: boolean;
  allowOverlap: boolean;
  paused?: boolean;
}

export interface Enrollment {
  id: string;
  sequenceId: string;
  leadId: string;
  stepIndex: number;
  enrolledAt: string;
  nextAt: string;
  status: "active" | "stopped";
  stopReason?: string;
}

export interface Trigger {
  id: string;
  name: string;
  event: "report_viewed_no_signup" | "signup_no_audit" | "checkout_not_paid";
  waitHours: number;
  templateId: string;
  channel: "email" | "whatsapp";
  fired: string[];
}

export interface WhatsAppTemplate {
  id: string;
  name: string;
  body: string;
  meta: "Draft" | "Submitted" | "Approved";
}

export interface WhatsAppMessage {
  id: string;
  at: string;
  from: "agent" | "lead" | "human";
  text: string;
}

export interface WhatsAppThread {
  leadId: string;
  aiPaused: boolean;
  messages: WhatsAppMessage[];
}

export interface LinkedInAccount {
  id: string;
  name: string;
  dailyLimit: number;
  sentToday: number;
  dayKey: string;
}

export interface LinkedInItem {
  id: string;
  leadId: string;
  accountId: string;
  step: "view" | "connect" | "followup";
  text: string;
  status: "queued" | "sent";
}

export interface ApolloProspect {
  id: string;
  firstName: string;
  lastName: string;
  title: string;
  company: string;
  website: string;
  email: string;
  country: string;
  industry: string;
  verified: boolean;
  hasWebsite: boolean;
}

export interface ApolloImport {
  id: string;
  at: string;
  search: string;
  imported: number;
  skipped: number;
  credits: number;
}

export interface Caps {
  auditCap: number;
  auditsUsed: number;
  auditDay: string;
  apolloCap: number;
  apolloUsed: number;
  emailLimit: number;
  emailsSent: number;
  emailDay: string;
}

export interface GrowthState {
  version: 1;
  owners: Owner[];
  leads: Lead[];
  segments: Segment[];
  templates: EmailTemplate[];
  campaigns: Campaign[];
  sequences: Sequence[];
  enrollments: Enrollment[];
  triggers: Trigger[];
  whatsappTemplates: WhatsAppTemplate[];
  threads: WhatsAppThread[];
  linkedinAccounts: LinkedInAccount[];
  linkedinQueue: LinkedInItem[];
  apolloCatalog: ApolloProspect[];
  apolloImports: ApolloImport[];
  caps: Caps;
}
