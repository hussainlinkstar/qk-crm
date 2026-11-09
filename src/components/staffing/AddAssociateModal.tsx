"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";
import { Modal } from "@/components/ui/Overlay";
import { useWorkspace } from "@/components/shell/WorkspaceContext";
import { crm } from "@/lib/crm-store";
import { uniqueSkillLabels, specialisationsBeyondSkills } from "@/lib/talent-network";
import type { AssociateRoleType, SeniorityLevel, WorkingMode } from "@/lib/tessiant-types";
import staffing from "@/app/(workspace)/staffing/staffing.module.css";

const empty = {
  name: "",
  headline: "",
  roleType: "consultant" as AssociateRoleType,
  seniority: "senior" as SeniorityLevel,
  skills: "",
  specialisations: "",
  sectors: "",
  location: "UK hybrid",
  workingMode: "hybrid" as WorkingMode,
  rateAmount: "",
  email: "",
  phone: "",
  notes: "",
};

export default function AddAssociateModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (associateId: string) => void;
}) {
  const { toast } = useWorkspace();
  const [form, setForm] = useState(empty);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const submit = () => {
    const skills = uniqueSkillLabels(form.skills.split(","));
    const specialisations = specialisationsBeyondSkills(skills, form.specialisations.split(","));
    const sectors = uniqueSkillLabels(form.sectors.split(","));
    const nextErrors: Record<string, string> = {};
    if (!form.name.trim()) nextErrors.name = "Name is required";
    if (!form.headline.trim()) nextErrors.headline = "Role title is required";
    if (!skills.length) nextErrors.skills = "Add at least one skill";
    if (!sectors.length) nextErrors.sectors = "Add at least one sector";
    if (!form.location.trim()) nextErrors.location = "Location is required";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      toast("Fix the highlighted fields", "error");
      return;
    }
    const id = crm.createAssociate({
      name: form.name.trim(),
      headline: form.headline.trim(),
      roleType: form.roleType,
      seniority: form.seniority,
      skills,
      specialisations,
      sectors,
      location: form.location.trim(),
      workingMode: form.workingMode,
      rateAmount: form.rateAmount ? Number(form.rateAmount) : null,
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      notes: form.notes.trim(),
      availability: "available",
    });
    toast("Associate added to Talent Network", "success");
    onCreated(id);
  };

  return (
    <Modal
      kicker="Talent Network"
      title="Add associate"
      description="Capture core staffing fields. Skills and specialisations are stored without duplicates."
      onClose={onClose}
      size="large"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button icon="plus" onClick={submit}>
            Save associate
          </Button>
        </>
      }
    >
      <div className={staffing.formGrid}>
        <div className={staffing.field}>
          <label htmlFor="as-name">Full name</label>
          <input
            id="as-name"
            className="input"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            data-autofocus
          />
          {errors.name && <p className={staffing.error}>{errors.name}</p>}
        </div>
        <div className={staffing.field}>
          <label htmlFor="as-headline">Role / headline</label>
          <input
            id="as-headline"
            className="input"
            value={form.headline}
            onChange={(e) => setForm({ ...form, headline: e.target.value })}
            placeholder="Senior programme manager"
          />
          {errors.headline && <p className={staffing.error}>{errors.headline}</p>}
        </div>
        <div className={staffing.field}>
          <label htmlFor="as-type">Type</label>
          <select
            id="as-type"
            className="input"
            value={form.roleType}
            onChange={(e) => setForm({ ...form, roleType: e.target.value as AssociateRoleType })}
          >
            <option value="specialist">Specialist</option>
            <option value="consultant">Consultant</option>
            <option value="programme_manager">Programme manager</option>
            <option value="SIA">SIA</option>
            <option value="executive_advisor">Executive advisor</option>
          </select>
        </div>
        <div className={staffing.field}>
          <label htmlFor="as-seniority">Seniority</label>
          <select
            id="as-seniority"
            className="input"
            value={form.seniority}
            onChange={(e) => setForm({ ...form, seniority: e.target.value as SeniorityLevel })}
          >
            <option value="mid">Mid</option>
            <option value="senior">Senior</option>
            <option value="principal">Principal</option>
            <option value="executive">Executive</option>
          </select>
        </div>
        <div className={`${staffing.field} ${staffing.full}`}>
          <label htmlFor="as-skills">Skills</label>
          <input
            id="as-skills"
            className="input"
            value={form.skills}
            onChange={(e) => setForm({ ...form, skills: e.target.value })}
            placeholder="Programme management, SAP, Change"
          />
          {errors.skills && <p className={staffing.error}>{errors.skills}</p>}
        </div>
        <div className={`${staffing.field} ${staffing.full}`}>
          <label htmlFor="as-specs">Specialisations (optional, excludes skills already listed)</label>
          <input
            id="as-specs"
            className="input"
            value={form.specialisations}
            onChange={(e) => setForm({ ...form, specialisations: e.target.value })}
            placeholder="Retail transformation"
          />
        </div>
        <div className={staffing.field}>
          <label htmlFor="as-sectors">Sectors</label>
          <input
            id="as-sectors"
            className="input"
            value={form.sectors}
            onChange={(e) => setForm({ ...form, sectors: e.target.value })}
            placeholder="Retail, Financial services"
          />
          {errors.sectors && <p className={staffing.error}>{errors.sectors}</p>}
        </div>
        <div className={staffing.field}>
          <label htmlFor="as-location">Location</label>
          <input
            id="as-location"
            className="input"
            value={form.location}
            onChange={(e) => setForm({ ...form, location: e.target.value })}
          />
          {errors.location && <p className={staffing.error}>{errors.location}</p>}
        </div>
        <div className={staffing.field}>
          <label htmlFor="as-mode">Working mode</label>
          <select
            id="as-mode"
            className="input"
            value={form.workingMode}
            onChange={(e) => setForm({ ...form, workingMode: e.target.value as WorkingMode })}
          >
            <option value="remote">Remote</option>
            <option value="hybrid">Hybrid</option>
            <option value="onsite">Onsite</option>
          </select>
        </div>
        <div className={staffing.field}>
          <label htmlFor="as-rate">Day rate (GBP)</label>
          <input
            id="as-rate"
            className="input"
            inputMode="numeric"
            value={form.rateAmount}
            onChange={(e) => setForm({ ...form, rateAmount: e.target.value })}
            placeholder="900"
          />
        </div>
        <div className={staffing.field}>
          <label htmlFor="as-email">Email</label>
          <input
            id="as-email"
            className="input"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </div>
        <div className={staffing.field}>
          <label htmlFor="as-phone">Phone</label>
          <input id="as-phone" className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </div>
        <div className={`${staffing.field} ${staffing.full}`}>
          <label htmlFor="as-notes">Notes</label>
          <textarea
            id="as-notes"
            className="input"
            rows={2}
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
        </div>
      </div>
    </Modal>
  );
}
