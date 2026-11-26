"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import Button from "@/components/ui/Button";
import Select from "@/components/ui/Select";
import { Modal } from "@/components/ui/Overlay";
import { useWorkspace } from "@/components/shell/WorkspaceContext";
import { growth } from "@/lib/signal-growth/store";
import type { Owner } from "@/lib/signal-growth/types";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export default function AddSignalLeadModal({ owners, onClose }: { owners: Owner[]; onClose: () => void }) {
  const router = useRouter();
  const { toast } = useWorkspace();
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", company: "", website: "", country: "UAE", industry: "E-commerce", title: "", ownerId: owners[0]?.id ?? "" });
  const [errors, setErrors] = useState<{ name?: string; email?: string }>({});
  const [duplicate, setDuplicate] = useState("");

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const next: typeof errors = {};
    if (`${form.firstName} ${form.lastName}`.trim().length < 2) next.name = "Enter the lead's name.";
    if (!EMAIL.test(form.email.trim())) next.email = "Enter a valid email address.";
    setErrors(next);
    if (Object.keys(next).length) return;
    const result = growth.addLead({ ...form, ownerId: form.ownerId || null, source: "Manual" });
    if (!result.imported) {
      setDuplicate(result.message);
      return;
    }
    toast(result.message);
    onClose();
    router.push("/growth/leads");
  };

  return (
    <Modal
      kicker="Lead intake"
      title="Add lead"
      description="One record per email or company domain. A match never creates a second lead."
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="add-signal-lead" icon="userPlus">Add lead</Button>
        </>
      }
    >
      <form id="add-signal-lead" className="form-grid" onSubmit={submit} noValidate>
        <div className="form-row">
          <label className="field">
            <span>First name <b className="required-mark">*</b></span>
            <input className="input" value={form.firstName} onChange={(event) => setForm({ ...form, firstName: event.target.value })} aria-invalid={Boolean(errors.name)} />
            {errors.name && <span className="field-error">{errors.name}</span>}
          </label>
          <label className="field">
            <span>Last name</span>
            <input className="input" value={form.lastName} onChange={(event) => setForm({ ...form, lastName: event.target.value })} />
          </label>
        </div>
        {duplicate && (
          <div className="demo-banner" role="alert">
            {duplicate} <Link href="/growth/leads" onClick={onClose}>Back to the list</Link>
          </div>
        )}
        <div className="form-row">
          <label className="field">
            <span>Email <b className="required-mark">*</b></span>
            <input className="input" type="email" value={form.email} onChange={(event) => { setForm({ ...form, email: event.target.value }); setDuplicate(""); }} aria-invalid={Boolean(errors.email || duplicate)} />
            {errors.email && <span className="field-error">{errors.email}</span>}
          </label>
          <label className="field">
            <span>Company</span>
            <input className="input" value={form.company} onChange={(event) => setForm({ ...form, company: event.target.value })} />
          </label>
        </div>
        <div className="form-row">
          <label className="field">
            <span>Website</span>
            <input className="input" value={form.website} onChange={(event) => setForm({ ...form, website: event.target.value })} placeholder="https://" />
          </label>
          <label className="field">
            <span>Job title</span>
            <input className="input" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />
          </label>
        </div>
        <div className="form-row">
          <label className="field">
            <span>Country</span>
            <input className="input" value={form.country} onChange={(event) => setForm({ ...form, country: event.target.value })} />
          </label>
          <label className="field">
            <span>Industry</span>
            <input className="input" value={form.industry} onChange={(event) => setForm({ ...form, industry: event.target.value })} />
          </label>
        </div>
        <label className="field">
          <span>Owner</span>
          <Select className="select" value={form.ownerId} onChange={(event) => setForm({ ...form, ownerId: event.target.value })}>
            {owners.map((owner) => <option key={owner.id} value={owner.id}>{owner.name}</option>)}
          </Select>
        </label>
      </form>
    </Modal>
  );
}
