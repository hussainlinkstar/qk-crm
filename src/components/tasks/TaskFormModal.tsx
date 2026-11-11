"use client";

import { useState, type FormEvent } from "react";
import { crm, type TaskInput } from "@/lib/crm-store";
import { addDays } from "@/lib/format";
import { PRIORITIES, type Priority } from "@/lib/types";
import Button from "@/components/ui/Button";
import { Modal } from "@/components/ui/Overlay";
import { EvidenceList, useWorkspaceData } from "@/components/ui/bits";
import { useWorkspace, type TaskFormRequest } from "@/components/shell/WorkspaceContext";

export default function TaskFormModal({ request, onClose }: { request: TaskFormRequest; onClose: () => void }) {
  const { state } = useWorkspaceData();
  const { toast } = useWorkspace();
  const initial = request.initial ?? {};
  const [form, setForm] = useState<TaskInput>({
    title: initial.title ?? "",
    description: initial.description ?? "",
    priority: initial.priority ?? "medium",
    due: initial.due === undefined ? addDays(1) : initial.due,
    ownerId: initial.ownerId === undefined ? "me" : initial.ownerId,
    leadId: initial.leadId ?? null,
    accountId: initial.accountId ?? null,
    opportunityId: initial.opportunityId ?? null,
  });
  const [error, setError] = useState("");

  if (!state) return null;
  const leads = [...state.leads].sort((a, b) => a.name.localeCompare(b.name));

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (form.title.trim().length < 3) {
      setError("Give the task a short, descriptive title.");
      return;
    }
    const id = crm.createTask(form, request.origin ?? "manual", request.evidence ?? []);
    toast("Task created");
    request.onCreated?.(id);
    onClose();
  };

  const set = <K extends keyof TaskInput>(key: K, value: TaskInput[K]) => setForm((current) => ({ ...current, [key]: value }));

  return (
    <Modal
      kicker={request.origin === "suggestion" ? "Edit suggestion" : request.origin === "copilot" ? "From Ask Qiko" : "New task"}
      title={request.title ?? "Create task"}
      description="Tasks keep an owner, priority, due date, linked lead and full completion history."
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="task-form" icon="check">Create task</Button>
        </>
      }
    >
      <form id="task-form" className="form-grid" onSubmit={submit} noValidate>
        <label className="field">
          <span>Title</span>
          <input className="input" value={form.title} onChange={(event) => { set("title", event.target.value); setError(""); }} placeholder="e.g. Call Marcus about his enquiry" aria-invalid={Boolean(error)} data-autofocus />
          {error && <span className="field-error">{error}</span>}
        </label>
        <label className="field">
          <span>Description</span>
          <textarea className="textarea" rows={3} value={form.description} onChange={(event) => set("description", event.target.value)} placeholder="Context, talking points or the outcome you're after" />
        </label>
        <label className="field">
          <span>Linked lead</span>
          <select className="select" value={form.leadId ?? ""} onChange={(event) => set("leadId", event.target.value || null)}>
            <option value="">No linked lead</option>
            {leads.map((lead) => (
              <option key={lead.id} value={lead.id}>
                {lead.name}{lead.company ? ` — ${lead.company}` : ""}
              </option>
            ))}
          </select>
        </label>
        <div className="form-row">
          <label className="field">
            <span>Owner</span>
            <select className="select" value={form.ownerId ?? ""} onChange={(event) => set("ownerId", event.target.value || null)}>
              <option value="">Unassigned</option>
              {state.members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.id === "me" ? `${member.name} (you)` : member.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Priority</span>
            <select className="select" value={form.priority} onChange={(event) => set("priority", event.target.value as Priority)}>
              {PRIORITIES.map((priority) => (
                <option key={priority} value={priority}>
                  {priority[0].toUpperCase() + priority.slice(1)}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="field">
          <span>Due date</span>
          <input className="input" type="date" value={form.due ?? ""} onChange={(event) => set("due", event.target.value || null)} />
        </label>
        {request.evidence && request.evidence.length > 0 && (
          <div className="field">
            <span className="field-label">Supporting evidence</span>
            <EvidenceList items={request.evidence} compact />
          </div>
        )}
      </form>
    </Modal>
  );
}
