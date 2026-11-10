"use client";

import { useMemo, useState } from "react";
import Button from "@/components/ui/Button";
import TagMultiSelect from "@/components/ui/TagMultiSelect";
import { Modal } from "@/components/ui/Overlay";
import { useWorkspace } from "@/components/shell/WorkspaceContext";
import { useWorkspaceData } from "@/components/ui/bits";
import { crm } from "@/lib/crm-store";
import { specialisationsBeyondSkills } from "@/lib/talent-network";
import type { AssociateRoleType, AvailabilityStatus, SeniorityLevel, WorkingMode } from "@/lib/tessiant-types";
import staffing from "@/app/(workspace)/staffing/staffing.module.css";

const empty = {
  name: "",
  headline: "",
  roleType: "consultant" as AssociateRoleType,
  seniority: "senior" as SeniorityLevel,
  skills: [] as string[],
  specialisations: [] as string[],
  sectors: [] as string[],
  location: "UK hybrid",
  workingMode: "hybrid" as WorkingMode,
  availability: "available" as AvailabilityStatus,
  nextAvailableDate: "",
  rateAmount: "",
  email: "",
  phone: "",
  summary: "",
  notes: "",
  experienceNotes: "",
  cvLabel: "",
};

export default function AddAssociateModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (associateId: string) => void;
}) {
  const { toast } = useWorkspace();
  const { state } = useWorkspaceData();
  const [form, setForm] = useState(empty);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const skillOptions = useMemo(() => {
    if (!state?.tessiant) return [];
    return [...new Set(state.tessiant.associates.flatMap((item) => item.skills))].sort();
  }, [state]);
  const sectorOptions = useMemo(() => {
    if (!state?.tessiant) return [];
    return [...new Set(state.tessiant.associates.flatMap((item) => item.sectors))].sort();
  }, [state]);

  const submit = () => {
    const skills = form.skills;
    const specialisations = specialisationsBeyondSkills(skills, form.specialisations);
    const sectors = form.sectors;
    const nextErrors: Record<string, string> = {};
    if (!form.name.trim()) nextErrors.name = "Name is required";
    if (!form.headline.trim()) nextErrors.headline = "Role title is required";
    if (!skills.length) nextErrors.skills = "Add at least one skill";
    if (!sectors.length) nextErrors.sectors = "Add at least one sector";
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
      location: form.location.trim() || "UK",
      workingMode: form.workingMode,
      availability: form.availability,
      rateAmount: form.rateAmount ? Number(form.rateAmount) : null,
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      notes: [form.notes.trim()].filter(Boolean).join("\n\n"),
    });
    crm.updateAssociate(id, {
      summary: form.summary.trim() || undefined,
      nextAvailableDate: form.nextAvailableDate || null,
      notes: [form.notes.trim(), form.experienceNotes.trim() ? `Experience notes:\n${form.experienceNotes.trim()}` : ""]
        .filter(Boolean)
        .join("\n\n"),
    });
    if (form.cvLabel.trim()) {
      crm.replaceAssociateCv(id, form.cvLabel.trim());
    }
    toast("Associate added to Talent Network", "success");
    onCreated(id);
  };

  return (
    <Modal
      kicker="Talent Network"
      title="Add associate"
      description="Grouped profile for matching and shortlisting."
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
      <div className={staffing.formSections}>
        <section>
          <h3 className={staffing.formSectionTitle}>Basic information</h3>
          <div className={staffing.formGrid}>
            <div className={staffing.field}>
              <label htmlFor="as-name">Full name</label>
              <input id="as-name" className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-autofocus />
              {errors.name && <p className={staffing.error}>{errors.name}</p>}
            </div>
            <div className={staffing.field}>
              <label htmlFor="as-headline">Role / headline</label>
              <input id="as-headline" className="input" value={form.headline} onChange={(e) => setForm({ ...form, headline: e.target.value })} />
              {errors.headline && <p className={staffing.error}>{errors.headline}</p>}
            </div>
            <div className={staffing.field}>
              <label htmlFor="as-type">Type</label>
              <select id="as-type" className="input" value={form.roleType} onChange={(e) => setForm({ ...form, roleType: e.target.value as AssociateRoleType })}>
                <option value="specialist">Specialist</option>
                <option value="consultant">Consultant</option>
                <option value="programme_manager">Programme manager</option>
                <option value="SIA">SIA</option>
                <option value="executive_advisor">Executive advisor</option>
              </select>
            </div>
            <div className={staffing.field}>
              <label htmlFor="as-seniority">Seniority</label>
              <select id="as-seniority" className="input" value={form.seniority} onChange={(e) => setForm({ ...form, seniority: e.target.value as SeniorityLevel })}>
                <option value="mid">Mid</option>
                <option value="senior">Senior</option>
                <option value="principal">Principal</option>
                <option value="executive">Executive</option>
              </select>
            </div>
            <div className={staffing.field}>
              <label htmlFor="as-email">Email</label>
              <input id="as-email" className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className={staffing.field}>
              <label htmlFor="as-phone">Phone</label>
              <input id="as-phone" className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
          </div>
        </section>

        <section>
          <h3 className={staffing.formSectionTitle}>Skills & experience</h3>
          <div className={staffing.formGrid}>
            <div className={`${staffing.field} ${staffing.full}`}>
              <label htmlFor="as-summary">Professional summary</label>
              <textarea
                id="as-summary"
                className="input"
                rows={5}
                value={form.summary}
                onChange={(e) => setForm({ ...form, summary: e.target.value })}
                placeholder="Senior programme lead with retail transformation and SAP delivery experience…"
              />
            </div>
            <div className={`${staffing.field} ${staffing.full}`}>
              <label>Skills</label>
              <TagMultiSelect
                value={form.skills}
                options={skillOptions}
                onChange={(skills) => setForm({ ...form, skills })}
                aria-label="Skills"
                placeholder="Search skills or add…"
              />
              {errors.skills && <p className={staffing.error}>{errors.skills}</p>}
            </div>
            <div className={`${staffing.field} ${staffing.full}`}>
              <label>Specialisations</label>
              <TagMultiSelect
                value={form.specialisations}
                options={skillOptions}
                onChange={(specialisations) => setForm({ ...form, specialisations })}
                aria-label="Specialisations"
                placeholder="Optional focus areas…"
              />
            </div>
            <div className={`${staffing.field} ${staffing.full}`}>
              <label>Sectors</label>
              <TagMultiSelect
                value={form.sectors}
                options={sectorOptions}
                onChange={(sectors) => setForm({ ...form, sectors })}
                aria-label="Sectors"
                placeholder="Search sectors or add…"
              />
              {errors.sectors && <p className={staffing.error}>{errors.sectors}</p>}
            </div>
            <div className={`${staffing.field} ${staffing.full}`}>
              <label htmlFor="as-experience">Experience notes</label>
              <textarea
                id="as-experience"
                className="input"
                rows={4}
                value={form.experienceNotes}
                onChange={(e) => setForm({ ...form, experienceNotes: e.target.value })}
                placeholder="Key programmes, clients and outcomes…"
              />
            </div>
          </div>
        </section>

        <section>
          <h3 className={staffing.formSectionTitle}>Availability</h3>
          <div className={staffing.formGrid}>
            <div className={staffing.field}>
              <label htmlFor="as-availability">Status</label>
              <select
                id="as-availability"
                className="input"
                value={form.availability}
                onChange={(e) => setForm({ ...form, availability: e.target.value as AvailabilityStatus })}
              >
                <option value="available">Available</option>
                <option value="limited">Limited</option>
                <option value="unavailable">Unavailable</option>
                <option value="unknown">Unknown</option>
              </select>
            </div>
            <div className={staffing.field}>
              <label htmlFor="as-next">Next available date</label>
              <input
                id="as-next"
                type="date"
                className="input"
                value={form.nextAvailableDate}
                onChange={(e) => setForm({ ...form, nextAvailableDate: e.target.value })}
              />
            </div>
            <div className={staffing.field}>
              <label htmlFor="as-location">Location</label>
              <input id="as-location" className="input" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
            </div>
            <div className={staffing.field}>
              <label htmlFor="as-mode">Working mode</label>
              <select id="as-mode" className="input" value={form.workingMode} onChange={(e) => setForm({ ...form, workingMode: e.target.value as WorkingMode })}>
                <option value="remote">Remote</option>
                <option value="hybrid">Hybrid</option>
                <option value="onsite">Onsite</option>
              </select>
            </div>
          </div>
        </section>

        <section>
          <h3 className={staffing.formSectionTitle}>Commercial details</h3>
          <div className={staffing.formGrid}>
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
            <div className={`${staffing.field} ${staffing.full}`}>
              <label htmlFor="as-notes">Internal commercial notes</label>
              <textarea id="as-notes" className="input" rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
          </div>
        </section>

        <section>
          <h3 className={staffing.formSectionTitle}>CV & documents</h3>
          <div className={staffing.formGrid}>
            <div className={`${staffing.field} ${staffing.full}`}>
              <label htmlFor="as-cv">CV label</label>
              <input
                id="as-cv"
                className="input"
                value={form.cvLabel}
                onChange={(e) => setForm({ ...form, cvLabel: e.target.value })}
                placeholder="e.g. Jane Doe CV — Nov 2026"
              />
            </div>
          </div>
        </section>
      </div>
    </Modal>
  );
}
