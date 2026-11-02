// Derived, read-only views over CRM state: lead summaries, AI suggestions (rule-based,
// evidence-backed), Home priorities, KPIs and trends. Pure functions — easy to move server-side.

import type { ActivityEvent, CrmState, Evidence, Lead, Priority, Suggestion, SuggestionRule, Task } from "./types";
import { addDays, formatDate, plural, toDateKey, todayKey } from "./format";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

export interface LeadView extends Lead {
  lastActivity: ActivityEvent | null;
  openTasks: Task[];
  engagementScore: number;
  nextActionLabel: string;
  scansCount: number;
}

const ENGAGEMENT_KINDS = new Set(["login", "product", "report", "scan"]);
const TOUCH_KINDS = new Set(["interaction", "status_change", "note"]);

export function eventsByLead(state: CrmState): Map<string, ActivityEvent[]> {
  const map = new Map<string, ActivityEvent[]>();
  for (const event of state.events) {
    const list = map.get(event.leadId);
    if (list) list.push(event);
    else map.set(event.leadId, [event]);
  }
  for (const list of map.values()) list.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
  return map;
}

export function isOpen(task: Task) {
  return task.status === "pending" || task.status === "in_progress";
}

const PRIORITY_RANK: Record<Priority, number> = { high: 0, medium: 1, low: 2 };
const SUGGESTION_NEXT_ACTIONS: Record<SuggestionRule, string> = {
  signal_review: "Review new Signal sign-up",
  scan_review: "Review scan results and follow up",
  engagement: "Follow up on strong engagement",
  enquiry_contact: "Contact about the website enquiry",
  stale: "Re-engage lead",
};

function suggestedTaskNextAction(title: string): string {
  if (/scan results/i.test(title)) return SUGGESTION_NEXT_ACTIONS.scan_review;
  if (/signal/i.test(title)) return SUGGESTION_NEXT_ACTIONS.signal_review;
  if (/enquiry/i.test(title)) return SUGGESTION_NEXT_ACTIONS.enquiry_contact;
  if (/strong engagement/i.test(title)) return SUGGESTION_NEXT_ACTIONS.engagement;
  if (/re-engage/i.test(title)) return SUGGESTION_NEXT_ACTIONS.stale;
  return "Review suggested follow-up";
}

export function sortTasks(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    const due = (a.due ?? "9999") .localeCompare(b.due ?? "9999");
    return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || due || b.createdAt.localeCompare(a.createdAt);
  });
}

function engagementScore(events: ActivityEvent[], now: number): number {
  let score = 0;
  for (const event of events) {
    const age = (now - new Date(event.occurredAt).getTime()) / DAY;
    if (age > 30) continue;
    const weight = event.kind === "scan" ? 14 : event.kind === "report" ? 12 : event.kind === "enquiry" ? 16 : event.kind === "signup" ? 10 : ENGAGEMENT_KINDS.has(event.kind) ? 8 : 3;
    score += weight * Math.max(0.2, 1 - age / 30);
  }
  return Math.min(100, Math.round(score * 1.6));
}

// — Suggestions ———————————————————————————————————————————————

interface SuggestionContext {
  state: CrmState;
  byLead: Map<string, ActivityEvent[]>;
  openByLead: Map<string, Task[]>;
  now: number;
}

function ev(event: ActivityEvent, label?: string): Evidence {
  return { label: label ?? event.title, detail: event.detail, at: event.occurredAt, source: event.source, kind: "fact" };
}

function within(event: ActivityEvent, hours: number, now: number) {
  return now - new Date(event.occurredAt).getTime() <= hours * HOUR;
}

function buildSuggestions({ state, byLead, openByLead, now }: SuggestionContext): Suggestion[] {
  const suggestions: Suggestion[] = [];
  const scansByLead = new Map<string, typeof state.scans>();
  for (const scan of state.scans) scansByLead.set(scan.leadId, [...(scansByLead.get(scan.leadId) ?? []), scan]);

  const add = (rule: SuggestionRule, lead: Lead, key: string, data: Omit<Suggestion, "id" | "rule" | "leadId">) => {
    suggestions.push({ id: `${rule}:${lead.id}:${key}`, rule, leadId: lead.id, ...data });
  };

  for (const lead of state.leads) {
    if (lead.status === "Won" || lead.status === "Lost") continue;
    if ((openByLead.get(lead.id) ?? []).length > 0) continue;
    const events = byLead.get(lead.id) ?? [];
    const recentScan = (scansByLead.get(lead.id) ?? []).find((scan) => now - new Date(scan.completedAt).getTime() <= 72 * HOUR);
    const company = lead.company ? ` (${lead.company})` : "";

    if (recentScan && (lead.status === "New" || lead.status === "Contacted")) {
      const reportViews = events.filter((event) => event.kind === "report" && within(event, 72, now));
      add("scan_review", lead, recentScan.id, {
        title: `Review ${lead.name}'s scan results and follow up`,
        reason: `Free scan of ${recentScan.website} scored ${recentScan.score}/100${recentScan.score < 60 ? ", leaving clear room for improvement" : ""}.${reportViews.length ? " They have already opened the report." : ""}`,
        priority: recentScan.score < 60 || reportViews.length ? "high" : "medium",
        evidence: [
          { label: `Scan completed · ${recentScan.website}`, detail: `Score ${recentScan.score}/100 · ${recentScan.findings.slice(0, 2).join("; ")}`, at: recentScan.completedAt, source: "Qiko Signal", kind: "fact" },
          ...reportViews.map((event) => ev(event)),
          { label: "Low score + recent engagement suggests a sales opportunity", source: "Qiko Core", kind: "inference" },
        ],
        suggestedDue: todayKey(),
      });
      continue;
    }

    const signup = events.find((event) => event.kind === "signup" && within(event, 7 * 24, now));
    if (lead.source === "Qiko Signal" && lead.status === "New" && signup) {
      const usage = events.filter((event) => event.kind !== "signup" && within(event, 7 * 24, now));
      add("signal_review", lead, signup.id, {
        title: "Review new Signal sign-up",
        reason: `Registered on Qiko Signal ${formatDate(signup.occurredAt)} and has not been contacted yet.${usage.length ? ` ${plural(usage.length, "product action")} since sign-up.` : ""}`,
        priority: usage.length > 0 ? "high" : "medium",
        evidence: [ev(signup), ...usage.slice(0, 3).map((event) => ev(event)), { label: "No owner contact recorded since sign-up", source: "Qiko Core", kind: "fact" }],
        suggestedDue: todayKey(),
      });
      continue;
    }

    const enquiry = events.find((event) => event.kind === "enquiry" && lead.source === "Website" && within(event, 72, now));
    if (enquiry && lead.status === "New") {
      add("enquiry_contact", lead, enquiry.id, {
        title: `Contact ${lead.name} about their enquiry`,
        reason: `Submitted a website enquiry ${formatDate(enquiry.occurredAt)} and is waiting for a reply.`,
        priority: "high",
        evidence: [ev(enquiry), { label: "Fast replies to enquiries convert better", source: "Qiko Core", kind: "inference" }],
        suggestedDue: todayKey(),
      });
      continue;
    }

    const engaged = events.filter((event) => ENGAGEMENT_KINDS.has(event.kind) && event.kind !== "scan" && within(event, 72, now));
    if (engaged.length >= 3) {
      add("engagement", lead, engaged[0].id, {
        title: `Follow up with ${lead.name} — strong engagement`,
        reason: `${plural(engaged.length, "product interaction")} in the last 3 days${lead.status === "Qualified" ? " on a qualified opportunity" : ""}.`,
        priority: "high",
        evidence: [...engaged.slice(0, 4).map((event) => ev(event)), { label: "Activity spike indicates buying interest", source: "Qiko Core", kind: "inference" }],
        suggestedDue: addDays(1),
      });
      continue;
    }

    if (lead.status === "Contacted" || lead.status === "Qualified") {
      const lastTouch = [
        ...events.filter((event) => TOUCH_KINDS.has(event.kind)).map((event) => event.occurredAt),
        ...state.notes.filter((note) => note.leadId === lead.id).map((note) => note.createdAt),
        ...state.tasks.filter((task) => task.leadId === lead.id && task.completedAt).map((task) => task.completedAt as string),
      ].sort().pop();
      const days = lastTouch ? Math.floor((now - new Date(lastTouch).getTime()) / DAY) : 99;
      if (days >= 7) {
        add("stale", lead, lastTouch ?? "never", {
          title: `Re-engage ${lead.name}${company}`,
          reason: `${lead.status} lead with no follow-up for ${days} days.`,
          priority: lead.status === "Qualified" ? "high" : "medium",
          evidence: [
            { label: lastTouch ? `Last follow-up ${formatDate(lastTouch)}` : "No follow-up recorded", source: "Qiko Core", kind: "fact", at: lastTouch },
            { label: `${lead.status} leads go cold without regular contact`, source: "Qiko Core", kind: "inference" },
          ],
          suggestedDue: todayKey(),
        });
      }
    }
  }
  const rank: Record<SuggestionRule, number> = { enquiry_contact: 0, scan_review: 1, signal_review: 2, engagement: 3, stale: 4 };
  return suggestions
    .filter((suggestion) => !state.decisions[suggestion.id])
    .sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || rank[a.rule] - rank[b.rule]);
}

// — Workspace view ————————————————————————————————————————————

export interface Workspace {
  leads: LeadView[];
  leadById: Map<string, LeadView>;
  byLead: Map<string, ActivityEvent[]>;
  suggestions: Suggestion[];
  tasks: Task[];
}

export function buildWorkspace(state: CrmState, now = Date.now()): Workspace {
  const byLead = eventsByLead(state);
  const openByLead = new Map<string, Task[]>();
  for (const task of state.tasks) {
    if (task.leadId && isOpen(task)) openByLead.set(task.leadId, [...(openByLead.get(task.leadId) ?? []), task]);
  }
  const suggestions = buildSuggestions({ state, byLead, openByLead, now });
  const suggestionByLead = new Map<string, Suggestion>();
  for (const suggestion of suggestions) if (!suggestionByLead.has(suggestion.leadId)) suggestionByLead.set(suggestion.leadId, suggestion);
  const scanCount = new Map<string, number>();
  for (const scan of state.scans) scanCount.set(scan.leadId, (scanCount.get(scan.leadId) ?? 0) + 1);

  const leads: LeadView[] = state.leads.map((lead) => {
    const events = byLead.get(lead.id) ?? [];
    const openTasks = sortTasks(openByLead.get(lead.id) ?? []);
    const suggestion = suggestionByLead.get(lead.id);
    const firstTask = openTasks[0];
    const taskAction = firstTask ? firstTask.origin === "suggestion" ? suggestedTaskNextAction(firstTask.title) : firstTask.title : undefined;
    const nextActionLabel = lead.nextAction ?? taskAction ?? (suggestion ? SUGGESTION_NEXT_ACTIONS[suggestion.rule] : undefined) ?? (lead.status === "Won" ? "Hand over to onboarding" : lead.status === "Lost" ? "No action needed" : "Schedule a follow-up");
    return { ...lead, lastActivity: events[0] ?? null, openTasks, engagementScore: engagementScore(events, now), nextActionLabel, scansCount: scanCount.get(lead.id) ?? 0 };
  });
  leads.sort((a, b) => (b.lastActivity?.occurredAt ?? b.createdAt).localeCompare(a.lastActivity?.occurredAt ?? a.createdAt));
  return { leads, leadById: new Map(leads.map((lead) => [lead.id, lead])), byLead, suggestions, tasks: state.tasks };
}

// — Home priorities ————————————————————————————————————————————

export interface PriorityGroup {
  id: SuggestionRule | "tasks";
  title: string;
  summary: string;
  priority: Priority;
  suggestions: Suggestion[];
  tasks: Task[];
}

const GROUP_COPY: Record<SuggestionRule, (count: number) => { title: string; summary: string }> = {
  signal_review: (count) => ({ title: `Review ${plural(count, "new Signal lead")} awaiting follow-up`, summary: "Recent Qiko Signal registrations nobody has contacted yet." }),
  scan_review: (count) => ({ title: `Check ${plural(count, "completed free scan")} for sales opportunities`, summary: "Scans finished in the last 72 hours with room for improvement." }),
  engagement: (count) => ({ title: `Follow up with ${plural(count, "prospect")} showing strong engagement`, summary: "Repeated logins, report exports and pricing views this week." }),
  enquiry_contact: (count) => ({ title: `Reply to ${plural(count, "new website enquiry", "new website enquiries")}`, summary: "Contact-form submissions waiting for a first response." }),
  stale: (count) => ({ title: `Re-engage ${plural(count, "lead")} with no recent follow-up`, summary: "Contacted or qualified leads untouched for 7+ days." }),
};

export function buildPriorities(workspace: Workspace): PriorityGroup[] {
  const groups = new Map<SuggestionRule, Suggestion[]>();
  for (const suggestion of workspace.suggestions) groups.set(suggestion.rule, [...(groups.get(suggestion.rule) ?? []), suggestion]);
  const order: SuggestionRule[] = ["signal_review", "scan_review", "engagement", "enquiry_contact", "stale"];
  const result: PriorityGroup[] = order
    .filter((rule) => groups.has(rule))
    .map((rule) => {
      const items = groups.get(rule) ?? [];
      return { id: rule, ...GROUP_COPY[rule](items.length), priority: items.some((item) => item.priority === "high") ? "high" : "medium", suggestions: items, tasks: [] };
    });
  const urgentTasks = sortTasks(workspace.tasks.filter((task) => isOpen(task) && task.due !== null && task.due <= todayKey()));
  if (urgentTasks.length) {
    result.push({ id: "tasks", title: `Complete ${plural(urgentTasks.length, "task")} due today or overdue`, summary: "Tasks already on your plan that need finishing.", priority: "high", suggestions: [], tasks: urgentTasks });
  }
  return result.slice(0, 3);
}

// — Metrics & trends ———————————————————————————————————————————

export interface MetricCard {
  key: string;
  label: string;
  value: number;
  description: string;
  delta: string;
  tone?: "warning" | "positive";
  href: string;
}

export function buildMetrics(state: CrmState, now = Date.now()): MetricCard[] {
  const week = (iso: string) => now - new Date(iso).getTime() <= 7 * DAY;
  const signups = state.events.filter((event) => event.kind === "signup");
  const enquiries = state.events.filter((event) => event.kind === "enquiry");
  const active = new Set(state.events.filter((event) => ENGAGEMENT_KINDS.has(event.kind) && now - new Date(event.occurredAt).getTime() <= 30 * DAY).map((event) => event.leadId));
  const today = todayKey();
  const followUps = state.tasks.filter((task) => isOpen(task) && task.due !== null && task.due <= today);
  const overdue = followUps.filter((task) => (task.due as string) < today).length;
  return [
    { key: "leads", label: "Total leads", value: state.leads.length, description: "Unique prospects across all sources · all time", delta: `+${state.leads.filter((lead) => week(lead.createdAt)).length} this week`, tone: "positive", href: "/sales/leads" },
    { key: "signups", label: "Signal sign-ups", value: signups.length, description: "Users registered on Qiko Signal · all time", delta: `+${signups.filter((event) => week(event.occurredAt)).length} this week`, tone: "positive", href: "/sales/leads?source=Qiko%20Signal" },
    { key: "scans", label: "Free scans", value: state.scans.length, description: "Completed free audits · all time", delta: `+${state.scans.filter((scan) => week(scan.completedAt)).length} this week`, tone: "positive", href: "/sales/leads?activity=scan" },
    { key: "active", label: "Active users", value: active.size, description: "Product activity in the last 30 days", delta: `${Math.round((active.size / Math.max(1, state.leads.length)) * 100)}% of leads`, href: "/sales/leads?activity=active" },
    { key: "enquiries", label: "Enquiries · 7 days", value: enquiries.filter((event) => week(event.occurredAt)).length, description: "Website and contact-form submissions", delta: `${enquiries.length} all time`, href: "/sales/leads?source=Website" },
    { key: "followups", label: "Follow-ups due", value: followUps.length, description: "Open tasks due today or overdue", delta: overdue ? `${overdue} overdue` : "None overdue", tone: overdue ? "warning" : undefined, href: "/sales/actions" },
  ];
}

export interface TrendSeries {
  key: string;
  label: string;
  color: string;
  points: { key: string; label: string; value: number }[];
}

export function buildTrends(state: CrmState, days = 30): TrendSeries[] {
  const keys: string[] = [];
  for (let offset = days - 1; offset >= 0; offset -= 1) keys.push(addDays(-offset));
  const count = (dates: string[]) => {
    const map = new Map<string, number>();
    for (const iso of dates) {
      const key = toDateKey(new Date(iso));
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return keys.map((key) => ({ key, label: formatDate(key), value: map.get(key) ?? 0 }));
  };
  return [
    { key: "signups", label: "Sign-ups", color: "#4f46e5", points: count(state.events.filter((event) => event.kind === "signup").map((event) => event.occurredAt)) },
    { key: "scans", label: "Scans completed", color: "#0ea5e9", points: count(state.scans.map((scan) => scan.completedAt)) },
  ];
}

export function sourceBreakdown(state: CrmState) {
  const map = new Map<string, number>();
  for (const lead of state.leads) map.set(lead.source, (map.get(lead.source) ?? 0) + 1);
  return [...map.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
}

export function taskCounts(tasks: Task[]) {
  const today = todayKey();
  return {
    pending: tasks.filter((task) => task.status === "pending").length,
    in_progress: tasks.filter((task) => task.status === "in_progress").length,
    completed: tasks.filter((task) => task.status === "completed").length,
    overdue: tasks.filter((task) => isOpen(task) && task.due !== null && task.due < today).length,
  };
}
