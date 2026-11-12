"use client";

import { useState } from "react";
import Select from "@/components/ui/Select";
import Button from "@/components/ui/Button";
import { Modal } from "@/components/ui/Overlay";
import { useWorkspace } from "@/components/shell/WorkspaceContext";
import { useWorkspaceData } from "@/components/ui/bits";
import { crm } from "@/lib/crm-store";
import { addDays } from "@/lib/format";
import {
  REQUIREMENT_PRIORITIES,
  type RequirementCategory,
  type RequirementPriority,
  type SeniorityLevel,
} from "@/lib/tessiant-types";
import staffing from "@/app/(workspace)/staffing/staffing.module.css";

const empty = {
  accountId: "",
  linkedOpportunityId: "",
  title: "",
  category: "augmentation" as RequirementCategory,
  description: "",
  sector: "Retail",
  mustHaveSkills: "Programme management",
  preferredSkills: "",
  seniority: "senior" as SeniorityLevel,
  roleType: "consultant" as "consultant" | "specialist" | "programme_manager" | "SIA" | "executive_advisor" | "any",
  location: "UK hybrid",
  workingMode: "hybrid" as "remote" | "hybrid" | "onsite" | "flexible",
  startDate: addDays(21),
  durationWeeks: 12,
  headcount: 1,
  rateMin: 800,
  rateMax: 1100,
  ownerId: "me",
  priority: "medium" as RequirementPriority,
  notes: "",
};

export default function CreateRequirementModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (requirementId: string) => void;
}) {
  const { state } = useWorkspaceData();
  const { toast } = useWorkspace();
  const [form, setForm] = useState(empty);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const tessiant = state?.tessiant;
  if (!state || !tessiant) return null;

  const submit = () => {
    const nextErrors: Record<string, string> = {};
    if (!form.accountId) nextErrors.accountId = "Client account is required";
    if (!form.title.trim()) nextErrors.title = "Role title is required";
    if (!form.description.trim()) nextErrors.description = "Detailed description is required";
    if (!form.mustHaveSkills.trim()) nextErrors.mustHaveSkills = "At least one must-have skill is required";
    if (!form.startDate) nextErrors.startDate = "Start date is required";
    if (!form.headcount || form.headcount < 1) nextErrors.headcount = "At least one position is required";
    if (form.rateMin != null && form.rateMax != null && form.rateMin > form.rateMax) nextErrors.rateMax = "Max must be ≥ min";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      toast("Fix validation errors before saving", "error");
      return;
    }
    const id = crm.createRequirement({
      accountId: form.accountId,
      title: form.title.trim(),
      category: form.category,
      description: form.description.trim(),
      sector: form.sector.trim(),
      mustHaveSkills: form.mustHaveSkills.split(",").map((s) => s.trim()).filter(Boolean),
      preferredSkills: form.preferredSkills.split(",").map((s) => s.trim()).filter(Boolean),
      seniority: form.seniority,
      roleType: form.roleType,
      location: form.location.trim(),
      workingMode: form.workingMode,
      startDate: form.startDate,
      durationWeeks: Number(form.durationWeeks) || 1,
      headcount: Number(form.headcount) || 1,
      rateMin: form.rateMin,
      rateMax: form.rateMax,
      currency: "GBP",
      rateUnit: "day",
      ownerId: form.ownerId || "me",
      requestDate: addDays(0),
      notes: form.notes.trim() || "",
      offeringAlignment: [],
      priority: form.priority,
      linkedOpportunityId: form.linkedOpportunityId || null,
    });
    toast("Requirement created", "success");
    onCreated(id);
  };

  return (
    <Modal
      kicker="Staffing"
      title="New requirement"
      description="Capture the client brief, role, and commercials."
      onClose={onClose}
      size="large"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button icon="check" onClick={submit}>
            Create requirement
          </Button>
        </>
      }
    >
      <div className={staffing.formSections}>
        <section>
          <h3 className={staffing.formSectionTitle}>Client and role</h3>
          <div className={staffing.formGrid}>
            <div className={staffing.field}>
              <label htmlFor="req-accountId">Client company</label>
              <Select
                id="req-accountId"
                className="input"
                value={form.accountId}
                data-autofocus
                onChange={(e) => {
                  const accountId = e.target.value;
                  const account = tessiant.accounts.find((item) => item.id === accountId);
                  setForm({
                    ...form,
                    accountId,
                    linkedOpportunityId: account?.linkedLeadId ?? form.linkedOpportunityId,
                    sector: account?.sector ?? form.sector,
                  });
                }}
              >
                <option value="">Select client…</option>
                {tessiant.accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
              </Select>
              {errors.accountId && <span className={staffing.error}>{errors.accountId}</span>}
            </div>
            <div className={staffing.field}>
              <label htmlFor="req-linkedOpportunityId">Linked sales opportunity</label>
              <Select
                id="req-linkedOpportunityId"
                className="input"
                value={form.linkedOpportunityId}
                onChange={(e) => setForm({ ...form, linkedOpportunityId: e.target.value })}
              >
                <option value="">None</option>
                {(state.opportunities ?? []).map((opportunity) => (
                  <option key={opportunity.id} value={opportunity.id}>
                    {opportunity.name} · {opportunity.stage}
                  </option>
                ))}
              </Select>
            </div>
            <div className={`${staffing.field} ${staffing.full}`}>
              <label htmlFor="req-title">Role / requirement title</label>
              <input id="req-title" className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              {errors.title && <span className={staffing.error}>{errors.title}</span>}
            </div>
            <div className={`${staffing.field} ${staffing.full}`}>
              <label htmlFor="req-description">Detailed description</label>
              <textarea
                id="req-description"
                className="input"
                rows={3}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
              {errors.description && <span className={staffing.error}>{errors.description}</span>}
            </div>
            <div className={staffing.field}>
              <label htmlFor="req-category">Requirement type</label>
              <Select
                id="req-category"
                className="input"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value as RequirementCategory })}
              >
                <option value="augmentation">Augmentation</option>
                <option value="project team">Project team</option>
                <option value="advisory">Advisory</option>
              </Select>
            </div>
            <div className={staffing.field}>
              <label htmlFor="req-headcount">Number of resources</label>
              <input
                id="req-headcount"
                type="number"
                min={1}
                className="input"
                value={form.headcount}
                onChange={(e) => setForm({ ...form, headcount: Number(e.target.value) })}
              />
              {errors.headcount && <span className={staffing.error}>{errors.headcount}</span>}
            </div>
          </div>
        </section>

        <section>
          <h3 className={staffing.formSectionTitle}>Skills and experience</h3>
          <div className={staffing.formGrid}>
            <div className={staffing.field}>
              <label htmlFor="req-mustHaveSkills">Must-have skills (comma-separated)</label>
              <input
                id="req-mustHaveSkills"
                className="input"
                value={form.mustHaveSkills}
                onChange={(e) => setForm({ ...form, mustHaveSkills: e.target.value })}
              />
              {errors.mustHaveSkills && <span className={staffing.error}>{errors.mustHaveSkills}</span>}
            </div>
            <div className={staffing.field}>
              <label htmlFor="req-preferredSkills">Desirable skills</label>
              <input
                id="req-preferredSkills"
                className="input"
                value={form.preferredSkills}
                onChange={(e) => setForm({ ...form, preferredSkills: e.target.value })}
              />
            </div>
            <div className={staffing.field}>
              <label htmlFor="req-sector">Industry / sector experience</label>
              <input id="req-sector" className="input" value={form.sector} onChange={(e) => setForm({ ...form, sector: e.target.value })} />
            </div>
            <div className={staffing.field}>
              <label htmlFor="req-seniority">Seniority</label>
              <Select
                id="req-seniority"
                className="input"
                value={form.seniority}
                onChange={(e) => setForm({ ...form, seniority: e.target.value as SeniorityLevel })}
              >
                <option value="mid">Mid</option>
                <option value="senior">Senior</option>
                <option value="principal">Principal</option>
                <option value="executive">Executive</option>
              </Select>
            </div>
            <div className={staffing.field}>
              <label htmlFor="req-location">Location</label>
              <input id="req-location" className="input" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
            </div>
            <div className={staffing.field}>
              <label htmlFor="req-workingMode">Remote / on-site</label>
              <Select
                id="req-workingMode"
                className="input"
                value={form.workingMode}
                onChange={(e) => setForm({ ...form, workingMode: e.target.value as typeof form.workingMode })}
              >
                <option value="remote">Remote</option>
                <option value="hybrid">Hybrid</option>
                <option value="onsite">On-site</option>
                <option value="flexible">Flexible</option>
              </Select>
            </div>
          </div>
        </section>

        <section>
          <h3 className={staffing.formSectionTitle}>Commercials and ownership</h3>
          <div className={staffing.formGrid}>
            <div className={staffing.field}>
              <label htmlFor="req-durationWeeks">Contract duration (weeks)</label>
              <input
                id="req-durationWeeks"
                type="number"
                min={1}
                className="input"
                value={form.durationWeeks}
                onChange={(e) => setForm({ ...form, durationWeeks: Number(e.target.value) })}
              />
            </div>
            <div className={staffing.field}>
              <label htmlFor="req-startDate">Expected start date</label>
              <input
                id="req-startDate"
                type="date"
                className="input"
                value={form.startDate}
                onChange={(e) => setForm({ ...form, startDate: e.target.value })}
              />
              {errors.startDate && <span className={staffing.error}>{errors.startDate}</span>}
            </div>
            <div className={staffing.field}>
              <label htmlFor="req-rateMin">Client budget min (GBP/day)</label>
              <input
                id="req-rateMin"
                type="number"
                className="input"
                value={form.rateMin}
                onChange={(e) => setForm({ ...form, rateMin: Number(e.target.value) })}
              />
            </div>
            <div className={staffing.field}>
              <label htmlFor="req-rateMax">Client budget max (GBP/day)</label>
              <input
                id="req-rateMax"
                type="number"
                className="input"
                value={form.rateMax}
                onChange={(e) => setForm({ ...form, rateMax: Number(e.target.value) })}
              />
              {errors.rateMax && <span className={staffing.error}>{errors.rateMax}</span>}
            </div>
            <div className={staffing.field}>
              <label htmlFor="req-ownerId">Internal owner / resource manager</label>
              <Select id="req-ownerId" className="input" value={form.ownerId} onChange={(e) => setForm({ ...form, ownerId: e.target.value })}>
                {state.members.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className={staffing.field}>
              <label htmlFor="req-priority">Urgency</label>
              <Select
                id="req-priority"
                className="input"
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value as RequirementPriority })}
              >
                {REQUIREMENT_PRIORITIES.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </Select>
            </div>
            <div className={`${staffing.field} ${staffing.full}`}>
              <label htmlFor="req-notes">Notes</label>
              <input id="req-notes" className="input" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
          </div>
        </section>
      </div>
    </Modal>
  );
}
