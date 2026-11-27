"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { todayKey, uid } from "@/lib/format";
import { activeSequenceId, applySignalEvent, findDuplicate, queueAudits, refreshEnrollmentStops, renderTemplate, runDue, sendCampaign, setStage } from "./engine";
import { createSeed } from "./seed";
import type { Channel, EmailTemplate, GrowthState, Lead, LeadQuery, SignalEvent, Stage } from "./types";

const KEY = "qiko.signal.growth.v2";
let state: GrowthState | null = null;
const listeners = new Set<() => void>();

function persist(next: GrowthState) {
  state = next;
  if (typeof window !== "undefined") localStorage.setItem(KEY, JSON.stringify(next));
  listeners.forEach((listener) => listener());
}

function ensure(): GrowthState {
  if (state) return state;
  if (typeof window === "undefined") return createSeed();
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as GrowthState;
      if (parsed.version === 1 && Array.isArray(parsed.leads)) {
        state = parsed;
        return parsed;
      }
    }
  } catch {
    /* reseed */
  }
  const seeded = createSeed();
  state = seeded;
  localStorage.setItem(KEY, JSON.stringify(seeded));
  return seeded;
}

function commit(mutator: (draft: GrowthState) => void): GrowthState {
  const next = structuredClone(ensure());
  mutator(next);
  persist(next);
  return next;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useGrowth(): GrowthState | null {
  const live = useSyncExternalStore(subscribe, ensure, () => null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted ? live : null;
}

export function resetGrowth() {
  persist(createSeed());
  flushDue();
}

export function flushDue(origin = typeof window === "undefined" ? "" : window.location.origin) {
  const current = ensure();
  const next = structuredClone(current);
  const changed = runDue(next, Date.now(), origin);
  if (changed) persist(next);
}

function blankSignal(): Lead["signal"] {
  return { linked: false, plan: "None", auditsRun: 0, aio: null, seo: null, lastLogin: null, lastAuditAt: null, checkout: "none", linkedAt: null };
}

export interface ImportResult {
  imported: number;
  skipped: number;
  message: string;
}

export const growth = {
  addLead(input: { firstName: string; lastName: string; email: string; company: string; website: string; country: string; industry: string; title: string; ownerId: string | null; source: Lead["source"] }): ImportResult {
    let result: ImportResult = { imported: 0, skipped: 0, message: "" };
    commit((draft) => {
      const duplicate = findDuplicate(draft.leads, input.email, input.website);
      if (duplicate) {
        result = { imported: 0, skipped: 1, message: `Already in the CRM as ${duplicate.firstName} ${duplicate.lastName}. No second lead was created.` };
        return;
      }
      const at = new Date().toISOString();
      draft.leads.unshift({
        id: uid("ld"),
        ...input,
        email: input.email.trim().toLowerCase(),
        apolloSearch: input.source === "Apollo" ? "Manual Apollo add" : undefined,
        stage: "New",
        plan: "None",
        tags: [],
        notes: [],
        tasks: [],
        dnc: { email: false, whatsapp: false, linkedin: false },
        manualCheck: false,
        whatsappOptIn: false,
        signal: blankSignal(),
        audit: null,
        history: [{ stage: "New", at }],
        timeline: [],
        createdAt: at,
      });
      result = { imported: 1, skipped: 0, message: "Lead added." };
    });
    return result;
  },

  importCsv(text: string, ownerId: string | null): ImportResult {
    const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    const rows = lines.filter((line) => !/^first/i.test(line));
    let imported = 0;
    let skipped = 0;
    commit((draft) => {
      for (const line of rows) {
        const [firstName, lastName, email, company, website, country, industry, title] = line.split(",").map((cell) => cell.trim());
        if (!email || !firstName) {
          skipped += 1;
          continue;
        }
        if (findDuplicate(draft.leads, email, website ?? "")) {
          skipped += 1;
          continue;
        }
        const at = new Date().toISOString();
        draft.leads.unshift({
          id: uid("ld"),
          firstName,
          lastName: lastName || "",
          email: email.toLowerCase(),
          company: company || "",
          website: website || "",
          country: country || "",
          industry: industry || "",
          title: title || "",
          source: "CSV",
          ownerId,
          stage: "New",
          plan: "None",
          tags: [],
          notes: [],
          tasks: [],
          dnc: { email: false, whatsapp: false, linkedin: false },
          manualCheck: false,
          whatsappOptIn: false,
          signal: blankSignal(),
          audit: null,
          history: [{ stage: "New", at }],
          timeline: [],
          createdAt: at,
        });
        imported += 1;
      }
    });
    return { imported, skipped, message: `${imported} imported, ${skipped} skipped as duplicates or incomplete rows.` };
  },

  importApollo(ids: string[], ownerId: string | null, segmentId: string, queueAudit: boolean): ImportResult {
    let result: ImportResult = { imported: 0, skipped: 0, message: "" };
    commit((draft) => {
      const segment = draft.segments.find((item) => item.id === segmentId);
      let imported = 0;
      let skipped = 0;
      let credits = 0;
      let stopped = false;
      for (const id of ids) {
        const person = draft.apolloCatalog.find((item) => item.id === id);
        if (!person) continue;
        if (!person.verified || !person.hasWebsite || !person.website) {
          skipped += 1;
          continue;
        }
        if (draft.caps.apolloUsed >= draft.caps.apolloCap) {
          stopped = true;
          break;
        }
        if (findDuplicate(draft.leads, person.email, person.website)) {
          skipped += 1;
          continue;
        }
        draft.caps.apolloUsed += 1;
        credits += 1;
        imported += 1;
        const at = new Date().toISOString();
        const leadId = uid("ld");
        draft.leads.unshift({
          id: leadId,
          firstName: person.firstName,
          lastName: person.lastName,
          email: person.email.toLowerCase(),
          company: person.company,
          website: person.website,
          country: person.country,
          industry: person.industry,
          title: person.title,
          source: "Apollo",
          apolloSearch: "Heads of marketing · e-commerce · UAE",
          ownerId,
          stage: "New",
          plan: "None",
          tags: segment ? [segment.name] : [],
          notes: [],
          tasks: [],
          dnc: { email: false, whatsapp: false, linkedin: false },
          manualCheck: false,
          whatsappOptIn: false,
          signal: blankSignal(),
          audit: null,
          history: [{ stage: "New", at }],
          timeline: [],
          createdAt: at,
        });
        if (queueAudit) queueAudits(draft, [leadId], at);
      }
      draft.apolloImports.unshift({ id: uid("im"), at: new Date().toISOString(), search: "Heads of marketing · e-commerce · UAE", imported, skipped, credits });
      result = {
        imported,
        skipped,
        message: stopped ? `Stopped at the daily credit cap of ${draft.caps.apolloCap}. ${imported} imported, ${skipped} skipped.` : `${imported} imported, ${skipped} skipped (duplicates or missing a verified email and website).`,
      };
    });
    return result;
  },

  setStage(leadId: string, stage: Stage, lostReason?: string) {
    commit((draft) => {
      const lead = draft.leads.find((item) => item.id === leadId);
      if (!lead) return;
      setStage(lead, stage, new Date().toISOString(), lostReason);
      refreshEnrollmentStops(draft, new Date().toISOString());
    });
  },

  setOwner(leadId: string, ownerId: string | null) {
    commit((draft) => {
      const lead = draft.leads.find((item) => item.id === leadId);
      if (lead) lead.ownerId = ownerId;
    });
  },

  setDnc(leadId: string, channel: Channel, value: boolean) {
    commit((draft) => {
      const lead = draft.leads.find((item) => item.id === leadId);
      if (!lead) return;
      lead.dnc[channel] = value;
      if (value) refreshEnrollmentStops(draft, new Date().toISOString());
    });
  },

  addNote(leadId: string, text: string, author: string) {
    commit((draft) => {
      const lead = draft.leads.find((item) => item.id === leadId);
      if (!lead || !text.trim()) return;
      const at = new Date().toISOString();
      lead.notes.unshift({ id: uid("nt"), text: text.trim(), at, author });
      lead.timeline.unshift({ id: uid("ev"), at, channel: "note", kind: "note", summary: text.trim() });
    });
  },

  addTask(leadId: string, text: string, due: string) {
    commit((draft) => {
      const lead = draft.leads.find((item) => item.id === leadId);
      if (!lead || !text.trim()) return;
      lead.tasks.unshift({ id: uid("tk"), text: text.trim(), due, done: false });
    });
  },

  toggleTask(leadId: string, taskId: string) {
    commit((draft) => {
      const task = draft.leads.find((item) => item.id === leadId)?.tasks.find((item) => item.id === taskId);
      if (task) task.done = !task.done;
    });
  },

  signal(leadId: string, event: SignalEvent) {
    commit((draft) => {
      const lead = draft.leads.find((item) => item.id === leadId);
      if (!lead) return;
      applySignalEvent(lead, event, new Date().toISOString());
      refreshEnrollmentStops(draft, new Date().toISOString());
    });
  },

  saveSegment(name: string, filter: LeadQuery) {
    commit((draft) => {
      draft.segments.push({ id: uid("sg"), name: name.trim(), filter });
    });
  },

  runAudits(leadIds: string[]) {
    let message = "";
    commit((draft) => {
      message = queueAudits(draft, leadIds, new Date().toISOString()).message;
    });
    return message;
  },

  sendAudit(leadId: string) {
    let message = "Report sent.";
    commit((draft) => {
      const lead = draft.leads.find((item) => item.id === leadId);
      if (!lead?.audit) return;
      if (lead.audit.unreadable || lead.audit.status === "Held") {
        lead.manualCheck = true;
        message = "Held reports are never sent. This lead stays flagged for a manual check.";
        return;
      }
      if (!lead.dnc.email) {
        const at = new Date().toISOString();
        lead.audit.status = "Sent";
        lead.audit.sentAt = at;
        lead.timeline.unshift({ id: uid("ev"), at, channel: "email", kind: "sent", summary: `Prospect report sent · ${lead.audit.topProblem}` });
        if (lead.stage === "New") setStage(lead, "Contacted", at);
      } else message = "This lead is do-not-contact for email, so the report was not sent.";
    });
    return message;
  },

  markViewed(token: string) {
    commit((draft) => {
      const lead = draft.leads.find((item) => item.audit?.token === token);
      if (!lead?.audit || lead.audit.unreadable) return;
      if (lead.audit.status === "Claimed") return;
      const at = new Date().toISOString();
      if (!lead.audit.viewedAt) {
        lead.audit.viewedAt = at;
        lead.audit.status = "Viewed";
        lead.timeline.unshift({ id: uid("ev"), at, channel: "audit", kind: "opened", summary: "Opened the private report link" });
      }
    });
  },

  claimReport(token: string) {
    let message = "This report link is not active.";
    commit((draft) => {
      const lead = draft.leads.find((item) => item.audit?.token === token);
      if (!lead?.audit || lead.audit.unreadable) {
        message = "This report was held and is not available to claim.";
        return;
      }
      const at = new Date().toISOString();
      const already = lead.signal.auditsRun;
      lead.audit.status = "Claimed";
      lead.audit.claimedAt = lead.audit.claimedAt ?? at;
      lead.signal.linked = true;
      lead.signal.linkedAt = lead.signal.linkedAt ?? at;
      lead.signal.plan = lead.signal.plan === "None" ? "Free" : lead.signal.plan;
      lead.plan = lead.signal.plan;
      lead.signal.aio = lead.audit.aio;
      lead.signal.seo = lead.audit.seo;
      lead.signal.auditsRun = Math.max(already, 1);
      lead.signal.lastAuditAt = lead.audit.sentAt ?? at;
      if (["New", "Contacted", "Replied"].includes(lead.stage)) setStage(lead, "Signed up", at);
      lead.timeline.unshift({ id: uid("ev"), at, channel: "signal", kind: "signal", summary: "Claimed the prospect report. No new audit was run." });
      refreshEnrollmentStops(draft, at);
      message = "The report is on the new Signal account. No new audit was run.";
    });
    return message;
  },

  downloadAudit(leadId: string) {
    commit((draft) => {
      const lead = draft.leads.find((item) => item.id === leadId);
      if (!lead) return;
      lead.timeline.unshift({ id: uid("ev"), at: new Date().toISOString(), channel: "audit", kind: "clicked", summary: "Downloaded the report PDF" });
    });
  },

  sendCampaign(campaignId: string, origin: string) {
    let message = "Campaign sent.";
    commit((draft) => {
      const campaign = draft.campaigns.find((item) => item.id === campaignId);
      if (!campaign) return;
      const result = sendCampaign(draft, campaign, origin, new Date().toISOString());
      message = result.held
        ? "This template is paused, so nothing was sent."
        : result.capped
          ? `Sent ${result.sent}, then the daily send limit stopped the rest. ${result.blocked} were do-not-contact.`
          : `Sent ${result.sent}. ${result.blocked} do-not-contact leads were left out.`;
    });
    return message;
  },

  scheduleCampaign(input: { name: string; templateId: string; segmentId: string; scheduledFor: string }) {
    let id = "";
    commit((draft) => {
      id = uid("cp");
      draft.campaigns.unshift({ id, name: input.name, templateId: input.templateId, segmentId: input.segmentId, status: input.scheduledFor ? "scheduled" : "draft", scheduledFor: input.scheduledFor || undefined, timezoneNote: "Recipient local time" });
    });
    return id;
  },

  updateCampaign(id: string, input: { name: string; templateId: string; segmentId: string; scheduledFor: string }) {
    commit((draft) => {
      const campaign = draft.campaigns.find((item) => item.id === id);
      if (!campaign || campaign.status === "sent") return;
      campaign.name = input.name;
      campaign.templateId = input.templateId;
      campaign.segmentId = input.segmentId;
      campaign.scheduledFor = input.scheduledFor || undefined;
      campaign.status = input.scheduledFor ? "scheduled" : "draft";
    });
  },

  sendTest(templateId: string, origin: string) {
    const template = ensure().templates.find((item) => item.id === templateId);
    const sample = ensure().leads[0];
    if (!template || !sample) return "Add a template first.";
    const rendered = renderTemplate(template, sample, origin);
    return `Test to you: ${rendered.subject}`;
  },

  saveTemplate(input: { id?: string; name: string; subject: string; body: string; offerEnd: string; category?: EmailTemplate["category"] }) {
    let id = input.id ?? "";
    commit((draft) => {
      const fallbacks = { firstName: "there", company: "your team", site: "your site", aio: "your AIO score", seo: "your SEO score", topProblem: "the main issue we found", reportLink: "your private report link", offerEnd: input.offerEnd || "soon" };
      if (input.id) {
        const existing = draft.templates.find((item) => item.id === input.id);
        if (existing) {
          Object.assign(existing, { name: input.name, subject: input.subject, body: input.body, offerEnd: input.offerEnd, fallbacks, category: input.category });
          id = existing.id;
        }
        return;
      }
      id = uid("tm");
      draft.templates.unshift({ id, name: input.name, subject: input.subject, body: input.body, offerEnd: input.offerEnd, fallbacks, category: input.category });
    });
    return id;
  },

  setTemplatePaused(id: string, paused: boolean) {
    commit((draft) => {
      const template = draft.templates.find((item) => item.id === id);
      if (template) template.paused = paused;
    });
  },

  deleteTemplate(id: string) {
    commit((draft) => {
      draft.templates = draft.templates.filter((item) => item.id !== id);
      for (const sequence of draft.sequences) {
        for (const enrollment of draft.enrollments) {
          if (enrollment.sequenceId !== sequence.id || enrollment.status !== "active") continue;
          const removedBefore = sequence.steps.slice(0, enrollment.stepIndex).filter((step) => step.templateId === id).length;
          enrollment.stepIndex = Math.max(0, enrollment.stepIndex - removedBefore);
        }
        sequence.steps = sequence.steps.filter((step) => step.templateId !== id);
        for (const enrollment of draft.enrollments) {
          if (enrollment.sequenceId !== sequence.id || enrollment.status !== "active") continue;
          if (enrollment.stepIndex >= sequence.steps.length) {
            enrollment.status = "stopped";
            enrollment.stopReason = "completed";
          }
        }
      }
    });
  },

  enrol(sequenceId: string, leadIds: string[]) {
    let message = "";
    commit((draft) => {
      const sequence = draft.sequences.find((item) => item.id === sequenceId);
      if (!sequence) return;
      let enrolled = 0;
      let skipped = 0;
      const at = new Date().toISOString();
      for (const leadId of leadIds) {
        const lead = draft.leads.find((item) => item.id === leadId);
        if (!lead || !lead.dnc || lead.dnc.email) {
          skipped += 1;
          continue;
        }
        const other = activeSequenceId(draft, leadId, sequence.allowOverlap ? sequenceId : undefined);
        if (other && !sequence.allowOverlap) {
          skipped += 1;
          continue;
        }
        if (draft.enrollments.some((item) => item.leadId === leadId && item.sequenceId === sequenceId && item.status === "active")) {
          skipped += 1;
          continue;
        }
        const wait = sequence.steps[0]?.waitDays ?? 0;
        draft.enrollments.push({ id: uid("en"), sequenceId, leadId, stepIndex: 0, enrolledAt: at, nextAt: new Date(Date.now() + wait * 86_400_000).toISOString(), status: "active" });
        enrolled += 1;
      }
      refreshEnrollmentStops(draft, at);
      message = `${enrolled} enrolled. ${skipped} skipped (do-not-contact, or already in a sequence).`;
    });
    return message;
  },

  setAllowOverlap(sequenceId: string, allow: boolean) {
    commit((draft) => {
      const sequence = draft.sequences.find((item) => item.id === sequenceId);
      if (sequence) sequence.allowOverlap = allow;
    });
  },

  updateSequence(id: string, input: { name: string; steps: { templateId: string; waitDays: number }[]; stopOnReply: boolean; stopOnSignup: boolean; stopOnPaid: boolean; stopOnUnsubscribe: boolean; allowOverlap: boolean }) {
    let ok = false;
    commit((draft) => {
      const sequence = draft.sequences.find((item) => item.id === id);
      if (!sequence) return;
      const steps = input.steps
        .filter((step) => draft.templates.some((item) => item.id === step.templateId))
        .map((step) => ({ templateId: step.templateId, waitDays: Math.max(0, Math.round(step.waitDays) || 0) }));
      if (!steps.length) return;
      sequence.name = input.name.trim() || "Untitled sequence";
      sequence.steps = steps;
      sequence.stopOnReply = input.stopOnReply;
      sequence.stopOnSignup = input.stopOnSignup;
      sequence.stopOnPaid = input.stopOnPaid;
      sequence.stopOnUnsubscribe = input.stopOnUnsubscribe;
      sequence.allowOverlap = input.allowOverlap;
      ok = true;
    });
    return ok;
  },

  setSequencePaused(id: string, paused: boolean) {
    commit((draft) => {
      const sequence = draft.sequences.find((item) => item.id === id);
      if (sequence) sequence.paused = paused;
    });
  },

  createSequence(input: { name: string; steps: { templateId: string; waitDays: number }[]; stopOnReply: boolean; stopOnSignup: boolean; stopOnPaid: boolean; stopOnUnsubscribe: boolean; allowOverlap: boolean }) {
    let id = "";
    commit((draft) => {
      const steps = input.steps
        .filter((step) => draft.templates.some((item) => item.id === step.templateId))
        .map((step) => ({ templateId: step.templateId, waitDays: Math.max(0, Math.round(step.waitDays) || 0) }));
      if (!steps.length) return;
      id = uid("sq");
      draft.sequences.push({
        id,
        name: input.name.trim() || "Untitled sequence",
        steps,
        stopOnReply: input.stopOnReply,
        stopOnSignup: input.stopOnSignup,
        stopOnPaid: input.stopOnPaid,
        stopOnUnsubscribe: input.stopOnUnsubscribe,
        allowOverlap: input.allowOverlap,
      });
    });
    return id;
  },

  reply(leadId: string, channel: Channel, text: string) {
    commit((draft) => {
      const lead = draft.leads.find((item) => item.id === leadId);
      if (!lead) return;
      const at = new Date().toISOString();
      lead.timeline.unshift({ id: uid("ev"), at, channel, kind: "replied", summary: text });
      if (lead.stage === "New" || lead.stage === "Contacted") setStage(lead, "Replied", at);
      if (channel === "whatsapp" && /^\s*stop\s*$/i.test(text)) {
        lead.dnc.whatsapp = true;
        lead.timeline.unshift({ id: uid("ev"), at, channel: "whatsapp", kind: "system", summary: "STOP received. Do-not-contact set for WhatsApp." });
      }
      refreshEnrollmentStops(draft, at);
    });
  },

  sendWhatsApp(leadIds: string[], templateId: string, origin: string) {
    let message = "";
    commit((draft) => {
      const template = draft.whatsappTemplates.find((item) => item.id === templateId);
      if (!template || template.meta !== "Approved") {
        message = "Only an approved template can be sent.";
        return;
      }
      const emailTemplate = { id: template.id, name: template.name, subject: template.name, body: template.body, fallbacks: { firstName: "there", company: "your team" }, offerEnd: "" };
      let sent = 0;
      let skipped = 0;
      const at = new Date().toISOString();
      for (const leadId of leadIds) {
        const lead = draft.leads.find((item) => item.id === leadId);
        if (!lead || !lead.whatsappOptIn || lead.dnc.whatsapp) {
          skipped += 1;
          continue;
        }
        const text = renderTemplate(emailTemplate, lead, origin).body;
        let thread = draft.threads.find((item) => item.leadId === leadId);
        if (!thread) {
          thread = { leadId, aiPaused: false, messages: [] };
          draft.threads.push(thread);
        }
        thread.messages.push({ id: uid("wa"), at, from: "agent", text });
        lead.timeline.unshift({ id: uid("ev"), at, channel: "whatsapp", kind: "sent", summary: text, templateId: template.id });
        if (lead.stage === "New") setStage(lead, "Contacted", at);
        sent += 1;
      }
      message = `Sent ${sent}. ${skipped} had no opt-in or were do-not-contact.`;
    });
    return message;
  },

  inboundWhatsApp(leadId: string, text: string) {
    commit((draft) => {
      const lead = draft.leads.find((item) => item.id === leadId);
      const thread = draft.threads.find((item) => item.leadId === leadId);
      if (!lead || !thread) return;
      const at = new Date().toISOString();
      thread.messages.push({ id: uid("wa"), at, from: "lead", text });
      lead.timeline.unshift({ id: uid("ev"), at, channel: "whatsapp", kind: "replied", summary: text });
      if (/^\s*stop\s*$/i.test(text)) {
        lead.dnc.whatsapp = true;
        thread.messages.push({ id: uid("wa"), at, from: "agent", text: "You will not get more WhatsApp messages from Qiko." });
        return;
      }
      if (!thread.aiPaused) {
        const answer = `I can help with plans and the ${lead.company} report. Pro unlocks the locked fixes. I will not invent a discount. Say "person" if you want Ed.`;
        thread.messages.push({ id: uid("wa"), at, from: "agent", text: answer });
        lead.timeline.unshift({ id: uid("ev"), at, channel: "whatsapp", kind: "sent", summary: answer });
      }
      if (lead.stage === "New" || lead.stage === "Contacted") setStage(lead, "Replied", at);
      refreshEnrollmentStops(draft, at);
    });
  },

  takeOver(leadId: string, paused: boolean) {
    commit((draft) => {
      const thread = draft.threads.find((item) => item.leadId === leadId);
      if (thread) thread.aiPaused = paused;
    });
  },

  humanWhatsApp(leadId: string, text: string) {
    commit((draft) => {
      const lead = draft.leads.find((item) => item.id === leadId);
      const thread = draft.threads.find((item) => item.leadId === leadId);
      if (!lead || !thread || !text.trim()) return;
      if (!lead.whatsappOptIn || lead.dnc.whatsapp) return;
      const at = new Date().toISOString();
      thread.messages.push({ id: uid("wa"), at, from: "human", text: text.trim() });
      lead.timeline.unshift({ id: uid("ev"), at, channel: "whatsapp", kind: "sent", summary: text.trim() });
    });
  },

  sendLinkedIn(itemId: string) {
    let message = "Sent.";
    commit((draft) => {
      const item = draft.linkedinQueue.find((row) => row.id === itemId);
      const account = draft.linkedinAccounts.find((row) => row.id === item?.accountId);
      const lead = draft.leads.find((row) => row.id === item?.leadId);
      if (!item || !account || !lead || item.status === "sent") return;
      if (account.dayKey !== todayKey()) {
        account.dayKey = todayKey();
        account.sentToday = 0;
      }
      if (account.sentToday >= account.dailyLimit) {
        message = `${account.name} is at the daily limit of ${account.dailyLimit}. Nothing else was sent.`;
        return;
      }
      if (lead.dnc.linkedin) {
        message = "This lead is do-not-contact for LinkedIn.";
        return;
      }
      account.sentToday += 1;
      item.status = "sent";
      const at = new Date().toISOString();
      lead.timeline.unshift({ id: uid("ev"), at, channel: "linkedin", kind: "sent", summary: item.text });
      if (lead.stage === "New") setStage(lead, "Contacted", at);
    });
    return message;
  },

  setAuditCap(cap: number) {
    commit((draft) => {
      draft.caps.auditCap = Math.max(0, cap);
    });
  },

  setEmailLimit(limit: number) {
    commit((draft) => {
      draft.caps.emailLimit = Math.max(0, limit);
    });
  },
};

export function previewTemplate(templateId: string, leadId: string, origin: string) {
  const current = ensure();
  const template = current.templates.find((item) => item.id === templateId);
  const lead = current.leads.find((item) => item.id === leadId);
  if (!template || !lead) return null;
  return renderTemplate(template, lead, origin);
}
