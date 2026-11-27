import { todayKey, uid } from "@/lib/format";
import { STAGES, type Campaign, type Channel, type EmailTemplate, type GrowthState, type Lead, type LeadQuery, type Sequence, type SignalEvent, type Stage, type TimelineEvent } from "./types";

const DAY = 86_400_000;
const STAGE_INDEX = Object.fromEntries(STAGES.map((stage, index) => [stage, index])) as Record<Stage, number>;

export const MERGE_FALLBACKS: Record<string, string> = {
  firstName: "there",
  company: "your team",
  site: "your site",
  aio: "your AIO score",
  seo: "your SEO score",
  topProblem: "the main issue we found",
  reportLink: "your private report link",
  offerEnd: "soon",
};

export function fullName(lead: Lead): string {
  return `${lead.firstName} ${lead.lastName}`.trim();
}

export function emailDomain(email: string): string {
  return email.trim().toLowerCase().split("@")[1] ?? "";
}

export function siteDomain(website: string): string {
  const raw = website.trim().toLowerCase();
  if (!raw) return "";
  try {
    const host = new URL(raw.startsWith("http") ? raw : `https://${raw}`).hostname;
    return host.replace(/^www\./, "");
  } catch {
    return raw.replace(/^www\./, "").split("/")[0];
  }
}

export function leadDomain(lead: Pick<Lead, "email" | "website">): string {
  return siteDomain(lead.website) || emailDomain(lead.email);
}

export function findDuplicate(leads: Lead[], email: string, website: string, exceptId?: string): Lead | undefined {
  const mail = email.trim().toLowerCase();
  const domain = siteDomain(website) || emailDomain(mail);
  return leads.find((lead) => {
    if (lead.id === exceptId) return false;
    if (lead.email.toLowerCase() === mail) return true;
    const existing = leadDomain(lead);
    return Boolean(domain && existing && existing === domain);
  });
}

export function canContact(lead: Lead, channel: Channel): boolean {
  return !lead.dnc[channel];
}

export function planOf(lead: Lead): Lead["plan"] {
  return lead.signal.linked ? lead.signal.plan : lead.plan;
}

export function matchLead(lead: Lead, filter: LeadQuery, now = Date.now()): boolean {
  const term = filter.q?.trim().toLowerCase() ?? "";
  if (term && !`${fullName(lead)} ${lead.email} ${lead.company} ${lead.website} ${lead.tags.join(" ")}`.toLowerCase().includes(term)) return false;
  if (filter.stage && lead.stage !== filter.stage) return false;
  if (filter.source && lead.source !== filter.source) return false;
  if (filter.country && lead.country !== filter.country) return false;
  if (filter.industry && lead.industry !== filter.industry) return false;
  if (filter.plan && planOf(lead) !== filter.plan) return false;
  if (filter.ownerId === "none" && lead.ownerId) return false;
  if (filter.ownerId && filter.ownerId !== "none" && lead.ownerId !== filter.ownerId) return false;
  if (filter.preset === "no-audit-7d") {
    const signed = lead.history.some((mark) => mark.stage === "Signed up");
    const started = new Date(lead.signal.linkedAt ?? lead.createdAt).getTime();
    const stale = lead.signal.auditsRun === 0 || !lead.signal.lastAuditAt || now - new Date(lead.signal.lastAuditAt).getTime() > 7 * DAY;
    if (planOf(lead) !== "Free" || !signed || now - started < 7 * DAY || !stale) return false;
  }
  if (filter.preset === "checkout-abandoned" && lead.stage !== "Checkout started") return false;
  return true;
}

export function segmentLeads(state: GrowthState, segmentId: string, now = Date.now()): Lead[] {
  const segment = state.segments.find((item) => item.id === segmentId);
  if (!segment) return [];
  return state.leads.filter((lead) => matchLead(lead, segment.filter, now));
}

const FORWARD: Record<SignalEvent, Stage> = {
  account_created: "Signed up",
  first_audit: "Audit run",
  checkout_started: "Checkout started",
  subscription_paid: "Paid",
  subscription_cancelled: "Lost",
};

export function applySignalEvent(lead: Lead, event: SignalEvent, at: string): void {
  const next = FORWARD[event];
  lead.signal.linked = true;
  lead.signal.linkedAt = lead.signal.linkedAt ?? at;
  if (event === "account_created") {
    lead.signal.plan = lead.signal.plan === "None" ? "Free" : lead.signal.plan;
    lead.plan = lead.signal.plan;
  }
  if (event === "first_audit") {
    lead.signal.auditsRun = Math.max(lead.signal.auditsRun, 1);
    lead.signal.lastAuditAt = at;
    lead.signal.aio = lead.signal.aio ?? lead.audit?.aio ?? 62;
    lead.signal.seo = lead.signal.seo ?? lead.audit?.seo ?? 58;
  }
  if (event === "checkout_started") lead.signal.checkout = "started";
  if (event === "subscription_paid") {
    lead.signal.checkout = "paid";
    lead.signal.plan = "Pro";
    lead.plan = "Pro";
  }
  if (event === "subscription_cancelled") {
    lead.signal.checkout = "cancelled";
    lead.lostReason = lead.lostReason ?? "Subscription cancelled";
  }
  const current = STAGE_INDEX[lead.stage];
  const target = STAGE_INDEX[next];
  if (next === "Lost" || target > current) setStage(lead, next, at);
  pushTimeline(lead, { at, channel: "signal", kind: "signal", summary: `Signal event: ${event.replaceAll("_", " ")}` });
}

export function setStage(lead: Lead, stage: Stage, at: string, lostReason?: string): void {
  lead.stage = stage;
  if (stage === "Lost" && lostReason) lead.lostReason = lostReason;
  if (!lead.history.some((mark) => mark.stage === stage)) lead.history.push({ stage, at });
}

export function pushTimeline(lead: Lead, event: Omit<TimelineEvent, "id">): TimelineEvent {
  const row: TimelineEvent = { ...event, id: uid("ev") };
  lead.timeline.unshift(row);
  return row;
}

export function renderTemplate(template: EmailTemplate, lead: Lead, origin: string): { subject: string; body: string } {
  const audit = lead.audit;
  const values: Record<string, string> = {
    firstName: lead.firstName,
    company: lead.company,
    site: lead.website,
    aio: audit?.aio != null ? String(audit.aio) : lead.signal.aio != null ? String(lead.signal.aio) : "",
    seo: audit?.seo != null ? String(audit.seo) : lead.signal.seo != null ? String(lead.signal.seo) : "",
    topProblem: audit?.topProblem ?? "",
    reportLink: audit?.token && !audit.unreadable ? `${origin}/r/${audit.token}` : "",
    offerEnd: template.offerEnd,
  };
  const fill = (text: string) =>
    text.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key: string) => {
      const value = values[key]?.trim();
      if (value) return value;
      return template.fallbacks[key] || MERGE_FALLBACKS[key] || "there";
    });
  return { subject: fill(template.subject), body: fill(template.body) };
}

function rollDay(caps: GrowthState["caps"], now: number): void {
  const day = todayKey();
  if (caps.auditDay !== day) {
    caps.auditDay = day;
    caps.auditsUsed = 0;
  }
  if (caps.emailDay !== day) {
    caps.emailDay = day;
    caps.emailsSent = 0;
  }
  void now;
}

export function sendEmail(state: GrowthState, lead: Lead, template: EmailTemplate, meta: { campaignId?: string; sequenceId?: string; at: string; origin: string }): "sent" | "blocked" | "capped" {
  rollDay(state.caps, new Date(meta.at).getTime());
  if (!canContact(lead, "email")) return "blocked";
  if (state.caps.emailsSent >= state.caps.emailLimit) return "capped";
  const rendered = renderTemplate(template, lead, meta.origin);
  state.caps.emailsSent += 1;
  pushTimeline(lead, { at: meta.at, channel: "email", kind: "sent", summary: rendered.subject, campaignId: meta.campaignId, sequenceId: meta.sequenceId, templateId: template.id });
  pushTimeline(lead, { at: meta.at, channel: "email", kind: "delivered", summary: `Delivered: ${rendered.subject}`, campaignId: meta.campaignId, sequenceId: meta.sequenceId, templateId: template.id });
  if (lead.stage === "New") setStage(lead, "Contacted", meta.at);
  return "sent";
}

export function campaignStats(state: GrowthState, campaignId: string) {
  const events = state.leads.flatMap((lead) => lead.timeline.filter((event) => event.campaignId === campaignId));
  const count = (kind: TimelineEvent["kind"]) => events.filter((event) => event.kind === kind).length;
  const people = new Set(state.leads.filter((lead) => lead.timeline.some((event) => event.campaignId === campaignId && event.kind === "sent")).map((lead) => lead.id));
  const signedUp = state.leads.filter((lead) => people.has(lead.id) && STAGE_INDEX[lead.stage] >= STAGE_INDEX["Signed up"] && lead.stage !== "Lost").length;
  const paid = state.leads.filter((lead) => people.has(lead.id) && lead.stage === "Paid").length;
  return { sent: count("sent"), delivered: count("delivered"), opened: count("opened"), clicked: count("clicked"), replied: count("replied"), signedUp, paid };
}

export function refreshEnrollmentStops(state: GrowthState, at: string): void {
  for (const enrollment of state.enrollments) {
    if (enrollment.status !== "active") continue;
    const sequence = state.sequences.find((item) => item.id === enrollment.sequenceId);
    const lead = state.leads.find((item) => item.id === enrollment.leadId);
    if (!sequence || !lead) continue;
    const reason = stopReason(sequence, lead, enrollment.enrolledAt);
    if (reason) {
      enrollment.status = "stopped";
      enrollment.stopReason = reason;
      pushTimeline(lead, { at, channel: "email", kind: "system", summary: `Sequence stopped: ${reason}`, sequenceId: sequence.id });
    }
  }
}

function stopReason(sequence: Sequence, lead: Lead, enrolledAt: string): string | null {
  if (sequence.stopOnUnsubscribe && lead.dnc.email) return "unsubscribed";
  if (sequence.stopOnPaid && lead.stage === "Paid") return "paid";
  if (sequence.stopOnSignup && STAGE_INDEX[lead.stage] >= STAGE_INDEX["Signed up"] && lead.stage !== "Lost") return "signed up";
  if (sequence.stopOnReply && repliedAfter(lead, enrolledAt)) return "replied";
  return null;
}

export function repliedAfter(lead: Lead, since: string): boolean {
  return lead.timeline.some((event) => event.kind === "replied" && event.at >= since);
}

export function runDue(state: GrowthState, now: number, origin: string): boolean {
  rollDay(state.caps, now);
  const at = new Date(now).toISOString();
  let changed = false;
  for (const campaign of state.campaigns) {
    if (campaign.status !== "scheduled" || !campaign.scheduledFor) continue;
    if (new Date(campaign.scheduledFor).getTime() > now) continue;
    sendCampaign(state, campaign, origin, at);
    changed = true;
  }
  refreshEnrollmentStops(state, at);
  for (const enrollment of state.enrollments) {
    if (enrollment.status !== "active") continue;
    if (new Date(enrollment.nextAt).getTime() > now) continue;
    const sequence = state.sequences.find((item) => item.id === enrollment.sequenceId);
    const lead = state.leads.find((item) => item.id === enrollment.leadId);
    if (!sequence || !lead || sequence.paused) continue;
    const step = sequence.steps[enrollment.stepIndex];
    const template = step ? state.templates.find((item) => item.id === step.templateId) : undefined;
    if (!template) {
      enrollment.status = "stopped";
      enrollment.stopReason = "completed";
      changed = true;
      continue;
    }
    const result = sendEmail(state, lead, template, { sequenceId: sequence.id, at, origin });
    if (result === "capped") break;
    changed = true;
    if (result === "sent") {
      enrollment.stepIndex += 1;
      const upcoming = sequence.steps[enrollment.stepIndex];
      if (!upcoming) {
        enrollment.status = "stopped";
        enrollment.stopReason = "completed";
      } else {
        enrollment.nextAt = new Date(now + upcoming.waitDays * DAY).toISOString();
      }
    } else {
      enrollment.status = "stopped";
      enrollment.stopReason = "do-not-contact";
    }
  }
  for (const trigger of state.triggers) {
    for (const lead of state.leads) {
      const key = `${trigger.id}:${lead.id}`;
      if (trigger.fired.includes(key)) continue;
      if (!triggerReady(lead, trigger.event, trigger.waitHours, now)) continue;
      const template = state.templates.find((item) => item.id === trigger.templateId);
      if (!template) continue;
      if (trigger.channel === "whatsapp") {
        if (!lead.whatsappOptIn || !canContact(lead, "whatsapp")) {
          trigger.fired.push(key);
          changed = true;
          continue;
        }
        const thread = state.threads.find((item) => item.leadId === lead.id);
        const text = renderTemplate(template, lead, origin).body;
        thread?.messages.push({ id: uid("wa"), at, from: "agent", text });
        pushTimeline(lead, { at, channel: "whatsapp", kind: "sent", summary: text, templateId: template.id });
      } else {
        const result = sendEmail(state, lead, template, { at, origin });
        if (result === "capped") break;
      }
      trigger.fired.push(key);
      changed = true;
    }
  }
  return changed;
}

function triggerReady(lead: Lead, event: GrowthState["triggers"][number]["event"], waitHours: number, now: number): boolean {
  const wait = waitHours * 3_600_000;
  if (event === "report_viewed_no_signup") {
    if (!lead.audit?.viewedAt || lead.audit.status === "Claimed") return false;
    if (STAGE_INDEX[lead.stage] >= STAGE_INDEX["Signed up"] && lead.stage !== "Lost") return false;
    return now - new Date(lead.audit.viewedAt).getTime() >= wait;
  }
  if (event === "signup_no_audit") {
    const signed = lead.history.find((mark) => mark.stage === "Signed up");
    if (!signed || lead.signal.auditsRun > 0) return false;
    return now - new Date(signed.at).getTime() >= wait;
  }
  const started = lead.history.find((mark) => mark.stage === "Checkout started");
  if (!started || lead.stage === "Paid" || lead.stage === "Lost") return false;
  return lead.stage === "Checkout started" && now - new Date(started.at).getTime() >= wait;
}

export function sendCampaign(state: GrowthState, campaign: Campaign, origin: string, at: string): { sent: number; blocked: number; capped: boolean } {
  const template = state.templates.find((item) => item.id === campaign.templateId);
  const leads = segmentLeads(state, campaign.segmentId, new Date(at).getTime());
  let sent = 0;
  let blocked = 0;
  let capped = false;
  if (template) {
    for (const lead of leads) {
      const result = sendEmail(state, lead, template, { campaignId: campaign.id, at, origin });
      if (result === "sent") sent += 1;
      else if (result === "blocked") blocked += 1;
      else {
        capped = true;
        break;
      }
    }
  }
  campaign.status = "sent";
  campaign.scheduledFor = undefined;
  return { sent, blocked, capped };
}

export function reached(lead: Lead, stage: Stage): boolean {
  if (stage === "Lost") return lead.stage === "Lost";
  return lead.history.some((mark) => mark.stage !== "Lost" && STAGE_INDEX[mark.stage] >= STAGE_INDEX[stage]);
}

export const FUNNEL: Array<{ key: Stage | "leads"; label: string }> = [
  { key: "leads", label: "Leads" },
  { key: "Contacted", label: "Contacted" },
  { key: "Replied", label: "Replied" },
  { key: "Signed up", label: "Signed up" },
  { key: "Audit run", label: "First audit" },
  { key: "Paid", label: "Paid" },
];

export function funnelCounts(leads: Lead[]): number[] {
  return FUNNEL.map((step) => {
    const key = step.key;
    if (key === "leads") return leads.length;
    return leads.filter((lead) => reached(lead, key)).length;
  });
}

export type TouchChannel = Channel | "Direct";

export function touches(lead: Lead): TimelineEvent[] {
  return [...lead.timeline].reverse().filter((event) => event.kind === "sent" && (event.channel === "email" || event.channel === "whatsapp" || event.channel === "linkedin"));
}

export function lastTouch(lead: Lead): TouchChannel {
  const paidAt = lead.history.find((mark) => mark.stage === "Paid")?.at ?? lead.history.find((mark) => mark.stage === "Signed up")?.at;
  const list = touches(lead).filter((event) => !paidAt || event.at <= paidAt);
  const last = list[list.length - 1];
  if (!last || (last.channel !== "email" && last.channel !== "whatsapp" && last.channel !== "linkedin")) return "Direct";
  return last.channel;
}

export function inDateRange(iso: string, from: string, to: string): boolean {
  const day = iso.slice(0, 10);
  if (from && day < from) return false;
  if (to && day > to) return false;
  return true;
}

export function queueAudits(state: GrowthState, leadIds: string[], at: string): { queued: number; held: number; skipped: number; message: string } {
  rollDay(state.caps, new Date(at).getTime());
  let queued = 0;
  let held = 0;
  let skipped = 0;
  for (const id of leadIds) {
    const lead = state.leads.find((item) => item.id === id);
    if (!lead || lead.audit) {
      skipped += 1;
      continue;
    }
    if (state.caps.auditsUsed >= state.caps.auditCap) {
      return { queued, held, skipped: skipped + (leadIds.length - leadIds.indexOf(id)), message: `Daily audit cap of ${state.caps.auditCap} reached. ${queued} queued, the rest were left.` };
    }
    state.caps.auditsUsed += 1;
    const unreadable = lead.website.includes("unreadable");
    lead.audit = {
      status: unreadable ? "Held" : "Ready",
      tier: "Fast",
      aio: unreadable ? null : 40 + (lead.company.length % 45),
      seo: unreadable ? null : 35 + (lead.email.length % 40),
      topProblem: unreadable ? "Site could not be read" : "Pages are missing a clear answer for the questions buyers ask",
      fixes: unreadable ? [] : ["Add a direct answer block on the homepage", "Name the service in the title", "Show proof near the main claim", "Tighten internal links to the offer", "Publish one comparison page", "Add author and updated date"],
      lockedCount: 8,
      unreadable,
      token: uid("rpt"),
    };
    if (unreadable) {
      lead.manualCheck = true;
      lead.audit.status = "Held";
      held += 1;
      pushTimeline(lead, { at, channel: "audit", kind: "audit", summary: "Prospect audit held — site could not be read. Flagged for a manual check." });
    } else {
      queued += 1;
      pushTimeline(lead, { at, channel: "audit", kind: "audit", summary: `Fast audit ready · AIO ${lead.audit.aio} · SEO ${lead.audit.seo}` });
    }
  }
  return { queued, held, skipped, message: held ? `${queued} ready, ${held} held for a manual check.` : `${queued} audits ready.` };
}

export function activeSequenceId(state: GrowthState, leadId: string, except?: string): string | null {
  const row = state.enrollments.find((item) => item.leadId === leadId && item.status === "active" && item.sequenceId !== except);
  return row?.sequenceId ?? null;
}
