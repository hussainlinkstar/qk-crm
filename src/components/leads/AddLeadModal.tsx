"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { crm } from "@/lib/crm-store";
import { LEAD_SOURCES, LEAD_STATUSES, type LeadSource, type LeadStatus } from "@/lib/types";
import Button from "@/components/ui/Button";
import { Modal } from "@/components/ui/Overlay";
import { useWorkspaceData } from "@/components/ui/bits";
import { useWorkspace } from "@/components/shell/WorkspaceContext";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export default function AddLeadModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const { state } = useWorkspaceData();
  const { toast } = useWorkspace();
  const [form, setForm] = useState({ name: "", email: "", phone: "", company: "", role: "", source: "Manual entry" as LeadSource, status: "New" as LeadStatus, ownerId: "me", note: "" });
  const [errors, setErrors] = useState<{ name?: string; email?: string }>({});
  const [duplicateId, setDuplicateId] = useState<string | null>(null);
  if (!state) return null;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const next: typeof errors = {};
    if (form.name.trim().length < 2) next.name = "Enter the lead's full name.";
    if (!EMAIL.test(form.email.trim())) next.email = "Enter a valid email address.";
    setErrors(next);
    if (Object.keys(next).length) return;
    const result = crm.addLead(
      { name: form.name.trim(), email: form.email.trim().toLowerCase(), phone: form.phone.trim() || null, company: form.company.trim() || null, role: form.role.trim() || null, source: form.source, status: form.status, ownerId: form.ownerId || null },
      form.note,
    );
    if (!result.ok) {
      setDuplicateId(result.existingId);
      return;
    }
    toast(`${form.name.trim()} added to your CRM`);
    onClose();
    router.push(`/sales/leads/${result.id}`);
  };

  const set = (key: keyof typeof form, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
    if (key === "email") setDuplicateId(null);
  };
  const duplicate = duplicateId ? state.leads.find((lead) => lead.id === duplicateId) : null;

  return (
    <Modal
      kicker="New CRM record"
      title="Add lead"
      description="Leads are matched by email, so the same person never appears twice."
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="add-lead-form" icon="userPlus">Add lead</Button>
        </>
      }
    >
      <form id="add-lead-form" className="form-grid" onSubmit={submit} noValidate>
        <div className="form-row">
          <label className="field">
            <span>Full name</span>
            <input className="input" value={form.name} onChange={(event) => set("name", event.target.value)} placeholder="Alex Morgan" aria-invalid={Boolean(errors.name)} autoComplete="off" />
            {errors.name && <span className="field-error">{errors.name}</span>}
          </label>
          <label className="field">
            <span>Email</span>
            <input className="input" type="email" value={form.email} onChange={(event) => set("email", event.target.value)} placeholder="alex@company.com" aria-invalid={Boolean(errors.email || duplicate)} autoComplete="off" />
            {errors.email && <span className="field-error">{errors.email}</span>}
          </label>
        </div>
        {duplicate && (
          <div className="demo-banner" role="alert">
            This email already belongs to <b>&nbsp;{duplicate.name}</b>.&nbsp;
            <Link href={`/sales/leads/${duplicate.id}`} onClick={onClose}>Open existing record</Link>
          </div>
        )}
        <div className="form-row">
          <label className="field">
            <span>Company</span>
            <input className="input" value={form.company} onChange={(event) => set("company", event.target.value)} placeholder="Company or brand" />
          </label>
          <label className="field">
            <span>Job title</span>
            <input className="input" value={form.role} onChange={(event) => set("role", event.target.value)} placeholder="Optional" />
          </label>
        </div>
        <div className="form-row">
          <label className="field">
            <span>Phone</span>
            <input className="input" type="tel" value={form.phone} onChange={(event) => set("phone", event.target.value)} placeholder="Optional" />
          </label>
          <label className="field">
            <span>Source</span>
            <select className="select" value={form.source} onChange={(event) => set("source", event.target.value)}>
              {LEAD_SOURCES.map((source) => <option key={source}>{source}</option>)}
            </select>
          </label>
        </div>
        <div className="form-row">
          <label className="field">
            <span>Status</span>
            <select className="select" value={form.status} onChange={(event) => set("status", event.target.value)}>
              {LEAD_STATUSES.map((status) => <option key={status}>{status}</option>)}
            </select>
          </label>
          <label className="field">
            <span>Owner</span>
            <select className="select" value={form.ownerId} onChange={(event) => set("ownerId", event.target.value)}>
              <option value="">Unassigned</option>
              {state.members.map((member) => <option key={member.id} value={member.id}>{member.id === "me" ? `${member.name} (you)` : member.name}</option>)}
            </select>
          </label>
        </div>
        <label className="field">
          <span>First note</span>
          <textarea className="textarea" rows={2} value={form.note} onChange={(event) => set("note", event.target.value)} placeholder="Where you met, what they need… (optional)" />
        </label>
      </form>
    </Modal>
  );
}
