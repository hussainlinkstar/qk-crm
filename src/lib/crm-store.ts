"use client";

// Client-side CRM store backed by localStorage. All mutations go through `crm.*` actions,
// which keeps screens independent of where data lives (demo provider today, API later).

import { useSyncExternalStore } from "react";
import { createDemoState, DATA_VERSION, demoMessages } from "@/data/demo-seed";
import type { ActivityEvent, ConversationChannel, CrmState, Lead, LeadStatus, Member, Priority, Session, Suggestion, Task, TaskStatus } from "./types";
import { uid } from "./format";

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

function readCrm(): CrmState | null {
  if (state) return state;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as CrmState) : null;
    if (parsed && parsed.version === DATA_VERSION) {
      state = Array.isArray(parsed.messages) ? parsed : { ...parsed, messages: demoMessages((hours) => new Date(Date.now() - hours * 3_600_000).toISOString()).filter((message) => parsed.leads.some((lead) => lead.id === message.leadId)) };
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

function crmEvent(leadId: string, kind: ActivityEvent["kind"], title: string, detail?: string): ActivityEvent {
  return { id: uid("ev"), leadId, kind, title, detail, occurredAt: nowIso(), source: "Qiko Core", actor: "You" };
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
    update((s) => ({
      ...s,
      leads: [{ ...input, id, createdAt: nowIso(), nextAction: null }, ...s.leads],
      events: [crmEvent(id, "lead_created", "Lead added manually", `Source: ${input.source}`), ...s.events],
      notes: note?.trim() ? [{ id: uid("note"), leadId: id, body: note.trim(), authorId: "me", createdAt: nowIso() }, ...s.notes] : s.notes,
    }));
    return { ok: true, id };
  },

  updateLead(leadId: string, patch: Partial<Omit<Lead, "id" | "createdAt">>) {
    update((s) => {
      const lead = s.leads.find((item) => item.id === leadId);
      if (!lead) return s;
      const newEvents: ActivityEvent[] = [];
      if (patch.status && patch.status !== lead.status) newEvents.push(crmEvent(leadId, "status_change", `Status changed to ${patch.status}`, `${lead.status} → ${patch.status}`));
      if (patch.ownerId !== undefined && patch.ownerId !== lead.ownerId) {
        newEvents.push(crmEvent(leadId, "owner_change", `Owner changed to ${patch.ownerId ? actorName(s, patch.ownerId) : "Unassigned"}`));
      }
      return { ...s, leads: s.leads.map((item) => (item.id === leadId ? { ...item, ...patch } : item)), events: [...newEvents, ...s.events] };
    });
  },

  setLeadStatus(leadId: string, status: LeadStatus) {
    crm.updateLead(leadId, { status });
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
        leads: s.leads.map((item) => item.id === leadId ? { ...item, status: contacted ? "Contacted" as LeadStatus : item.status, phone: input.channel === "whatsapp" ? address : item.phone } : item),
        messages: [{ id: uid("msg"), leadId, channel: input.channel, direction: "out" as const, address, subject, body, at: nowIso(), actor: "You" }, ...(s.messages ?? [])],
        events: [crmEvent(leadId, "interaction", title, detail), ...(contacted ? [crmEvent(leadId, "status_change", "Status changed to Contacted", "New → Contacted (after first message)")] : []), ...s.events],
      };
    });
  },

  logInteraction(leadId: string, channel: string, summary: string) {
    update((s) => {
      const lead = s.leads.find((item) => item.id === leadId);
      const leads = lead && lead.status === "New" ? s.leads.map((item) => (item.id === leadId ? { ...item, status: "Contacted" as LeadStatus } : item)) : s.leads;
      const extra = lead && lead.status === "New" ? [crmEvent(leadId, "status_change", "Status changed to Contacted", "New → Contacted (after first interaction)")] : [];
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
};
