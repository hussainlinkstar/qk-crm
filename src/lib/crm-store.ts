"use client";

// Client-side CRM store backed by localStorage. All mutations go through `crm.*` actions,
// which keeps screens independent of where data lives (demo provider today, API later).

import { useSyncExternalStore } from "react";
import { createDemoState, DATA_VERSION, demoMessages } from "@/data/demo-seed";
import { createTessiantSlice } from "@/data/tessiant-seed";
import { createDomainEvent } from "./pulse-adapter";
import { associateCommittedCapacity, availabilityFromCapacity, enrichAssignmentDefaults } from "./assignments";
import { matchAssociateToRequirement, rankMatches } from "./tessiant-matching";
import { ensureTalentProfile } from "./talent-network";
import { adaptLeadRecord, normalizeLeadStatus, stageProbability } from "./sales-crm";
import type {
  ActivityEvent,
  Contact,
  ConversationChannel,
  CrmState,
  Lead,
  LeadStatus,
  Member,
  Opportunity,
  OpportunityStage,
  OpportunityType,
  Priority,
  Session,
  Suggestion,
  Task,
  TaskStatus,
} from "./types";
import type {
  Associate,
  AssociateActivityNote,
  AssociateDocument,
  AssignmentNote,
  AssignmentStatus,
  ClientRequirement,
  MoneyRate,
  Placement,
  RequirementCandidate,
  RequirementOutcome,
  RequirementStage,
  ShortlistStatus,
  TessiantStateSlice,
} from "./tessiant-types";
import { addDays, todayKey, uid } from "./format";

const STORAGE_KEY = "qiko-core-crm";
const SESSION_KEY = "qiko-core-session";

let state: CrmState | null = null;
let session: Session | null | undefined;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) {
      state = null;
      listener();
    }
    if (event.key === SESSION_KEY) {
      session = undefined;
      listener();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

// — Session ———————————————————————————————————————————————

function readSession(): Session | null {
  if (session !== undefined) return session;
  try {
    const raw = window.sessionStorage.getItem(SESSION_KEY) ?? window.localStorage.getItem(SESSION_KEY);
    session = raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    session = null;
  }
  return session;
}

export function useSession(): Session | null | undefined {
  return useSyncExternalStore(subscribe, readSession, () => undefined);
}

export function signIn(email: string, remember: boolean): Session {
  const local = email.split("@")[0].split("+")[0].replace(/[._-]+/g, " ").trim();
  const name = local ? local.replace(/\b\w/g, (char) => char.toUpperCase()) : "Ed";
  const existing = readCrm();
  const known = existing?.members.find((member) => member.id === "me" && member.email === email);
  const next: Session = { userId: "me", name: known?.name ?? name, email, signedInAt: new Date().toISOString(), remember };
  const storage = remember ? window.localStorage : window.sessionStorage;
  (remember ? window.sessionStorage : window.localStorage).removeItem(SESSION_KEY);
  storage.setItem(SESSION_KEY, JSON.stringify(next));
  session = next;
  if (!existing || existing.members.find((member) => member.id === "me")?.email !== email) {
    write(createDemoState({ name: next.name, email }));
  }
  emit();
  return next;
}

export function signOut() {
  window.localStorage.removeItem(SESSION_KEY);
  window.sessionStorage.removeItem(SESSION_KEY);
  session = null;
  emit();
}

function updateSession(patch: Partial<Session>) {
  const current = readSession();
  if (!current) return;
  const next = { ...current, ...patch };
  (current.remember ? window.localStorage : window.sessionStorage).setItem(SESSION_KEY, JSON.stringify(next));
  session = next;
}

// — CRM state —————————————————————————————————————————————

function emptyPulse() {
  return { reviews: {}, outcomes: [] as import("./tessiant-pulse-types").PulseOutcome[], attributedSourceKeys: [] as string[] };
}

function ensureTessiant(s: CrmState): CrmState {
  if (!s.tessiant) return { ...s, tessiant: createTessiantSlice() };
  let slice = s.tessiant;
  if (!slice.pulse) slice = { ...slice, pulse: emptyPulse() };
  // Upgrade legacy associate rows into talent profiles without rewriting seed IDs
  const needsEnrich = slice.associates.some((associate) => !associate.profileUpdatedAt || !associate.documents);
  if (needsEnrich) {
    slice = { ...slice, associates: slice.associates.map((associate) => ensureTalentProfile(associate)) };
  }
  if (slice === s.tessiant) return s;
  return { ...s, tessiant: slice };
}

function withTessiant(s: CrmState, mutator: (slice: TessiantStateSlice) => TessiantStateSlice): CrmState {
  const base = ensureTessiant(s);
  return { ...base, tessiant: mutator(base.tessiant!) };
}

function pushDomainEvent(
  slice: TessiantStateSlice,
  event: ReturnType<typeof createDomainEvent>,
): TessiantStateSlice {
  if (slice.domainEvents.some((item) => item.eventId === event.eventId)) return slice;
  return { ...slice, domainEvents: [event, ...slice.domainEvents] };
}

/** Attach a Pulse domain event onto CRM state (ensures Tessiant slice exists). */
function appendDomain(s: CrmState, event: ReturnType<typeof createDomainEvent>): CrmState {
  const base = ensureTessiant(s);
  return { ...base, tessiant: pushDomainEvent(base.tessiant!, event) };
}

function pushDomainEvents(slice: TessiantStateSlice, events: ReturnType<typeof createDomainEvent>[]): TessiantStateSlice {
  return events.reduce((next, event) => pushDomainEvent(next, event), slice);
}

/** Reflect agreed assignment capacity on the associate — never blanket-lock every placement at 100%. */
function syncAssociateAvailabilityFromAssignments(
  state: CrmState,
  associateId: string,
  at: string,
  note: string,
): CrmState {
  const slice = state.tessiant;
  if (!slice) return state;
  const committed = associateCommittedCapacity({ ...state, tessiant: slice }, associateId);
  const nextAvailability = availabilityFromCapacity(committed);
  const endDates = slice.placements
    .filter((p) => p.associateId === associateId && (p.outcome === "open" || p.outcome == null) && p.status === "confirmed")
    .map((p) => p.terms.endDate)
    .filter((value): value is string => Boolean(value))
    .sort();
  const associates = slice.associates.map((associate) => {
    if (associate.id !== associateId) return associate;
    if (!nextAvailability) {
      return {
        ...associate,
        availability:
          associate.availability === "unavailable" || associate.availability === "limited" ? "available" : associate.availability,
        tags: associate.tags.filter((tag) => tag !== "deployed"),
        notes: note ? `${associate.notes} ${note}`.trim() : associate.notes,
      };
    }
    return {
      ...associate,
      availability: nextAvailability,
      nextAvailableDate: endDates[0] ?? associate.nextAvailableDate,
      tags: associate.tags.includes("deployed") ? associate.tags : [...associate.tags, "deployed"],
      notes: note ? `${associate.notes} ${note}`.trim() : associate.notes,
    };
  });
  let nextSlice: TessiantStateSlice = { ...slice, associates };
  if (nextAvailability) {
    nextSlice = pushDomainEvents(nextSlice, [
      createDomainEvent({
        eventId: `de_as_avail_chg_${associateId}_${at}`,
        eventType: "associate.availability_changed",
        entityType: "associate",
        entityId: associateId,
        timestamp: at,
        actor: "You",
        payload: { availability: nextAvailability, committedCapacity: committed, note, summary: `Availability → ${nextAvailability}` },
      }),
      createDomainEvent({
        eventId: `de_as_avail_${associateId}_${at}`,
        eventType: "associate.availability_verified",
        entityType: "associate",
        entityId: associateId,
        timestamp: at,
        actor: "You",
        payload: { availability: nextAvailability, committedCapacity: committed, note },
      }),
    ]);
  }
  return { ...state, tessiant: nextSlice };
}

function readCrm(): CrmState | null {
  if (state) return state;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as CrmState) : null;
    if (parsed && parsed.version === DATA_VERSION) {
      state = Array.isArray(parsed.messages) ? parsed : { ...parsed, messages: demoMessages((hours) => new Date(Date.now() - hours * 3_600_000).toISOString()).filter((message) => parsed.leads.some((lead) => lead.id === message.leadId)) };
      if (!state.contacts) state = { ...state, contacts: [] };
      if (!state.opportunities) state = { ...state, opportunities: [] };
      state = {
        ...state,
        leads: state.leads.map((lead) => adaptLeadRecord(lead)),
      };
      if (!state.tessiant) {
        state = { ...state, tessiant: createTessiantSlice() };
        write(state);
      } else {
        const upgraded = ensureTessiant(state);
        if (upgraded !== state) {
          state = upgraded;
          write(state);
        }
      }
      if (!Array.isArray(parsed.messages)) write(state);
    } else {
      state = null;
    }
  } catch {
    state = null;
  }
  if (!state) {
    const current = readSession();
    if (current) write(createDemoState({ name: current.name, email: current.email }));
  }
  return state;
}

function write(next: CrmState) {
  state = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Storage full or unavailable: keep in-memory state so the session still works.
  }
}

function update(mutator: (draft: CrmState) => CrmState) {
  const current = readCrm();
  if (!current) return;
  write(mutator(current));
  emit();
}

export function useCrm(): CrmState | null {
  return useSyncExternalStore(subscribe, readCrm, () => null);
}

const nowIso = () => new Date().toISOString();

function actorName(s: CrmState, id: string) {
  return id === "me" ? "You" : s.members.find((member) => member.id === id)?.name ?? "Someone";
}

function crmEvent(
  leadId: string,
  kind: ActivityEvent["kind"],
  title: string,
  detail?: string,
  extras?: Partial<Pick<ActivityEvent, "accountId" | "opportunityId" | "contactId" | "activityType">>,
): ActivityEvent {
  return {
    id: uid("ev"),
    leadId,
    kind,
    title,
    detail,
    occurredAt: nowIso(),
    source: "Tessiant CRM",
    actor: "You",
    ...extras,
  };
}

export interface TaskInput {
  title: string;
  description: string;
  priority: Priority;
  due: string | null;
  ownerId: string | null;
  leadId: string | null;
  status?: TaskStatus;
}

const STATUS_ACTION: Record<TaskStatus, string> = {
  pending: "Moved to pending",
  in_progress: "Started work",
  completed: "Marked completed",
  dismissed: "Dismissed",
};

export const crm = {
  addLead(input: Omit<Lead, "id" | "createdAt" | "nextAction">, note?: string): { ok: true; id: string } | { ok: false; existingId: string } {
    const current = readCrm();
    const duplicate = current?.leads.find((item) => item.email.toLowerCase() === input.email.trim().toLowerCase());
    if (duplicate) return { ok: false, existingId: duplicate.id };
    const id = uid("l");
    const record = adaptLeadRecord({
      ...input,
      id,
      createdAt: nowIso(),
      nextAction: null,
      sector: input.sector ?? null,
      serviceInterest: input.serviceInterest ?? null,
      accountId: input.accountId ?? null,
    });
    update((s) => {
      const at = nowIso();
      let next: CrmState = {
        ...s,
        leads: [record, ...s.leads],
        events: [crmEvent(id, "lead_created", "Lead added", `Source: ${record.source}`, { accountId: record.accountId }), ...s.events],
        notes: note?.trim()
          ? [{ id: uid("note"), leadId: id, body: note.trim(), authorId: "me", createdAt: at, accountId: record.accountId ?? null }, ...s.notes]
          : s.notes,
      };
      next = appendDomain(
        next,
        createDomainEvent({
          eventId: `de_lead_created_${id}`,
          eventType: "lead.created",
          entityType: "lead",
          entityId: id,
          timestamp: at,
          actor: "You",
          payload: {
            name: record.name,
            company: record.company,
            source: record.source,
            status: record.status,
            accountId: record.accountId,
            ownerId: record.ownerId,
            summary: `Lead created · ${record.name}`,
          },
        }),
      );
      return next;
    });
    return { ok: true, id };
  },

  updateLead(leadId: string, patch: Partial<Omit<Lead, "id" | "createdAt">>) {
    update((s) => {
      const lead = s.leads.find((item) => item.id === leadId);
      if (!lead) return s;
      const at = nowIso();
      const newEvents: ActivityEvent[] = [];
      if (patch.status && patch.status !== lead.status) newEvents.push(crmEvent(leadId, "status_change", `Status changed to ${patch.status}`, `${lead.status} → ${patch.status}`));
      if (patch.ownerId !== undefined && patch.ownerId !== lead.ownerId) {
        newEvents.push(crmEvent(leadId, "owner_change", `Owner changed to ${patch.ownerId ? actorName(s, patch.ownerId) : "Unassigned"}`));
      }
      let next: CrmState = {
        ...s,
        leads: s.leads.map((item) => (item.id === leadId ? { ...item, ...patch } : item)),
        events: [...newEvents, ...s.events],
      };
      if (patch.status && patch.status !== lead.status) {
        if (patch.status === "Qualified") {
          next = appendDomain(
            next,
            createDomainEvent({
              eventId: `de_lead_qualified_${leadId}_${at}`,
              eventType: "lead.qualified",
              entityType: "lead",
              entityId: leadId,
              timestamp: at,
              actor: "You",
              payload: { from: lead.status, to: patch.status, accountId: patch.accountId ?? lead.accountId, summary: `${lead.name} qualified` },
            }),
          );
        }
        if (patch.status === "Converted") {
          next = appendDomain(
            next,
            createDomainEvent({
              eventId: `de_lead_converted_${leadId}_${at}`,
              eventType: "lead.converted",
              entityType: "lead",
              entityId: leadId,
              timestamp: at,
              actor: "You",
              payload: {
                from: lead.status,
                to: patch.status,
                accountId: patch.accountId ?? lead.accountId,
                opportunityId: patch.convertedOpportunityId ?? lead.convertedOpportunityId,
                contactId: patch.convertedContactId ?? lead.convertedContactId,
                summary: `${lead.name} converted`,
              },
            }),
          );
        }
      }
      return next;
    });
  },

  setLeadStatus(leadId: string, status: LeadStatus) {
    crm.updateLead(leadId, { status: normalizeLeadStatus(status) });
  },

  createContact(input: Omit<Contact, "id" | "createdAt" | "updatedAt">): string {
    const id = uid("ct");
    const at = nowIso();
    update((s) => ({
      ...s,
      contacts: [{ ...input, id, createdAt: at, updatedAt: at }, ...(s.contacts ?? [])],
      events: [
        crmEvent(input.accountId, "interaction", `Contact added · ${input.name}`, input.role ?? undefined, {
          accountId: input.accountId,
          contactId: id,
          activityType: "note",
        }),
        ...s.events,
      ],
    }));
    return id;
  },

  updateContact(contactId: string, patch: Partial<Omit<Contact, "id" | "createdAt">>) {
    update((s) => ({
      ...s,
      contacts: (s.contacts ?? []).map((item) => (item.id === contactId ? { ...item, ...patch, updatedAt: nowIso() } : item)),
    }));
  },

  createOpportunity(
    input: Omit<Opportunity, "id" | "createdAt" | "updatedAt" | "closedAt" | "probability"> & { probability?: number },
  ): string {
    const id = uid("opp");
    const at = nowIso();
    const stage = input.stage;
    const opportunity: Opportunity = {
      ...input,
      id,
      probability: input.probability ?? stageProbability(stage),
      agreedContractValue: input.agreedContractValue ?? null,
      expectedBilling: input.expectedBilling ?? null,
      recognisedRevenue: input.recognisedRevenue ?? null,
      lostReason: input.lostReason ?? null,
      createdAt: at,
      updatedAt: at,
      closedAt: stage === "Closed Won" || stage === "Closed Lost" ? at : null,
    };
    update((s) => {
      let nextState: CrmState = {
        ...s,
        opportunities: [opportunity, ...(s.opportunities ?? [])],
        events: [
          crmEvent(input.leadId ?? input.accountId, "opportunity", `Opportunity created · ${input.name}`, input.stage, {
            accountId: input.accountId,
            opportunityId: id,
            contactId: input.contactId,
          }),
          ...s.events,
        ],
      };
      nextState = appendDomain(
        nextState,
        createDomainEvent({
          eventId: `de_opp_created_${id}`,
          eventType: "opportunity.created",
          entityType: "opportunity",
          entityId: id,
          timestamp: at,
          actor: "You",
          payload: {
            name: input.name,
            stage: input.stage,
            amount: input.amount,
            accountId: input.accountId,
            contactId: input.contactId,
            leadId: input.leadId,
            type: input.type,
            summary: `Opportunity created · ${input.name}`,
          },
        }),
      );
      return nextState;
    });
    return id;
  },

  updateOpportunity(opportunityId: string, patch: Partial<Omit<Opportunity, "id" | "createdAt">>) {
    update((s) => {
      const current = (s.opportunities ?? []).find((item) => item.id === opportunityId);
      if (!current) return s;
      const at = nowIso();
      const stage = patch.stage ?? current.stage;
      const next: Opportunity = {
        ...current,
        ...patch,
        probability: patch.probability ?? (patch.stage ? stageProbability(patch.stage) : current.probability),
        closedAt:
          stage === "Closed Won" || stage === "Closed Lost"
            ? patch.closedAt ?? current.closedAt ?? at
            : null,
        updatedAt: at,
      };
      const events =
        patch.stage && patch.stage !== current.stage
          ? [
              crmEvent(current.leadId ?? current.accountId, "status_change", `Opportunity → ${patch.stage}`, `${current.stage} → ${patch.stage}`, {
                accountId: current.accountId,
                opportunityId,
              }),
              ...s.events,
            ]
          : s.events;
      let nextState: CrmState = {
        ...s,
        opportunities: (s.opportunities ?? []).map((item) => (item.id === opportunityId ? next : item)),
        events,
      };
      if (patch.stage && patch.stage !== current.stage) {
        const basePayload = {
          from: current.stage,
          to: patch.stage,
          accountId: current.accountId,
          leadId: current.leadId,
          amount: next.amount,
          agreedContractValue: next.agreedContractValue,
          lostReason: next.lostReason,
          summary: `${current.name}: ${current.stage} → ${patch.stage}`,
        };
        if (patch.stage === "Closed Won") {
          nextState = appendDomain(
            nextState,
            createDomainEvent({
              eventId: `de_opp_won_${opportunityId}_${at}`,
              eventType: "opportunity.won",
              entityType: "opportunity",
              entityId: opportunityId,
              timestamp: at,
              actor: "You",
              payload: basePayload,
            }),
          );
        } else if (patch.stage === "Closed Lost") {
          nextState = appendDomain(
            nextState,
            createDomainEvent({
              eventId: `de_opp_lost_${opportunityId}_${at}`,
              eventType: "opportunity.lost",
              entityType: "opportunity",
              entityId: opportunityId,
              timestamp: at,
              actor: "You",
              payload: basePayload,
            }),
          );
        } else {
          nextState = appendDomain(
            nextState,
            createDomainEvent({
              eventId: `de_opp_prog_${opportunityId}_${at}`,
              eventType: "opportunity.progressed",
              entityType: "opportunity",
              entityId: opportunityId,
              timestamp: at,
              actor: "You",
              payload: basePayload,
            }),
          );
        }
      }
      return nextState;
    });
  },

  setOpportunityStage(opportunityId: string, stage: OpportunityStage, extras?: Partial<Opportunity>) {
    crm.updateOpportunity(opportunityId, { stage, ...extras });
  },

  /** Convert a qualified lead into Account contact + Opportunity (Salesforce-style). */
  convertLead(
    leadId: string,
    input: {
      accountId: string;
      opportunityName: string;
      opportunityType: OpportunityType;
      amount: number;
      stage?: OpportunityStage;
      services?: string[];
    },
  ): { ok: true; opportunityId: string; contactId: string } | { ok: false; error: string } {
    const current = readCrm();
    const lead = current?.leads.find((item) => item.id === leadId);
    if (!lead) return { ok: false, error: "Lead not found" };
    if (normalizeLeadStatus(lead.status) === "Converted") return { ok: false, error: "Lead already converted" };
    const account = current?.tessiant?.accounts.find((item) => item.id === input.accountId);
    if (!account) return { ok: false, error: "Select a client account" };

    const contactId = crm.createContact({
      accountId: input.accountId,
      name: lead.name,
      email: lead.email,
      phone: lead.phone,
      role: lead.role,
      ownerId: lead.ownerId,
      isPrimary: true,
      notes: `Converted from lead ${lead.id}`,
    });
    const opportunityId = crm.createOpportunity({
      name: input.opportunityName,
      accountId: input.accountId,
      contactId,
      leadId,
      type: input.opportunityType,
      stage: input.stage ?? "Qualification",
      amount: input.amount,
      currency: "GBP",
      expectedCloseDate: addDays(30),
      ownerId: lead.ownerId,
      services: input.services ?? (lead.serviceInterest ? [lead.serviceInterest] : []),
      nextStep: "Qualify scope and stakeholders",
      agreedContractValue: null,
      expectedBilling: null,
      recognisedRevenue: null,
      lostReason: null,
    });
    crm.updateLead(leadId, {
      status: "Converted",
      accountId: input.accountId,
      convertedContactId: contactId,
      convertedOpportunityId: opportunityId,
    });
    update((s) => ({
      ...s,
      events: [
        crmEvent(leadId, "conversion", "Lead converted to opportunity", `${input.opportunityName}`, {
          accountId: input.accountId,
          opportunityId,
          contactId,
        }),
        ...s.events,
      ],
    }));
    return { ok: true, opportunityId, contactId };
  },

  /** Closed-won (or qualified) opportunity → staffing requirement linked to account + opportunity. */
  createRequirementFromOpportunity(
    opportunityId: string,
    input?: { title?: string; headcount?: number; description?: string },
  ): { ok: true; requirementId: string } | { ok: false; error: string } {
    const current = readCrm();
    const opportunity = current?.opportunities?.find((item) => item.id === opportunityId);
    if (!opportunity) return { ok: false, error: "Opportunity not found" };
    if (opportunity.stage !== "Closed Won" && opportunity.stage !== "Negotiation" && opportunity.stage !== "Proposal") {
      return { ok: false, error: "Generate requirements from Proposal, Negotiation or Closed Won opportunities" };
    }
    const account = current?.tessiant?.accounts.find((item) => item.id === opportunity.accountId);
    if (!account || !current) return { ok: false, error: "Account missing" };

    const category =
      opportunity.type === "advisory" || opportunity.type === "consultancy"
        ? "advisory"
        : opportunity.type === "project team"
          ? "project team"
          : "augmentation";

    const requirementId = crm.createRequirement({
      accountId: opportunity.accountId,
      title: input?.title?.trim() || `${opportunity.name} · staffing request`,
      category,
      description:
        input?.description?.trim() ||
        `Generated from opportunity ${opportunity.name}. Pipeline value £${opportunity.amount.toLocaleString("en-GB")} is not recognised revenue.`,
      sector: account.sector,
      mustHaveSkills: opportunity.services.slice(0, 2).length ? opportunity.services.slice(0, 2) : ["Programme management"],
      preferredSkills: [],
      seniority: "senior",
      roleType: category === "advisory" ? "SIA" : "consultant",
      location: "UK hybrid",
      workingMode: "hybrid",
      // Start promptly so founder-demo placement becomes an active assignment (not buried as +21d upcoming).
      startDate: addDays(0),
      durationWeeks: 12,
      headcount: input?.headcount ?? 1,
      rateMin: 800,
      rateMax: 1200,
      currency: opportunity.currency,
      rateUnit: "day",
      ownerId: opportunity.ownerId,
      requestDate: addDays(0),
      notes: `Linked opportunity ${opportunity.id}. Agreed contract / billing tracked separately.`,
      offeringAlignment: opportunity.services,
      priority: "high",
      linkedOpportunityId: opportunity.id,
    });

    update((s) => ({
      ...s,
      events: [
        crmEvent(opportunity.leadId ?? opportunity.accountId, "opportunity", "Staffing requirement generated", requirementId, {
          accountId: opportunity.accountId,
          opportunityId,
        }),
        ...s.events,
      ],
    }));
    return { ok: true, requirementId };
  },

  addNote(leadId: string, body: string) {
    update((s) => ({ ...s, notes: [{ id: uid("note"), leadId, body: body.trim(), authorId: "me", createdAt: nowIso() }, ...s.notes] }));
  },

  deleteNote(noteId: string) {
    update((s) => ({ ...s, notes: s.notes.filter((note) => note.id !== noteId) }));
  },

  sendMessage(leadId: string, input: { channel: ConversationChannel; address: string; subject: string | null; body: string }) {
    update((s) => {
      const lead = s.leads.find((item) => item.id === leadId);
      if (!lead) return s;
      const body = input.body.trim();
      const subject = input.subject?.trim() || null;
      const address = input.address.trim();
      const contacted = lead.status === "New";
      const title = input.channel === "email" ? `Email sent${subject ? `: ${subject}` : ""}` : "WhatsApp sent";
      const detail = input.channel === "email" ? body : `${address} — ${body}`;
      return {
        ...s,
        leads: s.leads.map((item) =>
          item.id === leadId
            ? { ...item, status: contacted ? ("Working" as LeadStatus) : item.status, phone: input.channel === "whatsapp" ? address : item.phone }
            : item,
        ),
        messages: [{ id: uid("msg"), leadId, channel: input.channel, direction: "out" as const, address, subject, body, at: nowIso(), actor: "You" }, ...(s.messages ?? [])],
        events: [
          crmEvent(leadId, "interaction", title, detail, { activityType: "email", accountId: lead.accountId }),
          ...(contacted ? [crmEvent(leadId, "status_change", "Status changed to Working", "New → Working (after first message)")] : []),
          ...s.events,
        ],
      };
    });
  },

  logInteraction(leadId: string, channel: string, summary: string) {
    update((s) => {
      const lead = s.leads.find((item) => item.id === leadId);
      const leads = lead && lead.status === "New" ? s.leads.map((item) => (item.id === leadId ? { ...item, status: "Working" as LeadStatus } : item)) : s.leads;
      const extra = lead && lead.status === "New" ? [crmEvent(leadId, "status_change", "Status changed to Working", "New → Working (after first interaction)")] : [];
      return { ...s, leads, events: [crmEvent(leadId, "interaction", `${channel} logged`, summary), ...extra, ...s.events] };
    });
  },

  createTask(input: TaskInput, origin: Task["origin"] = "manual", evidence: Task["evidence"] = []): string {
    const id = uid("task");
    update((s) => {
      const at = nowIso();
      const status = input.status ?? "pending";
      const task: Task = {
        id,
        title: input.title.trim(),
        description: input.description.trim(),
        status,
        priority: input.priority,
        due: input.due,
        ownerId: input.ownerId,
        leadId: input.leadId,
        origin,
        evidence,
        history: [{ at, actorId: "me", action: origin === "suggestion" ? "Accepted Qiko suggestion" : origin === "copilot" ? "Created from Ask Qiko" : "Created task" }],
        createdAt: at,
        updatedAt: at,
        completedAt: status === "completed" ? at : null,
      };
      const events = input.leadId ? [crmEvent(input.leadId, "task", "Task created", task.title), ...s.events] : s.events;
      return { ...s, tasks: [task, ...s.tasks], events };
    });
    return id;
  },

  updateTask(taskId: string, patch: Partial<TaskInput>) {
    update((s) => ({
      ...s,
      tasks: s.tasks.map((task) => {
        if (task.id !== taskId) return task;
        const at = nowIso();
        const history = [...task.history];
        if (patch.status && patch.status !== task.status) history.push({ at, actorId: "me", action: STATUS_ACTION[patch.status] });
        if (patch.ownerId !== undefined && patch.ownerId !== task.ownerId) history.push({ at, actorId: "me", action: `Assigned to ${patch.ownerId ? actorName(s, patch.ownerId) : "nobody"}` });
        const edited = (["title", "description", "priority", "due", "leadId"] as const).filter((key) => patch[key] !== undefined && patch[key] !== task[key]);
        if (edited.length) history.push({ at, actorId: "me", action: `Edited ${edited.join(", ")}` });
        const status = patch.status ?? task.status;
        return {
          ...task,
          ...patch,
          title: patch.title?.trim() ?? task.title,
          status,
          history,
          updatedAt: at,
          completedAt: status === "completed" ? task.completedAt ?? at : null,
        };
      }),
      events:
        patch.status === "completed"
          ? (() => {
              const task = s.tasks.find((item) => item.id === taskId);
              return task?.leadId && task.status !== "completed" ? [crmEvent(task.leadId, "task", "Task completed", task.title), ...s.events] : s.events;
            })()
          : s.events,
    }));
  },

  setTaskStatus(taskId: string, status: TaskStatus) {
    crm.updateTask(taskId, { status });
  },

  deleteTask(taskId: string) {
    update((s) => ({ ...s, tasks: s.tasks.filter((task) => task.id !== taskId) }));
  },

  acceptSuggestion(suggestion: Suggestion, overrides?: Partial<TaskInput>): string {
    const lead = readCrm()?.leads.find((item) => item.id === suggestion.leadId);
    const taskId = crm.createTask(
      {
        title: overrides?.title ?? suggestion.title,
        description: overrides?.description ?? suggestion.reason,
        priority: overrides?.priority ?? suggestion.priority,
        due: overrides?.due !== undefined ? overrides.due : suggestion.suggestedDue,
        ownerId: overrides?.ownerId !== undefined ? overrides.ownerId : lead?.ownerId ?? "me",
        leadId: suggestion.leadId,
        status: overrides?.status,
      },
      "suggestion",
      suggestion.evidence,
    );
    update((s) => ({ ...s, decisions: { ...s.decisions, [suggestion.id]: { decision: "accepted", at: nowIso(), taskId } } }));
    return taskId;
  },

  dismissSuggestion(suggestionId: string) {
    update((s) => ({ ...s, decisions: { ...s.decisions, [suggestionId]: { decision: "dismissed", at: nowIso() } } }));
  },

  /** Handle a suggestion straight away: records a completed task for the audit trail. */
  completeSuggestion(suggestion: Suggestion) {
    const taskId = crm.acceptSuggestion(suggestion, { status: "completed" });
    update((s) => ({ ...s, decisions: { ...s.decisions, [suggestion.id]: { decision: "done", at: nowIso(), taskId } } }));
  },


  addMember(member: Omit<Member, "id">): string {
    const id = uid("m");
    update((s) => ({ ...s, members: [...s.members, { ...member, id }] }));
    return id;
  },

  removeMember(memberId: string) {
    if (memberId === "me") return;
    update((s) => ({
      ...s,
      members: s.members.filter((member) => member.id !== memberId),
      leads: s.leads.map((lead) => (lead.ownerId === memberId ? { ...lead, ownerId: null } : lead)),
      tasks: s.tasks.map((task) => (task.ownerId === memberId ? { ...task, ownerId: null } : task)),
    }));
  },

  updateProfile(name: string) {
    updateSession({ name });
    update((s) => ({ ...s, members: s.members.map((member) => (member.id === "me" ? { ...member, name } : member)) }));
  },

  resetDemoData() {
    const current = readSession();
    if (!current) return;
    write(createDemoState({ name: current.name, email: current.email }));
    emit();
  },

  // — Tessiant staffing (Demo V1) ———————————————————————————

  createAssociate(input: {
    name: string;
    headline: string;
    roleType: Associate["roleType"];
    seniority: Associate["seniority"];
    skills: string[];
    specialisations?: string[];
    sectors: string[];
    location: string;
    workingMode?: Associate["workingMode"];
    availability?: Associate["availability"];
    rateAmount?: number | null;
    email?: string | null;
    phone?: string | null;
    notes?: string;
  }): string {
    const id = uid("as");
    const at = nowIso();
    const skills = [...new Set(input.skills.map((item) => item.trim()).filter(Boolean))];
    const skillKeys = new Set(skills.map((item) => item.toLowerCase()));
    const specialisations = [...new Set((input.specialisations ?? []).map((item) => item.trim()).filter(Boolean))].filter(
      (item) => !skillKeys.has(item.toLowerCase()),
    );
    const associate = ensureTalentProfile({
      id,
      name: input.name.trim(),
      roleType: input.roleType,
      headline: input.headline.trim(),
      seniority: input.seniority,
      skills,
      specialisations,
      sectors: [...new Set(input.sectors.map((item) => item.trim()).filter(Boolean))],
      location: input.location.trim() || "UK",
      workingMode: input.workingMode ?? "hybrid",
      availability: input.availability ?? "available",
      nextAvailableDate: null,
      rate: input.rateAmount != null ? { amount: input.rateAmount, currency: "GBP", unit: "day" } : null,
      source: "network",
      cvRef: `demo://cv/${id}`,
      verifiedAt: null,
      ownerId: "me",
      notes: input.notes?.trim() || "",
      tags: ["manual"],
      status: "unverified",
      languages: ["English"],
      offerings: [],
      priorPlacementCount: 0,
      email: input.email?.trim() || null,
      phone: input.phone?.trim() || null,
      profileUpdatedAt: at,
    });
    update((s) =>
      withTessiant(s, (slice) => {
        const nextAssociates = [associate, ...slice.associates];
        return pushDomainEvent(
          {
            ...slice,
            associates: nextAssociates,
            networkStats: {
              ...slice.networkStats,
              sampleSize: nextAssociates.length,
              activeSample: nextAssociates.filter((item) => item.status === "active").length,
              verifiedSample: nextAssociates.filter((item) => Boolean(item.verifiedAt)).length,
              siaSample: nextAssociates.filter((item) => item.roleType === "SIA" || item.roleType === "executive_advisor").length,
            },
          },
          createDomainEvent({
            eventId: `de_as_created_${id}_${at}`,
            eventType: "associate.created",
            entityType: "associate",
            entityId: id,
            timestamp: at,
            actor: "You",
            payload: {
              name: associate.name,
              roleType: associate.roleType,
              seniority: associate.seniority,
              skills: associate.skills,
              sectors: associate.sectors,
              availability: associate.availability,
              summary: `Associate added · ${associate.name}`,
            },
          }),
        );
      }),
    );
    return id;
  },

  updateAssociate(associateId: string, patch: Partial<Omit<Associate, "id">>) {
    update((s) =>
      withTessiant(s, (slice) => {
        const existing = slice.associates.find((item) => item.id === associateId);
        if (!existing) return slice;
        const next = { ...existing, ...patch, profileUpdatedAt: nowIso() };
        let events = slice.domainEvents;
        const eventId = `de_as_upd_${associateId}_${Date.now().toString(36)}`;
        events = pushDomainEvent(
          { ...slice, domainEvents: events },
          createDomainEvent({
            eventId,
            eventType: "associate.updated",
            entityType: "associate",
            entityId: associateId,
            timestamp: nowIso(),
            actor: "You",
            payload: { fields: Object.keys(patch) },
          }),
        ).domainEvents;
        if (patch.availability && patch.availability !== existing.availability) {
          const at = nowIso();
          events = pushDomainEvents(
            { ...slice, domainEvents: events },
            [
              createDomainEvent({
                eventId: `de_as_av_chg_${associateId}_${at}`,
                eventType: "associate.availability_changed",
                entityType: "associate",
                entityId: associateId,
                timestamp: at,
                actor: "You",
                payload: {
                  from: existing.availability,
                  availability: patch.availability,
                  nextAvailableDate: patch.nextAvailableDate ?? existing.nextAvailableDate,
                  summary: `Availability → ${patch.availability}`,
                },
              }),
              createDomainEvent({
                eventId: `de_as_av_${associateId}_${at}`,
                eventType: "associate.availability_verified",
                entityType: "associate",
                entityId: associateId,
                timestamp: at,
                actor: "You",
                payload: { availability: patch.availability, nextAvailableDate: patch.nextAvailableDate ?? existing.nextAvailableDate },
              }),
            ],
          ).domainEvents;
        }
        return {
          ...slice,
          associates: slice.associates.map((item) => (item.id === associateId ? next : item)),
          domainEvents: events,
          networkStats: {
            ...slice.networkStats,
            sampleSize: slice.associates.length,
            activeSample: slice.associates.map((item) => (item.id === associateId ? next : item)).filter((a) => a.status === "active").length,
            verifiedSample: slice.associates.map((item) => (item.id === associateId ? next : item)).filter((a) => Boolean(a.verifiedAt)).length,
            siaSample: slice.associates.map((item) => (item.id === associateId ? next : item)).filter((a) => a.roleType === "SIA" || a.roleType === "executive_advisor").length,
          },
        };
      }),
    );
  },

  createRequirement(
    input: Omit<ClientRequirement, "id" | "createdAt" | "updatedAt" | "stageHistory" | "stage" | "outcome" | "outcomeReason" | "archived">,
  ): string {
    const id = uid("req");
    const at = nowIso();
    update((s) =>
      withTessiant(s, (slice) => {
        const requirement: ClientRequirement = {
          ...input,
          id,
          stage: "New Requirement",
          outcome: "active",
          outcomeReason: null,
          priority: input.priority ?? "medium",
          linkedOpportunityId: input.linkedOpportunityId ?? null,
          archived: false,
          stageHistory: [{ stage: "New Requirement", at, actorId: "me", reason: "Created in Tessiant CRM demo" }],
          createdAt: at,
          updatedAt: at,
        };
        return pushDomainEvents(
          { ...slice, requirements: [requirement, ...slice.requirements] },
          [
            createDomainEvent({
              eventId: `de_req_created_${id}`,
              eventType: "requirement.created",
              entityType: "requirement",
              entityId: id,
              timestamp: at,
              actor: "You",
              payload: {
                title: requirement.title,
                accountId: requirement.accountId,
                linkedOpportunityId: requirement.linkedOpportunityId ?? null,
                category: requirement.category,
                sector: requirement.sector,
                seniority: requirement.seniority,
                mustHaveSkills: requirement.mustHaveSkills,
                preferredSkills: requirement.preferredSkills,
                startDate: requirement.startDate,
                durationWeeks: requirement.durationWeeks,
                headcount: requirement.headcount,
                priority: requirement.priority ?? "medium",
                rateMin: requirement.rateMin,
                rateMax: requirement.rateMax,
                currency: requirement.currency,
                summary: `Requirement created · ${requirement.title}`,
              },
            }),
            createDomainEvent({
              eventId: `de_req_opened_${id}`,
              eventType: "requirement.opened",
              entityType: "requirement",
              entityId: id,
              timestamp: at,
              actor: "You",
              payload: {
                title: requirement.title,
                accountId: requirement.accountId,
                stage: requirement.stage,
                startDate: requirement.startDate,
                priority: requirement.priority ?? "medium",
                headcount: requirement.headcount,
                summary: `Requirement opened · ${requirement.title}`,
              },
            }),
          ],
        );
      }),
    );
    return id;
  },

  updateRequirement(requirementId: string, patch: Partial<Omit<ClientRequirement, "id" | "createdAt" | "stageHistory">>) {
    update((s) =>
      withTessiant(s, (slice) => ({
        ...slice,
        requirements: slice.requirements.map((item) =>
          item.id === requirementId ? { ...item, ...patch, updatedAt: nowIso() } : item,
        ),
      })),
    );
  },

  setRequirementStage(requirementId: string, stage: RequirementStage, reason?: string) {
    update((s) =>
      withTessiant(s, (slice) => {
        const requirement = slice.requirements.find((item) => item.id === requirementId);
        if (!requirement || requirement.stage === stage) return slice;
        const at = nowIso();
        const next: ClientRequirement = {
          ...requirement,
          stage,
          updatedAt: at,
          stageHistory: [...requirement.stageHistory, { stage, at, actorId: "me", reason }],
        };
        return pushDomainEvent(
          {
            ...slice,
            requirements: slice.requirements.map((item) => (item.id === requirementId ? next : item)),
          },
          createDomainEvent({
            eventId: `de_req_stage_${requirementId}_${at}`,
            eventType: "requirement.stage_changed",
            entityType: "requirement",
            entityId: requirementId,
            timestamp: at,
            actor: "You",
            payload: {
              from: requirement.stage,
              to: stage,
              reason: reason ?? null,
              accountId: requirement.accountId,
              linkedOpportunityId: requirement.linkedOpportunityId ?? null,
              summary: `Requirement stage · ${requirement.stage} → ${stage}`,
            },
          }),
        );
      }),
    );
  },

  setRequirementOutcome(requirementId: string, outcome: RequirementOutcome, reason?: string) {
    update((s) =>
      withTessiant(s, (slice) => ({
        ...slice,
        requirements: slice.requirements.map((item) =>
          item.id === requirementId
            ? { ...item, outcome, outcomeReason: reason ?? item.outcomeReason, archived: outcome === "archived" || item.archived, updatedAt: nowIso() }
            : item,
        ),
      })),
    );
  },

  /** Deterministic Find Matches — upserts suggested candidates, preserves shortlist progress. */
  findMatches(requirementId: string): number {
    const current = readCrm();
    const slice = current?.tessiant;
    const requirement = slice?.requirements.find((item) => item.id === requirementId);
    if (!slice || !requirement) return 0;
    const ranked = rankMatches(slice.associates, requirement, {
      placements: slice.placements,
      requirements: slice.requirements,
    }).slice(0, 12);
    let added = 0;
    update((s) =>
      withTessiant(s, (draft) => {
        const existingByAssociate = new Map(
          draft.candidates.filter((c) => c.requirementId === requirementId).map((c) => [c.associateId, c] as const),
        );
        const at = nowIso();
        const nextCandidates = [...draft.candidates];
        const suggestedEvents: ReturnType<typeof createDomainEvent>[] = [];
        for (const match of ranked) {
          const existing = existingByAssociate.get(match.associateId);
          if (existing) {
            // Refresh scores/reasons but keep human shortlist status
            const idx = nextCandidates.findIndex((c) => c.id === existing.id);
            nextCandidates[idx] = {
              ...existing,
              matchScore: match.matchScore,
              matchReasons: match.matchReasons,
              matchGaps: match.matchGaps,
              matchFlags: [...new Set([...match.matchFlags, ...(existing.rankOverride != null ? (["manual_override"] as const) : [])])],
              updatedAt: at,
            };
          } else {
            added += 1;
            const candidateId = uid("cand");
            nextCandidates.unshift({
              id: candidateId,
              requirementId,
              associateId: match.associateId,
              matchScore: match.matchScore,
              matchReasons: match.matchReasons,
              matchGaps: match.matchGaps,
              matchFlags: match.matchFlags,
              shortlistStatus: "suggested",
              rankOverride: null,
              overrideReason: null,
              sourcedExternally: false,
              validation: {
                availabilityConfirmed: false,
                costConfirmed: false,
                indicativeCost: draft.associates.find((a) => a.id === match.associateId)?.rate ?? null,
                notes: "",
                verifiedAt: null,
              },
              interview: { heldAt: null, outcome: "pending", summary: "" },
              quotedClientRate: null,
              createdAt: at,
              updatedAt: at,
            });
            suggestedEvents.push(
              createDomainEvent({
                eventId: `de_cand_suggested_${candidateId}`,
                eventType: "candidate.suggested",
                entityType: "candidate",
                entityId: candidateId,
                timestamp: at,
                actor: "You",
                payload: {
                  requirementId,
                  associateId: match.associateId,
                  matchScore: match.matchScore,
                  accountId: requirement.accountId,
                  summary: `Candidate suggested · score ${match.matchScore}`,
                },
              }),
            );
          }
        }
        let nextSlice: TessiantStateSlice = { ...draft, candidates: nextCandidates };
        if (requirement.stage === "New Requirement") {
          nextSlice = {
            ...nextSlice,
            requirements: nextSlice.requirements.map((item) =>
              item.id === requirementId
                ? {
                    ...item,
                    stage: "Sourcing" as RequirementStage,
                    updatedAt: at,
                    stageHistory: [...item.stageHistory, { stage: "Sourcing" as RequirementStage, at, actorId: "me", reason: "Find Matches run" }],
                  }
                : item,
            ),
          };
          nextSlice = pushDomainEvent(
            nextSlice,
            createDomainEvent({
              eventId: `de_req_stage_${requirementId}_${at}`,
              eventType: "requirement.stage_changed",
              entityType: "requirement",
              entityId: requirementId,
              timestamp: at,
              actor: "You",
              payload: { from: "New Requirement", to: "Sourcing", reason: "Find Matches run", accountId: requirement.accountId },
            }),
          );
        }
        return pushDomainEvents(nextSlice, suggestedEvents);
      }),
    );
    return added;
  },

  setCandidateStatus(candidateId: string, shortlistStatus: ShortlistStatus, extras?: Partial<RequirementCandidate>) {
    update((s) =>
      withTessiant(s, (slice) => {
        const candidate = slice.candidates.find((item) => item.id === candidateId);
        if (!candidate) return slice;
        const at = nowIso();
        const from = candidate.shortlistStatus;
        let nextSlice: TessiantStateSlice = {
          ...slice,
          candidates: slice.candidates.map((item) =>
            item.id === candidateId ? { ...item, ...extras, shortlistStatus, updatedAt: at } : item,
          ),
        };
        if (from === shortlistStatus) return nextSlice;

        const basePayload = {
          requirementId: candidate.requirementId,
          associateId: candidate.associateId,
          from,
          to: shortlistStatus,
          note: extras?.lastContactNote ?? extras?.rejectionReason ?? extras?.overrideReason ?? null,
        };

        if (shortlistStatus === "shortlisted") {
          nextSlice = pushDomainEvent(
            nextSlice,
            createDomainEvent({
              eventId: `de_cand_short_${candidateId}_${at}`,
              eventType: "candidate.shortlisted",
              entityType: "candidate",
              entityId: candidateId,
              timestamp: at,
              actor: "You",
              payload: basePayload,
            }),
          );
        } else if (shortlistStatus === "suggested" && (from === "shortlisted" || from === "availability_confirmed")) {
          nextSlice = pushDomainEvent(
            nextSlice,
            createDomainEvent({
              eventId: `de_cand_unshort_${candidateId}_${at}`,
              eventType: "candidate.removed_from_shortlist",
              entityType: "candidate",
              entityId: candidateId,
              timestamp: at,
              actor: "You",
              payload: { ...basePayload, reason: extras?.overrideReason ?? "Removed from shortlist" },
            }),
          );
        } else if (shortlistStatus === "contacted") {
          nextSlice = pushDomainEvent(
            nextSlice,
            createDomainEvent({
              eventId: `de_cand_contact_${candidateId}_${at}`,
              eventType: "candidate.contacted",
              entityType: "candidate",
              entityId: candidateId,
              timestamp: at,
              actor: "You",
              payload: { ...basePayload, note: extras?.lastContactNote ?? "Contact logged" },
            }),
          );
        } else if (shortlistStatus === "submitted_to_client") {
          nextSlice = pushDomainEvent(
            nextSlice,
            createDomainEvent({
              eventId: `de_cand_submit_${candidateId}_${at}`,
              eventType: "candidate.submitted_to_client",
              entityType: "candidate",
              entityId: candidateId,
              timestamp: at,
              actor: "You",
              payload: basePayload,
            }),
          );
        } else if (shortlistStatus === "interview") {
          nextSlice = pushDomainEvent(
            nextSlice,
            createDomainEvent({
              eventId: `de_cand_interviewed_${candidateId}_${at}`,
              eventType: "candidate.interviewed",
              entityType: "candidate",
              entityId: candidateId,
              timestamp: at,
              actor: "You",
              payload: { ...basePayload, summary: "Candidate moved to interview" },
            }),
          );
        } else if (shortlistStatus === "rejected") {
          nextSlice = pushDomainEvent(
            nextSlice,
            createDomainEvent({
              eventId: `de_cand_reject_${candidateId}_${at}`,
              eventType: "candidate.rejected",
              entityType: "candidate",
              entityId: candidateId,
              timestamp: at,
              actor: "You",
              payload: { ...basePayload, reason: extras?.rejectionReason ?? "Rejected" },
            }),
          );
        } else {
          nextSlice = pushDomainEvent(
            nextSlice,
            createDomainEvent({
              eventId: `de_cand_status_${candidateId}_${at}`,
              eventType: "candidate.status_changed",
              entityType: "candidate",
              entityId: candidateId,
              timestamp: at,
              actor: "You",
              payload: basePayload,
            }),
          );
        }
        return nextSlice;
      }),
    );
  },

  logCandidateContact(candidateId: string, note: string, advanceToContacted = true) {
    const at = nowIso();
    update((s) =>
      withTessiant(s, (slice) => {
        const candidate = slice.candidates.find((item) => item.id === candidateId);
        if (!candidate) return slice;
        const nextStatus: ShortlistStatus =
          advanceToContacted && candidate.shortlistStatus === "suggested" ? "contacted" : candidate.shortlistStatus;
        let nextSlice: TessiantStateSlice = {
          ...slice,
          candidates: slice.candidates.map((item) =>
            item.id === candidateId
              ? {
                  ...item,
                  shortlistStatus: nextStatus,
                  lastContactNote: note.trim() || "Contact logged",
                  lastContactAt: at,
                  updatedAt: at,
                }
              : item,
          ),
        };
        nextSlice = pushDomainEvent(
          nextSlice,
          createDomainEvent({
            eventId: `de_cand_contact_${candidateId}_${at}`,
            eventType: "candidate.contacted",
            entityType: "candidate",
            entityId: candidateId,
            timestamp: at,
            actor: "You",
            payload: {
              requirementId: candidate.requirementId,
              associateId: candidate.associateId,
              note: note.trim() || "Contact logged",
              from: candidate.shortlistStatus,
              to: nextStatus,
            },
          }),
        );
        return nextSlice;
      }),
    );
  },

  rejectCandidate(candidateId: string, reason: string) {
    this.setCandidateStatus(candidateId, "rejected", { rejectionReason: reason.trim() || "Rejected" });
  },

  /** Create a network stub for someone not already in Tessiant, then shortlist on the requisition. */
  recordExternalNetworkCandidate(
    requirementId: string,
    input: {
      name: string;
      headline?: string;
      skills: string[];
      sectors: string[];
      seniority?: Associate["seniority"];
      rateAmount?: number | null;
      location?: string;
      notes?: string;
    },
  ): string {
    const at = nowIso();
    const associateId = uid("as");
    const candidateId = uid("cand");
    update((s) =>
      withTessiant(s, (slice) => {
        const requirement = slice.requirements.find((item) => item.id === requirementId);
        if (!requirement) return slice;
        const associate: Associate = ensureTalentProfile({
          id: associateId,
          name: input.name.trim(),
          roleType: requirement.roleType === "any" ? "consultant" : requirement.roleType,
          headline: input.headline?.trim() || "Externally sourced candidate",
          seniority: input.seniority ?? requirement.seniority,
          skills: input.skills,
          sectors: input.sectors.length ? input.sectors : [requirement.sector],
          location: input.location?.trim() || "TBC",
          workingMode: "hybrid",
          availability: "unknown",
          nextAvailableDate: null,
          rate: input.rateAmount != null ? { amount: input.rateAmount, currency: "GBP", unit: "day" } : null,
          source: "external",
          cvRef: "demo://cv/external",
          verifiedAt: null,
          ownerId: "me",
          notes: input.notes?.trim() || "DEMO — recorded as externally sourced (not previously in Tessiant network).",
          tags: ["external", "sourced"],
          status: "unverified",
          languages: ["English"],
          offerings: [],
          priorPlacementCount: 0,
        });
        const match = matchAssociateToRequirement(associate, requirement, {
          placements: slice.placements,
          requirements: slice.requirements,
        });
        const candidate: RequirementCandidate = {
          id: candidateId,
          requirementId,
          associateId,
          matchScore: match.matchScore,
          matchReasons: [...match.matchReasons, "Externally sourced — outside Tessiant network"],
          matchGaps: match.matchGaps,
          matchFlags: [...new Set([...match.matchFlags, "missing_data" as const, "unverified" as const])],
          shortlistStatus: "shortlisted",
          rankOverride: null,
          overrideReason: "Externally sourced",
          sourcedExternally: true,
          validation: {
            availabilityConfirmed: false,
            costConfirmed: Boolean(associate.rate),
            indicativeCost: associate.rate,
            notes: "",
            verifiedAt: null,
          },
          interview: { heldAt: null, outcome: "pending", summary: "" },
          quotedClientRate: null,
          rejectionReason: null,
          lastContactNote: null,
          lastContactAt: null,
          createdAt: at,
          updatedAt: at,
        };
        let next: TessiantStateSlice = {
          ...slice,
          associates: [associate, ...slice.associates],
          candidates: [candidate, ...slice.candidates],
          networkStats: {
            ...slice.networkStats,
            sampleSize: slice.associates.length + 1,
            activeSample: slice.networkStats.activeSample,
            verifiedSample: slice.networkStats.verifiedSample,
          },
        };
        next = pushDomainEvent(
          next,
          createDomainEvent({
            eventId: `de_cand_ext_${candidateId}`,
            eventType: "candidate.external_recorded",
            entityType: "candidate",
            entityId: candidateId,
            timestamp: at,
            actor: "You",
            payload: { requirementId, associateId, note: "Externally sourced candidate created and shortlisted" },
          }),
        );
        next = pushDomainEvent(
          next,
          createDomainEvent({
            eventId: `de_cand_short_${candidateId}_${at}`,
            eventType: "candidate.shortlisted",
            entityType: "candidate",
            entityId: candidateId,
            timestamp: at,
            actor: "You",
            payload: { requirementId, associateId, sourcedExternally: true },
          }),
        );
        return next;
      }),
    );
    return candidateId;
  },

  overrideCandidateRank(candidateId: string, rankOverride: number, reason: string) {
    update((s) =>
      withTessiant(s, (slice) => {
        const candidate = slice.candidates.find((item) => item.id === candidateId);
        if (!candidate) return slice;
        return {
          ...slice,
          candidates: slice.candidates.map((item) =>
            item.id === candidateId
              ? {
                  ...item,
                  shortlistStatus: item.shortlistStatus === "suggested" ? "shortlisted" : item.shortlistStatus,
                  rankOverride,
                  overrideReason: reason.trim(),
                  matchFlags: [...new Set([...item.matchFlags, "manual_override" as const])],
                  updatedAt: nowIso(),
                }
              : item,
          ),
        };
      }),
    );
  },

  recordExternalCandidate(requirementId: string, associateId: string) {
    const at = nowIso();
    update((s) =>
      withTessiant(s, (slice) => {
        if (slice.candidates.some((c) => c.requirementId === requirementId && c.associateId === associateId)) return slice;
        const associate = slice.associates.find((item) => item.id === associateId);
        const requirement = slice.requirements.find((item) => item.id === requirementId);
        const match =
          associate && requirement
            ? matchAssociateToRequirement(associate, requirement, {
                placements: slice.placements,
                requirements: slice.requirements,
              })
            : null;
        const candidate: RequirementCandidate = {
          id: uid("cand"),
          requirementId,
          associateId,
          matchScore: match?.matchScore ?? 0,
          matchReasons: match?.matchReasons ?? ["Manually sourced"],
          matchGaps: match?.matchGaps ?? ["Sourced outside ranked match run"],
          matchFlags: match?.matchFlags ?? ["missing_data"],
          shortlistStatus: "shortlisted",
          rankOverride: null,
          overrideReason: "Recorded as externally sourced",
          sourcedExternally: true,
          validation: {
            availabilityConfirmed: false,
            costConfirmed: false,
            indicativeCost: associate?.rate ?? null,
            notes: "",
            verifiedAt: null,
          },
          interview: { heldAt: null, outcome: "pending", summary: "" },
          quotedClientRate: null,
          rejectionReason: null,
          lastContactNote: null,
          lastContactAt: null,
          createdAt: at,
          updatedAt: at,
        };
        return pushDomainEvent(
          { ...slice, candidates: [candidate, ...slice.candidates] },
          createDomainEvent({
            eventId: `de_cand_short_${candidate.id}`,
            eventType: "candidate.shortlisted",
            entityType: "candidate",
            entityId: candidate.id,
            timestamp: at,
            actor: "You",
            payload: { requirementId, associateId, sourcedExternally: true },
          }),
        );
      }),
    );
  },

  completeCandidateValidation(candidateId: string, input: { availabilityConfirmed: boolean; costConfirmed: boolean; indicativeCost: MoneyRate | null; notes: string }) {
    const at = nowIso();
    update((s) =>
      withTessiant(s, (slice) => {
        const candidate = slice.candidates.find((item) => item.id === candidateId);
        if (!candidate) return slice;
        return pushDomainEvent(
          {
            ...slice,
            candidates: slice.candidates.map((item) =>
              item.id === candidateId
                ? {
                    ...item,
                    shortlistStatus:
                      item.shortlistStatus === "suggested" ||
                      item.shortlistStatus === "contacted" ||
                      item.shortlistStatus === "shortlisted"
                        ? "availability_confirmed"
                        : item.shortlistStatus,
                    validation: { ...input, verifiedAt: at },
                    updatedAt: at,
                  }
                : item,
            ),
          },
          createDomainEvent({
            eventId: `de_cand_val_${candidateId}_${at}`,
            eventType: "candidate.validation_completed",
            entityType: "candidate",
            entityId: candidateId,
            timestamp: at,
            actor: "You",
            payload: { requirementId: candidate.requirementId, associateId: candidate.associateId },
          }),
        );
      }),
    );
  },

  completeInterview(candidateId: string, input: { outcome: "positive" | "neutral" | "negative" | "pending"; summary: string }) {
    const at = nowIso();
    update((s) =>
      withTessiant(s, (slice) => {
        const candidate = slice.candidates.find((item) => item.id === candidateId);
        if (!candidate) return slice;
        const nextSlice = {
          ...slice,
          candidates: slice.candidates.map((item) =>
            item.id === candidateId
              ? {
                  ...item,
                  shortlistStatus: "interview" as const,
                  interview: { heldAt: at, outcome: input.outcome, summary: input.summary.trim() },
                  updatedAt: at,
                }
              : item,
          ),
        };
        return pushDomainEvents(nextSlice, [
          createDomainEvent({
            eventId: `de_cand_interviewed_${candidateId}_${at}`,
            eventType: "candidate.interviewed",
            entityType: "candidate",
            entityId: candidateId,
            timestamp: at,
            actor: "You",
            payload: {
              outcome: input.outcome,
              requirementId: candidate.requirementId,
              associateId: candidate.associateId,
              summary: "Candidate interviewed",
            },
          }),
          createDomainEvent({
            eventId: `de_interview_${candidateId}_${at}`,
            eventType: "interview.completed",
            entityType: "candidate",
            entityId: candidateId,
            timestamp: at,
            actor: "You",
            payload: { outcome: input.outcome, requirementId: candidate.requirementId, associateId: candidate.associateId },
          }),
        ]);
      }),
    );
  },

  sendQuote(candidateId: string, quotedClientRate: MoneyRate) {
    const at = nowIso();
    update((s) =>
      withTessiant(s, (slice) => {
        const candidate = slice.candidates.find((item) => item.id === candidateId);
        if (!candidate) return slice;
        const nextSlice = {
          ...slice,
          candidates: slice.candidates.map((item) =>
            item.id === candidateId ? { ...item, shortlistStatus: "offer" as const, quotedClientRate, updatedAt: at } : item,
          ),
        };
        return pushDomainEvents(nextSlice, [
          createDomainEvent({
            eventId: `de_quote_sent_${candidateId}_${at}`,
            eventType: "quote.sent",
            entityType: "candidate",
            entityId: candidateId,
            timestamp: at,
            actor: "You",
            payload: { rate: quotedClientRate, requirementId: candidate.requirementId, associateId: candidate.associateId },
          }),
          createDomainEvent({
            eventId: `de_offer_created_${candidateId}_${at}`,
            eventType: "offer.created",
            entityType: "candidate",
            entityId: candidateId,
            timestamp: at,
            actor: "You",
            payload: {
              rate: quotedClientRate,
              requirementId: candidate.requirementId,
              associateId: candidate.associateId,
              summary: "Offer / client rate created",
            },
          }),
        ]);
      }),
    );
  },

  agreeQuote(candidateId: string) {
    const at = nowIso();
    update((s) =>
      withTessiant(s, (slice) => {
        const candidate = slice.candidates.find((item) => item.id === candidateId);
        if (!candidate?.quotedClientRate) return slice;
        const nextSlice = {
          ...slice,
          candidates: slice.candidates.map((item) =>
            item.id === candidateId ? { ...item, shortlistStatus: "offer" as const, updatedAt: at } : item,
          ),
        };
        return pushDomainEvents(nextSlice, [
          createDomainEvent({
            eventId: `de_quote_agreed_${candidateId}_${at}`,
            eventType: "quote.agreed",
            entityType: "candidate",
            entityId: candidateId,
            timestamp: at,
            actor: "You",
            payload: { rate: candidate.quotedClientRate, requirementId: candidate.requirementId, associateId: candidate.associateId },
          }),
          createDomainEvent({
            eventId: `de_offer_agreed_${candidateId}_${at}`,
            eventType: "offer.agreed",
            entityType: "candidate",
            entityId: candidateId,
            timestamp: at,
            actor: "You",
            payload: {
              rate: candidate.quotedClientRate,
              requirementId: candidate.requirementId,
              associateId: candidate.associateId,
              summary: "Offer agreed",
            },
          }),
        ]);
      }),
    );
  },

  confirmPlacement(input: {
    requirementId: string;
    candidateId: string;
    terms: Placement["terms"];
    capacityPercent?: number;
    workingPattern?: Placement["workingPattern"];
  }): { ok: true; placementId: string } | { ok: false; error: string } {
    const currentState = readCrm();
    const current = currentState?.tessiant;
    if (!current || !currentState) return { ok: false, error: "Candidate or requirement missing" };
    const candidate = current.candidates.find((item) => item.id === input.candidateId);
    const requirement = current.requirements.find((item) => item.id === input.requirementId);
    if (!candidate || !requirement) return { ok: false, error: "Candidate or requirement missing" };
    const status = candidate.shortlistStatus as string;
    const placeable = ["offer", "interview", "submitted_to_client", "quoted", "selected"].includes(status);
    if (!placeable) {
      return { ok: false, error: "Progress the candidate to offer and agree commercials before confirming placement" };
    }
    if (!input.terms.clientRate || !input.terms.startDate) {
      return { ok: false, error: "Agreed client rate and start date are required" };
    }
    const existing = current.placements.find((p) => p.requirementId === input.requirementId && p.status !== "closed" && p.outcome !== "completed");
    const at = nowIso();
    const today = todayKey();
    const placementId = existing?.id ?? uid("asg");
    const start = input.terms.startDate;
    const assignmentStatus: AssignmentStatus = start > today ? "upcoming" : "active";
    const capacityPercent = input.capacityPercent ?? 100;
    const note: AssignmentNote = {
      id: uid("anote"),
      body: "Placement confirmed — assignment record activated",
      authorId: "me",
      createdAt: at,
      kind: "placement",
    };

    update((s) =>
      withTessiant(s, (slice) => {
        const base: Placement = enrichAssignmentDefaults(
          {
            id: placementId,
            requirementId: input.requirementId,
            associateId: candidate.associateId,
            candidateId: input.candidateId,
            accountId: requirement.accountId,
            roleTitle: requirement.title,
            ownerId: requirement.ownerId,
            workingPattern: input.workingPattern ?? requirement.workingMode,
            capacityPercent,
            renewalDate: input.terms.endDate,
            assignmentStatus,
            documents: existing?.documents ?? [
              {
                id: uid("adoc"),
                name: "DEMO contract pack",
                kind: "contract",
                ref: `demo://assignment/${placementId}/contract`,
                uploadedAt: at,
              },
            ],
            engagementNotes: [...(existing?.engagementNotes ?? []), note],
            followUpTaskId: existing?.followUpTaskId ?? null,
            confirmedAvailableDate: null,
            status: "confirmed",
            terms: input.terms,
            placementDate: at,
            outcome: "open",
            renewalStatus: input.terms.endDate && input.terms.endDate <= addDays(30) ? "renewal_due" : "on_track",
            createdAt: existing?.createdAt ?? at,
            updatedAt: at,
          },
          {
            accountId: requirement.accountId,
            roleTitle: requirement.title,
            ownerId: requirement.ownerId,
            workingPattern: input.workingPattern ?? requirement.workingMode,
          },
        );

        const placements = existing
          ? slice.placements.map((item) => (item.id === existing.id ? base : item))
          : [base, ...slice.placements];

        let next: TessiantStateSlice = {
          ...slice,
          placements,
          candidates: slice.candidates.map((item) =>
            item.id === input.candidateId ? { ...item, shortlistStatus: "placed", updatedAt: at } : item,
          ),
          requirements: slice.requirements.map((item) =>
            item.id === input.requirementId
              ? {
                  ...item,
                  stage: "Placed" as RequirementStage,
                  updatedAt: at,
                  stageHistory:
                    item.stage === "Placed"
                      ? item.stageHistory
                      : [...item.stageHistory, { stage: "Placed" as RequirementStage, at, actorId: "me", reason: "Placement confirmed — assignment activated" }],
                }
              : item,
          ),
        };

        next = syncAssociateAvailabilityFromAssignments(
          { ...s, tessiant: next },
          candidate.associateId,
          at,
          assignmentStatus === "active"
            ? `Availability updated for assignment ${requirement.title} (${capacityPercent}% capacity)`
            : `Upcoming assignment recorded — availability updates when engagement starts`,
        ).tessiant!;

        next = pushDomainEvent(
          next,
          createDomainEvent({
            eventId: `de_place_conf_${placementId}_${at}`,
            eventType: "placement.confirmed",
            entityType: "placement",
            entityId: placementId,
            timestamp: at,
            actor: "You",
            payload: {
              requirementId: input.requirementId,
              associateId: candidate.associateId,
              accountId: requirement.accountId,
              clientRate: input.terms.clientRate,
              startDate: input.terms.startDate,
              capacityPercent,
              assignmentStatus,
              endDate: input.terms.endDate,
              associateCost: input.terms.associateCost,
              workingPattern: input.workingPattern ?? requirement.workingMode,
              summary: `Placement confirmed · ${requirement.title}`,
            },
          }),
        );
        next = pushDomainEvent(
          next,
          createDomainEvent({
            eventId: `de_asg_act_${placementId}_${at}`,
            eventType: "assignment.activated",
            entityType: "placement",
            entityId: placementId,
            timestamp: at,
            actor: "You",
            payload: {
              assignmentStatus,
              capacityPercent,
              roleTitle: requirement.title,
              requirementId: input.requirementId,
              associateId: candidate.associateId,
              accountId: requirement.accountId,
              startDate: input.terms.startDate,
              endDate: input.terms.endDate,
              clientRate: input.terms.clientRate,
              summary: `Assignment activated · ${requirement.title}`,
            },
          }),
        );
        if (assignmentStatus === "active") {
          next = pushDomainEvent(
            next,
            createDomainEvent({
              eventId: `de_asg_started_${placementId}_${at}`,
              eventType: "assignment.started",
              entityType: "placement",
              entityId: placementId,
              timestamp: at,
              actor: "You",
              payload: {
                startDate: input.terms.startDate,
                capacityPercent,
                requirementId: input.requirementId,
                associateId: candidate.associateId,
                accountId: requirement.accountId,
                summary: `Assignment started · ${requirement.title}`,
              },
            }),
          );
        }
        if (status !== "offer" && status !== "quoted" && status !== "selected") {
          next = pushDomainEvent(
            next,
            createDomainEvent({
              eventId: `de_quote_agreed_${input.candidateId}_${at}`,
              eventType: "quote.agreed",
              entityType: "candidate",
              entityId: input.candidateId,
              timestamp: at,
              actor: "You",
              payload: { rate: input.terms.clientRate },
            }),
          );
        }
        return next;
      }),
    );

    // Renewal / redeployment follow-up when end is within 45 days
    if (input.terms.endDate && input.terms.endDate <= addDays(45)) {
      const taskId = crm.createTask(
        {
          title: `Renewal / redeployment · ${requirement.title}`,
          description: `[requirement:${requirement.id}] [assignment:${placementId}] Follow up before assignment ends ${input.terms.endDate}`,
          priority: "high",
          due: input.terms.endDate,
          ownerId: requirement.ownerId ?? "me",
          leadId: current.accounts.find((a) => a.id === requirement.accountId)?.linkedLeadId ?? null,
        },
        "manual",
        [{ label: "Assignment ending soon", source: "Tessiant assignments", kind: "fact" }],
      );
      update((s) =>
        withTessiant(s, (slice) =>
          pushDomainEvent(
            {
              ...slice,
              placements: slice.placements.map((item) =>
                item.id === placementId ? { ...item, followUpTaskId: taskId, updatedAt: nowIso() } : item,
              ),
            },
            createDomainEvent({
              eventId: `de_asg_renew_${placementId}_${nowIso()}`,
              eventType: "assignment.renewal_followup",
              entityType: "placement",
              entityId: placementId,
              timestamp: nowIso(),
              actor: "You",
              payload: { taskId, endDate: input.terms.endDate },
            }),
          ),
        ),
      );
    }

    return { ok: true, placementId };
  },

  updatePlacement(
    placementId: string,
    patch: Partial<
      Pick<
        Placement,
        | "terms"
        | "status"
        | "outcome"
        | "assignmentStatus"
        | "capacityPercent"
        | "workingPattern"
        | "renewalDate"
        | "ownerId"
        | "roleTitle"
        | "renewalStatus"
        | "confirmedAvailableDate"
      >
    >,
  ) {
    const at = nowIso();
    update((s) =>
      withTessiant(s, (slice) => {
        const placement = slice.placements.find((item) => item.id === placementId);
        if (!placement) return slice;
        const next: Placement = {
          ...placement,
          ...patch,
          terms: patch.terms ? { ...placement.terms, ...patch.terms } : placement.terms,
          updatedAt: at,
        };
        let nextSlice: TessiantStateSlice = {
          ...slice,
          placements: slice.placements.map((item) => (item.id === placementId ? next : item)),
        };
        if (patch.status === "closed" && placement.status !== "closed") {
          nextSlice = pushDomainEvent(
            nextSlice,
            createDomainEvent({
              eventId: `de_place_closed_${placementId}_${at}`,
              eventType: "placement.closed",
              entityType: "placement",
              entityId: placementId,
              timestamp: at,
              actor: "You",
              payload: { outcome: next.outcome },
            }),
          );
        }
        nextSlice = syncAssociateAvailabilityFromAssignments(
          { ...s, tessiant: nextSlice },
          placement.associateId,
          at,
          "Availability refreshed after assignment update",
        ).tessiant!;
        return nextSlice;
      }),
    );
  },

  extendAssignment(
    placementId: string,
    input: { endDate: string; renewalDate?: string | null; note?: string },
  ): { ok: true } | { ok: false; error: string } {
    const current = readCrm()?.tessiant?.placements.find((item) => item.id === placementId);
    if (!current) return { ok: false, error: "Assignment not found" };
    if (!input.endDate) return { ok: false, error: "End date is required" };
    if (current.terms.startDate && input.endDate < current.terms.startDate) {
      return { ok: false, error: "End date must be on or after the start date" };
    }
    const at = nowIso();
    update((s) =>
      withTessiant(s, (slice) => {
        const placement = slice.placements.find((item) => item.id === placementId);
        if (!placement) return slice;
        const note: AssignmentNote = {
          id: uid("anote"),
          body: input.note?.trim() || `Assignment extended to ${input.endDate}`,
          authorId: "me",
          createdAt: at,
          kind: "renewal",
        };
        const next: Placement = {
          ...placement,
          assignmentStatus: "extended",
          renewalDate: input.renewalDate ?? input.endDate,
          renewalStatus: "on_track",
          terms: { ...placement.terms, endDate: input.endDate },
          engagementNotes: [...(placement.engagementNotes ?? []), note],
          updatedAt: at,
        };
        let nextSlice: TessiantStateSlice = {
          ...slice,
          placements: slice.placements.map((item) => (item.id === placementId ? next : item)),
        };
        nextSlice = pushDomainEvent(
          nextSlice,
          createDomainEvent({
            eventId: `de_asg_ext_${placementId}_${at}`,
            eventType: "assignment.extended",
            entityType: "placement",
            entityId: placementId,
            timestamp: at,
            actor: "You",
            payload: {
              endDate: input.endDate,
              renewalDate: next.renewalDate,
              accountId: next.accountId,
              associateId: next.associateId,
              requirementId: next.requirementId,
              capacityPercent: next.capacityPercent ?? 100,
              summary: `Assignment extended · ${next.roleTitle ?? placementId}`,
            },
          }),
        );
        return nextSlice;
      }),
    );
    return { ok: true };
  },

  completeAssignment(placementId: string, input: { confirmedAvailableDate: string; note?: string; outcome?: "completed" | "ended_early" }) {
    const at = nowIso();
    if (!input.confirmedAvailableDate) return;
    update((s) =>
      withTessiant(s, (slice) => {
        const placement = slice.placements.find((item) => item.id === placementId);
        if (!placement) return slice;
        const note: AssignmentNote = {
          id: uid("anote"),
          body: input.note?.trim() || `Assignment completed — available from ${input.confirmedAvailableDate}`,
          authorId: "me",
          createdAt: at,
          kind: "status",
        };
        const next: Placement = {
          ...placement,
          status: "closed",
          outcome: input.outcome ?? "completed",
          assignmentStatus: "completed",
          confirmedAvailableDate: input.confirmedAvailableDate,
          terms: {
            ...placement.terms,
            endDate: placement.terms.endDate && placement.terms.endDate < input.confirmedAvailableDate ? placement.terms.endDate : input.confirmedAvailableDate,
          },
          engagementNotes: [...(placement.engagementNotes ?? []), note],
          updatedAt: at,
        };
        let nextSlice: TessiantStateSlice = {
          ...slice,
          placements: slice.placements.map((item) => (item.id === placementId ? next : item)),
          associates: slice.associates.map((associate) => {
            if (associate.id !== placement.associateId) return associate;
            return {
              ...associate,
              availability: "available",
              nextAvailableDate: input.confirmedAvailableDate,
              notes: `${associate.notes} Assignment ${placementId} completed; availability confirmed from ${input.confirmedAvailableDate}.`.trim(),
              tags: associate.tags.filter((tag) => tag !== "deployed"),
            };
          }),
        };
        // Recompute if other live assignments remain
        nextSlice = syncAssociateAvailabilityFromAssignments(
          { ...s, tessiant: nextSlice },
          placement.associateId,
          at,
          `Availability set from confirmed date ${input.confirmedAvailableDate}`,
        ).tessiant!;

        nextSlice = pushDomainEvent(
          nextSlice,
          createDomainEvent({
            eventId: `de_asg_done_${placementId}_${at}`,
            eventType: "assignment.completed",
            entityType: "placement",
            entityId: placementId,
            timestamp: at,
            actor: "You",
            payload: {
              confirmedAvailableDate: input.confirmedAvailableDate,
              outcome: next.outcome,
              accountId: next.accountId,
              associateId: next.associateId,
              requirementId: next.requirementId,
              capacityPercent: next.capacityPercent ?? 100,
              endDate: next.terms.endDate,
              summary: `Assignment completed · redeployment available from ${input.confirmedAvailableDate}`,
            },
          }),
        );
        nextSlice = pushDomainEvent(
          nextSlice,
          createDomainEvent({
            eventId: `de_place_closed_${placementId}_${at}`,
            eventType: "placement.closed",
            entityType: "placement",
            entityId: placementId,
            timestamp: at,
            actor: "You",
            payload: {
              outcome: next.outcome,
              accountId: next.accountId,
              associateId: next.associateId,
              requirementId: next.requirementId,
            },
          }),
        );
        return nextSlice;
      }),
    );
  },

  cancelAssignment(placementId: string, reason: string) {
    const at = nowIso();
    update((s) =>
      withTessiant(s, (slice) => {
        const placement = slice.placements.find((item) => item.id === placementId);
        if (!placement) return slice;
        const note: AssignmentNote = {
          id: uid("anote"),
          body: reason.trim() || "Assignment cancelled",
          authorId: "me",
          createdAt: at,
          kind: "status",
        };
        const next: Placement = {
          ...placement,
          status: "closed",
          outcome: "ended_early",
          assignmentStatus: "cancelled",
          engagementNotes: [...(placement.engagementNotes ?? []), note],
          updatedAt: at,
        };
        let nextSlice: TessiantStateSlice = {
          ...slice,
          placements: slice.placements.map((item) => (item.id === placementId ? next : item)),
        };
        nextSlice = syncAssociateAvailabilityFromAssignments(
          { ...s, tessiant: nextSlice },
          placement.associateId,
          at,
          "Availability refreshed after cancellation",
        ).tessiant!;
        nextSlice = pushDomainEvent(
          nextSlice,
          createDomainEvent({
            eventId: `de_asg_cancel_${placementId}_${at}`,
            eventType: "assignment.cancelled",
            entityType: "placement",
            entityId: placementId,
            timestamp: at,
            actor: "You",
            payload: { reason: reason.trim() },
          }),
        );
        return nextSlice;
      }),
    );
  },

  addAssignmentNote(placementId: string, body: string, kind: AssignmentNote["kind"] = "note") {
    const at = nowIso();
    update((s) =>
      withTessiant(s, (slice) => ({
        ...slice,
        placements: slice.placements.map((item) =>
          item.id === placementId
            ? {
                ...item,
                engagementNotes: [
                  ...(item.engagementNotes ?? []),
                  { id: uid("anote"), body: body.trim(), authorId: "me", createdAt: at, kind },
                ],
                updatedAt: at,
              }
            : item,
        ),
      })),
    );
  },

  ensureAssignmentRenewalFollowUp(placementId: string): string | null {
    const current = readCrm();
    const placement = current?.tessiant?.placements.find((item) => item.id === placementId);
    if (!current?.tessiant || !placement?.terms.endDate) return null;
    if (placement.followUpTaskId) return placement.followUpTaskId;
    const req = current.tessiant.requirements.find((item) => item.id === placement.requirementId);
    const account = current.tessiant.accounts.find((item) => item.id === (placement.accountId ?? req?.accountId));
    const taskId = crm.createTask(
      {
        title: `Renewal decision · ${placement.roleTitle ?? req?.title ?? "assignment"}`,
        description: `[requirement:${placement.requirementId}] [assignment:${placement.id}] Renewal / redeployment follow-up before ${placement.terms.endDate}`,
        priority: "high",
        due: placement.terms.endDate,
        ownerId: placement.ownerId ?? req?.ownerId ?? "me",
        leadId: account?.linkedLeadId ?? null,
      },
      "manual",
      [{ label: "Pending renewal", source: "Tessiant assignments", kind: "fact" }],
    );
    update((s) =>
      withTessiant(s, (slice) =>
        pushDomainEvent(
          {
            ...slice,
            placements: slice.placements.map((item) =>
              item.id === placementId ? { ...item, followUpTaskId: taskId, renewalStatus: "renewal_due", updatedAt: nowIso() } : item,
            ),
          },
          createDomainEvent({
            eventId: `de_asg_renew_${placementId}_${nowIso()}`,
            eventType: "assignment.renewal_followup",
            entityType: "placement",
            entityId: placementId,
            timestamp: nowIso(),
            actor: "You",
            payload: { taskId, endDate: placement.terms.endDate },
          }),
        ),
      ),
    );
    return taskId;
  },

  updateAccountOwners(accountId: string, primaryOwnerId: string | null, secondaryOwnerId: string | null) {
    const at = nowIso();
    update((s) =>
      withTessiant(s, (slice) =>
        pushDomainEvent(
          {
            ...slice,
            accounts: slice.accounts.map((item) =>
              item.id === accountId ? { ...item, primaryOwnerId, secondaryOwnerId } : item,
            ),
          },
          createDomainEvent({
            eventId: `de_acc_owners_${accountId}_${at}`,
            eventType: "account.relationship_owner_changed",
            entityType: "account",
            entityId: accountId,
            timestamp: at,
            actor: "You",
            payload: {
              primaryOwnerId,
              secondaryOwnerId,
              summary: "Account relationship owners updated",
            },
          }),
        ),
      ),
    );
  },

  /** Client feedback on account / assignment — structured Pulse event, demo-persisted only. */
  recordClientFeedback(input: {
    accountId: string;
    body: string;
    placementId?: string | null;
    requirementId?: string | null;
    sentiment?: "positive" | "neutral" | "negative";
  }): { ok: true; eventId: string } | { ok: false; error: string } {
    const body = input.body.trim();
    if (body.length < 3) return { ok: false, error: "Add a short feedback note" };
    const current = readCrm();
    const account = current?.tessiant?.accounts.find((item) => item.id === input.accountId);
    if (!account) return { ok: false, error: "Account not found" };
    const at = nowIso();
    const eventId = `de_client_feedback_${input.accountId}_${at}`;
    update((s) => {
      let next = appendDomain(
        s,
        createDomainEvent({
          eventId,
          eventType: "client.feedback_recorded",
          entityType: "account",
          entityId: input.accountId,
          timestamp: at,
          actor: "You",
          payload: {
            body,
            sentiment: input.sentiment ?? "neutral",
            placementId: input.placementId ?? null,
            requirementId: input.requirementId ?? null,
            summary: `Client feedback · ${account.name}`,
          },
        }),
      );
      next = {
        ...next,
        notes: [
          {
            id: uid("note"),
            leadId: account.linkedLeadId ?? input.accountId,
            accountId: input.accountId,
            body: `Client feedback (${input.sentiment ?? "neutral"}): ${body}`,
            authorId: "me",
            createdAt: at,
            opportunityId: null,
            contactId: null,
          },
          ...next.notes,
        ],
        events: [
          crmEvent(account.linkedLeadId ?? input.accountId, "note", "Client feedback recorded", body, {
            accountId: input.accountId,
            activityType: "note",
          }),
          ...next.events,
        ],
      };
      if (input.placementId && next.tessiant) {
        next = {
          ...next,
          tessiant: {
            ...next.tessiant,
            placements: next.tessiant.placements.map((item) =>
              item.id === input.placementId
                ? {
                    ...item,
                    engagementNotes: [
                      ...(item.engagementNotes ?? []),
                      {
                        id: uid("anote"),
                        body,
                        authorId: "me",
                        createdAt: at,
                        kind: "feedback" as const,
                      },
                    ],
                    updatedAt: at,
                  }
                : item,
            ),
          },
        };
      }
      return next;
    });
    return { ok: true, eventId };
  },

  addAssociateNote(associateId: string, body: string, kind: AssociateActivityNote["kind"] = "note") {
    const at = nowIso();
    update((s) =>
      withTessiant(s, (slice) => ({
        ...slice,
        associates: slice.associates.map((associate) => {
          if (associate.id !== associateId) return associate;
          const note: AssociateActivityNote = {
            id: uid("an"),
            body: body.trim(),
            authorId: "me",
            createdAt: at,
            kind,
          };
          return {
            ...ensureTalentProfile(associate),
            activityNotes: [note, ...(associate.activityNotes ?? [])],
            profileUpdatedAt: at,
            notes: kind === "note" ? body.trim() : associate.notes,
          };
        }),
      })),
    );
  },

  replaceAssociateCv(associateId: string, name: string) {
    const at = nowIso();
    update((s) =>
      withTessiant(s, (slice) => ({
        ...slice,
        associates: slice.associates.map((associate) => {
          if (associate.id !== associateId) return associate;
          const current = ensureTalentProfile(associate);
          const version = Math.max(0, ...(current.documents ?? []).filter((doc) => doc.kind === "cv").map((doc) => doc.version)) + 1;
          const doc: AssociateDocument = {
            id: uid("doc"),
            kind: "cv",
            name: name.trim() || `${associate.name} CV v${version}`,
            ref: `demo://cv/${associate.id}-v${version}`,
            uploadedAt: at,
            verifiedAt: at,
            version,
          };
          return {
            ...current,
            cvRef: doc.ref,
            documents: [doc, ...(current.documents ?? [])],
            profileUpdatedAt: at,
            verifiedAt: current.verifiedAt ?? at,
          };
        }),
      })),
    );
  },

  // — Tessiant Pulse intelligence ——————————————————————————

  acceptPulseInsight(insight: {
    id: string;
    title: string;
    summary: string;
    recommendedAction: { label: string; suggestedOwnerId?: string };
    evidence: { entityType: string; entityId: string; href?: string }[];
  }): string {
    const accountEvidenceId = insight.evidence.find((item) => item.entityType === "account")?.entityId;
    const leadId = accountEvidenceId
      ? readCrm()?.tessiant?.accounts.find((account) => account.id === accountEvidenceId)?.linkedLeadId ?? null
      : null;
    const reqEvidence = insight.evidence.find((item) => item.entityType === "requirement");
    const description = [
      `[pulse-insight:${insight.id}]`,
      reqEvidence ? `[requirement:${reqEvidence.entityId}]` : "",
      insight.summary,
      `Recommended: ${insight.recommendedAction.label}`,
      "DEMO — feedback captured for future rule review; no automatic model training claimed.",
    ]
      .filter(Boolean)
      .join("\n");
    const taskId = crm.createTask(
      {
        title: insight.recommendedAction.label.slice(0, 120) || insight.title,
        description,
        priority: "high",
        due: (() => {
          const d = new Date();
          d.setDate(d.getDate() + 2);
          return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        })(),
        ownerId: insight.recommendedAction.suggestedOwnerId ?? "me",
        leadId: leadId ?? null,
      },
      "suggestion",
      insight.evidence.slice(0, 6).map((item) => ({
        label: `${item.entityType}:${item.entityId}`,
        detail: item.href,
        source: "Tessiant Pulse",
        kind: "fact" as const,
      })),
    );
    const at = nowIso();
    update((s) =>
      withTessiant(s, (slice) => ({
        ...slice,
        pulse: {
          reviews: {
            ...(slice.pulse?.reviews ?? {}),
            [insight.id]: { insightId: insight.id, decision: "accepted", at, reviewerId: "me", taskId },
          },
          outcomes: slice.pulse?.outcomes ?? [],
          attributedSourceKeys: slice.pulse?.attributedSourceKeys ?? [],
        },
      })),
    );
    return taskId;
  },

  rejectPulseInsight(insightId: string, reason: string) {
    const at = nowIso();
    update((s) =>
      withTessiant(s, (slice) => ({
        ...slice,
        pulse: {
          reviews: {
            ...(slice.pulse?.reviews ?? {}),
            [insightId]: {
              insightId,
              decision: "rejected",
              at,
              reviewerId: "me",
              reason: reason.trim() || "Not relevant",
            },
          },
          outcomes: slice.pulse?.outcomes ?? [],
          attributedSourceKeys: slice.pulse?.attributedSourceKeys ?? [],
        },
      })),
    );
  },

  recordPulseOutcome(input: {
    insightId: string;
    taskId: string | null;
    status: import("./tessiant-pulse-types").PulseOutcomeStatus;
    summary: string;
    realisedRevenue?: number | null;
    pipelinePotential?: number | null;
    estimatedTimeSavedHours?: number | null;
    qualitativeBenefit?: string | null;
    sourceEntityIds: string[];
  }) {
    const at = nowIso();
    update((s) =>
      withTessiant(s, (slice) => {
        const pulse = slice.pulse ?? emptyPulse();
        const attributionKey = `insight:${input.insightId}`;
        const already = pulse.attributedSourceKeys.includes(attributionKey);
        let realised = input.realisedRevenue ?? null;
        let pipeline = input.pipelinePotential ?? null;
        if (already) {
          // No double counting financial value for the same insight.
          realised = null;
          pipeline = null;
        }
        const existing = pulse.outcomes.find((item) => item.insightId === input.insightId);
        const outcome = {
          id: existing?.id ?? uid("pout"),
          insightId: input.insightId,
          taskId: input.taskId,
          status: input.status,
          summary: input.summary.trim(),
          value: {
            realisedRevenue: realised,
            pipelinePotential: pipeline,
            estimatedTimeSavedHours: input.estimatedTimeSavedHours ?? null,
            directCostSavings: null,
            qualitativeBenefit: input.qualitativeBenefit ?? null,
            currency: "GBP" as const,
            notes: already
              ? "DEMO — financial fields suppressed to avoid double counting prior attribution"
              : "DEMO — attribution from Tessiant Pulse outcome",
            sourceEntityIds: input.sourceEntityIds,
          },
          createdAt: existing?.createdAt ?? at,
          updatedAt: at,
        };
        const outcomes = existing
          ? pulse.outcomes.map((item) => (item.id === existing.id ? outcome : item))
          : [outcome, ...pulse.outcomes];
        const attributedSourceKeys =
          already || (realised == null && pipeline == null)
            ? pulse.attributedSourceKeys
            : [...pulse.attributedSourceKeys, attributionKey];
        if (input.taskId && input.status === "completed") {
          const task = s.tasks.find((item) => item.id === input.taskId);
          if (task && task.status !== "completed") {
            // mark via separate path after write — handled below
          }
        }
        return {
          ...slice,
          pulse: {
            reviews: pulse.reviews,
            outcomes,
            attributedSourceKeys,
          },
        };
      }),
    );
    if (input.taskId && input.status === "completed") {
      const task = readCrm()?.tasks.find((item) => item.id === input.taskId);
      if (task && task.status !== "completed") crm.setTaskStatus(input.taskId, "completed");
    }
  },
};
