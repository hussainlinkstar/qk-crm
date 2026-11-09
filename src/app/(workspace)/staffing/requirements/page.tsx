"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Button from "@/components/ui/Button";
import { EmptyState, SkeletonRows, useWorkspaceData } from "@/components/ui/bits";
import { useWorkspace } from "@/components/shell/WorkspaceContext";
import { crm } from "@/lib/crm-store";
import { addDays, formatDate, todayKey } from "@/lib/format";
import { isUrgentRequirement, mapRequirementToOpsStage } from "@/lib/tessiant-insights";
import {
  applyOpsBoardMove,
  boardColumns,
  daysOpen,
  filterRequisitions,
  nextRequirementStageHint,
  requirementPriority,
  requisitionCounts,
} from "@/lib/requisition";
import {
  OPS_PIPELINE_STAGES,
  REQUIREMENT_PRIORITIES,
  type OpsPipelineStage,
  type RequirementCategory,
  type RequirementPriority,
  type SeniorityLevel,
} from "@/lib/tessiant-types";
import styles from "../staffing.module.css";

type Layout = "table" | "board";

export default function RequirementsPage() {
  const { state } = useWorkspaceData();
  const { toast } = useWorkspace();
  const router = useRouter();
  const params = useSearchParams();

  const view = params.get("view");
  const opsStage = params.get("opsStage");
  const skill = params.get("skill");
  const sectorParam = params.get("sector");
  const clientParam = params.get("client");
  const ownerParam = params.get("owner");
  const priorityParam = params.get("priority");
  const categoryParam = params.get("category");
  const layoutParam = params.get("layout") === "board" ? "board" : "table";

  const [layout, setLayout] = useState<Layout>(layoutParam);
  const [showForm, setShowForm] = useState(params.get("new") === "1");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [q, setQ] = useState("");
  const [clientId, setClientId] = useState(clientParam ?? "");
  const [ownerId, setOwnerId] = useState(ownerParam ?? "");
  const [sector, setSector] = useState(sectorParam ?? "");
  const [stageFilter, setStageFilter] = useState(opsStage ?? "");
  const [priority, setPriority] = useState(priorityParam ?? "");
  const [category, setCategory] = useState(categoryParam ?? "");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [dragOver, setDragOver] = useState<OpsPipelineStage | null>(null);
  const [moreFilters, setMoreFilters] = useState(false);

  const [form, setForm] = useState({
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
  });

  const tessiant = state?.tessiant;

  const filters = useMemo(
    () => ({
      view,
      opsStage: stageFilter || null,
      skill,
      sector: sector || null,
      clientId: clientId || null,
      ownerId: ownerId || null,
      priority: priority || null,
      category: category || null,
      q,
      from: from || null,
      to: to || null,
    }),
    [view, stageFilter, skill, sector, clientId, ownerId, priority, category, q, from, to],
  );

  const rows = useMemo(() => (state ? filterRequisitions(state, filters) : []), [state, filters]);
  const columns = useMemo(() => (state ? boardColumns(state, filters) : []), [state, filters]);

  const sectors = useMemo(() => {
    if (!tessiant) return [];
    return [...new Set(tessiant.requirements.map((item) => item.sector))].sort();
  }, [tessiant]);

  const filterActive = Boolean(
    view || stageFilter || skill || sector || clientId || ownerId || priority || category || q || from || to,
  );

  if (!state || !tessiant) {
    return (
      <div className="page">
        <SkeletonRows rows={5} height={56} />
      </div>
    );
  }

  const setLayoutAndUrl = (next: Layout) => {
    setLayout(next);
    const search = new URLSearchParams(params.toString());
    if (next === "board") search.set("layout", "board");
    else search.delete("layout");
    router.replace(`/staffing/requirements${search.size ? `?${search}` : ""}`);
  };

  const clearFilters = () => {
    setQ("");
    setClientId("");
    setOwnerId("");
    setSector("");
    setStageFilter("");
    setPriority("");
    setCategory("");
    setFrom("");
    setTo("");
    router.push(layout === "board" ? "/staffing/requirements?layout=board" : "/staffing/requirements");
  };

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
    router.push(`/staffing/requirements/${id}`);
  };

  const onDrop = (ops: OpsPipelineStage, requirementId: string) => {
    const move = applyOpsBoardMove(ops);
    if (move.outcome && move.outcome !== "active") {
      crm.setRequirementOutcome(requirementId, move.outcome, move.reason);
    }
    if (move.stage) {
      if (move.stage === "Placed") {
        toast("Confirm placement from the requirement workspace to mark filled", "info");
        return;
      }
      if (move.outcome === "active" || !move.outcome) {
        crm.setRequirementOutcome(requirementId, "active");
      }
      crm.setRequirementStage(requirementId, move.stage, move.reason);
    }
    toast(`Moved to ${ops}`, "success");
    setDragOver(null);
  };

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Client Requirements</h1>
          <p className="subtitle">Track staffing demand from brief to placement across table and board views.</p>
        </div>
        <div className="page-actions">
          <div className={styles.viewToggle} role="group" aria-label="Layout">
            <button type="button" aria-pressed={layout === "table"} onClick={() => setLayoutAndUrl("table")}>
              Table
            </button>
            <button type="button" aria-pressed={layout === "board"} onClick={() => setLayoutAndUrl("board")}>
              Board
            </button>
          </div>
          {filterActive && (
            <Button variant="ghost" onClick={clearFilters}>
              Clear filters
            </Button>
          )}
          <Button icon="plus" onClick={() => setShowForm((value) => !value)}>
            {showForm ? "Hide form" : "New requirement"}
          </Button>
        </div>
      </header>

      {showForm && (
        <section className="card">
          <div className="card-head">
            <h2>Create requisition</h2>
            <p className="card-sub">Capture client, opportunity, role brief, commercials and urgency in one pass.</p>
          </div>
          <div className="card-body">
            <div className={styles.formGrid}>
              <div className={styles.field}>
                <label htmlFor="accountId">Client company</label>
                <select
                  id="accountId"
                  className="input"
                  value={form.accountId}
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
                </select>
                {errors.accountId && <span className={styles.error}>{errors.accountId}</span>}
              </div>
              <div className={styles.field}>
                <label htmlFor="linkedOpportunityId">Linked sales opportunity</label>
                <select
                  id="linkedOpportunityId"
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
                </select>
              </div>
              <div className={`${styles.field} ${styles.full}`}>
                <label htmlFor="title">Role / requirement title</label>
                <input id="title" className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
                {errors.title && <span className={styles.error}>{errors.title}</span>}
              </div>
              <div className={`${styles.field} ${styles.full}`}>
                <label htmlFor="description">Detailed description</label>
                <textarea id="description" className="input" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                {errors.description && <span className={styles.error}>{errors.description}</span>}
              </div>
              <div className={styles.field}>
                <label htmlFor="category">Requirement type</label>
                <select id="category" className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as RequirementCategory })}>
                  <option value="augmentation">Augmentation</option>
                  <option value="project team">Project team</option>
                  <option value="advisory">Advisory</option>
                </select>
              </div>
              <div className={styles.field}>
                <label htmlFor="headcount">Number of resources</label>
                <input id="headcount" type="number" min={1} className="input" value={form.headcount} onChange={(e) => setForm({ ...form, headcount: Number(e.target.value) })} />
                {errors.headcount && <span className={styles.error}>{errors.headcount}</span>}
              </div>
              <div className={styles.field}>
                <label htmlFor="mustHaveSkills">Must-have skills (comma-separated)</label>
                <input id="mustHaveSkills" className="input" value={form.mustHaveSkills} onChange={(e) => setForm({ ...form, mustHaveSkills: e.target.value })} />
                {errors.mustHaveSkills && <span className={styles.error}>{errors.mustHaveSkills}</span>}
              </div>
              <div className={styles.field}>
                <label htmlFor="preferredSkills">Desirable skills</label>
                <input id="preferredSkills" className="input" value={form.preferredSkills} onChange={(e) => setForm({ ...form, preferredSkills: e.target.value })} />
              </div>
              <div className={styles.field}>
                <label htmlFor="sector">Industry / sector experience</label>
                <input id="sector" className="input" value={form.sector} onChange={(e) => setForm({ ...form, sector: e.target.value })} />
              </div>
              <div className={styles.field}>
                <label htmlFor="seniority">Seniority</label>
                <select id="seniority" className="input" value={form.seniority} onChange={(e) => setForm({ ...form, seniority: e.target.value as SeniorityLevel })}>
                  <option value="mid">Mid</option>
                  <option value="senior">Senior</option>
                  <option value="principal">Principal</option>
                  <option value="executive">Executive</option>
                </select>
              </div>
              <div className={styles.field}>
                <label htmlFor="location">Location</label>
                <input id="location" className="input" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
              </div>
              <div className={styles.field}>
                <label htmlFor="workingMode">Remote / on-site</label>
                <select id="workingMode" className="input" value={form.workingMode} onChange={(e) => setForm({ ...form, workingMode: e.target.value as typeof form.workingMode })}>
                  <option value="remote">Remote</option>
                  <option value="hybrid">Hybrid</option>
                  <option value="onsite">On-site</option>
                  <option value="flexible">Flexible</option>
                </select>
              </div>
              <div className={styles.field}>
                <label htmlFor="durationWeeks">Contract duration (weeks)</label>
                <input id="durationWeeks" type="number" min={1} className="input" value={form.durationWeeks} onChange={(e) => setForm({ ...form, durationWeeks: Number(e.target.value) })} />
              </div>
              <div className={styles.field}>
                <label htmlFor="startDate">Expected start date</label>
                <input id="startDate" type="date" className="input" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
                {errors.startDate && <span className={styles.error}>{errors.startDate}</span>}
              </div>
              <div className={styles.field}>
                <label htmlFor="rateMin">Client budget min (GBP/day)</label>
                <input id="rateMin" type="number" className="input" value={form.rateMin} onChange={(e) => setForm({ ...form, rateMin: Number(e.target.value) })} />
              </div>
              <div className={styles.field}>
                <label htmlFor="rateMax">Client budget max (GBP/day)</label>
                <input id="rateMax" type="number" className="input" value={form.rateMax} onChange={(e) => setForm({ ...form, rateMax: Number(e.target.value) })} />
                {errors.rateMax && <span className={styles.error}>{errors.rateMax}</span>}
              </div>
              <div className={styles.field}>
                <label htmlFor="ownerId">Internal owner / resource manager</label>
                <select id="ownerId" className="input" value={form.ownerId} onChange={(e) => setForm({ ...form, ownerId: e.target.value })}>
                  {state.members.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className={styles.field}>
                <label htmlFor="priority">Urgency</label>
                <select id="priority" className="input" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value as RequirementPriority })}>
                  {REQUIREMENT_PRIORITIES.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>
              <div className={`${styles.field} ${styles.full}`}>
                <label htmlFor="notes">Notes</label>
                <input id="notes" className="input" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </div>
            </div>
            <div className={styles.actions}>
              <Button icon="check" onClick={submit}>
                Create requirement
              </Button>
              <Button variant="ghost" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </section>
      )}

      <section className="card">
        <div className="card-head">
          <div>
            <h2>{filterActive ? "Filtered requisitions" : "All requisitions"}</h2>
            <p className="card-sub tabular">{rows.length} records</p>
          </div>
        </div>
        <div className="card-body">
          <div className={styles.compactFilters}>
            <input className="input" placeholder="Search title, client, skills…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search requirements" />
            <select className="input" value={clientId} onChange={(e) => setClientId(e.target.value)} aria-label="Filter by client">
              <option value="">All clients</option>
              {tessiant.accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </select>
            <select className="input" value={stageFilter} onChange={(e) => setStageFilter(e.target.value)} aria-label="Filter by stage">
              <option value="">All stages</option>
              {OPS_PIPELINE_STAGES.map((stage) => (
                <option key={stage} value={stage}>
                  {stage}
                </option>
              ))}
            </select>
            <select className="input" value={priority} onChange={(e) => setPriority(e.target.value)} aria-label="Filter by priority">
              <option value="">All priorities</option>
              {REQUIREMENT_PRIORITIES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
            <Button variant="secondary" className={styles.controlMatch} onClick={() => setMoreFilters((value) => !value)} aria-expanded={moreFilters}>
              More
            </Button>
          </div>
          {moreFilters && (
            <div className={styles.moreFilters}>
              <select className="input" value={ownerId} onChange={(e) => setOwnerId(e.target.value)} aria-label="Filter by owner">
                <option value="">All owners</option>
                <option value="none">Unassigned</option>
                {state.members.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name}
                  </option>
                ))}
              </select>
              <select className="input" value={sector} onChange={(e) => setSector(e.target.value)} aria-label="Filter by sector">
                <option value="">All sectors</option>
                {sectors.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
              <select className="input" value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Filter by requirement type">
                <option value="">All types</option>
                <option value="augmentation">Augmentation</option>
                <option value="project team">Project team</option>
                <option value="advisory">Advisory</option>
              </select>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <input type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="From date" />
                <input type="date" className="input" value={to} onChange={(e) => setTo(e.target.value)} aria-label="To date" />
              </div>
            </div>
          )}
          {layout === "board" && (
            <p className={styles.pipelineLegend}>
              Pipeline chips show Shortlisted / Interviewed / Offered / Filled. Scroll sideways for every stage.
            </p>
          )}

          {rows.length === 0 ? (
            <EmptyState title="No requirements match" icon="flag" />
          ) : layout === "board" ? (
            <div className={styles.board} aria-label="Requirement board">
              {columns.map((column) => (
                <div
                  key={column.stage}
                  className={styles.boardColumn}
                  onDragOver={(event) => {
                    event.preventDefault();
                    setDragOver(column.stage);
                  }}
                  onDragLeave={() => setDragOver((current) => (current === column.stage ? null : current))}
                  onDrop={(event) => {
                    event.preventDefault();
                    const id = event.dataTransfer.getData("text/requirement-id");
                    if (id) onDrop(column.stage, id);
                  }}
                  data-over={dragOver === column.stage ? "true" : undefined}
                >
                  <div className={styles.boardColumnHead}>
                    <div>
                      <b>{column.stage}</b>
                      <div className="muted" style={{ fontSize: 12 }}>
                        {nextRequirementStageHint(column.stage)}
                      </div>
                    </div>
                    <span className="chip tabular">{column.items.length}</span>
                  </div>
                  {column.items.length === 0 ? (
                    <div className="muted" style={{ fontSize: 12.5, padding: 8 }}>
                      Drop here
                    </div>
                  ) : (
                    column.items.map((req) => {
                      const account = tessiant.accounts.find((item) => item.id === req.accountId);
                      const counts = requisitionCounts(state, req.id);
                      const priorityValue = requirementPriority(req);
                      const overdue = req.outcome === "active" && req.stage !== "Placed" && req.startDate < todayKey();
                      const urgent = isUrgentRequirement(state, req);
                      return (
                        <Link
                          key={req.id}
                          href={`/staffing/requirements/${req.id}`}
                          className={styles.boardCard}
                          data-overdue={overdue ? "true" : undefined}
                          data-priority={priorityValue}
                          draggable
                          onDragStart={(event) => {
                            event.dataTransfer.setData("text/requirement-id", req.id);
                            event.dataTransfer.effectAllowed = "move";
                          }}
                        >
                          <div className={styles.boardCardTitle}>{req.title}</div>
                          <div className="muted" style={{ fontSize: 12.5, marginTop: 4 }}>
                            {account?.name ?? "—"} · {req.category}
                          </div>
                          <div className={styles.boardMeta}>
                            <span className={`chip ${priorityValue === "high" ? "chip-ai" : ""}`}>{priorityValue}</span>
                            {overdue && <span className="chip">Overdue start</span>}
                            {!overdue && urgent && <span className="chip">Due soon</span>}
                            <span className="chip tabular">{req.headcount} pos</span>
                            <span className="chip tabular">{daysOpen(req)}d open</span>
                            <span className="chip tabular" title="Shortlisted / Interviewed / Offered / Filled">
                              S{counts.shortlisted} · I{counts.interviewed} · O{counts.offered} · F{counts.filled}
                            </span>
                          </div>
                        </Link>
                      );
                    })
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Job / requirement</th>
                    <th>Client</th>
                    <th>Type</th>
                    <th>Skills / sector</th>
                    <th>Positions</th>
                    <th>Priority</th>
                    <th>Owner</th>
                    <th>Start / duration</th>
                    <th>Status / stage</th>
                    <th>Pipeline</th>
                    <th>Days open</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((req) => {
                    const account = tessiant.accounts.find((item) => item.id === req.accountId);
                    const owner = state.members.find((item) => item.id === req.ownerId);
                    const counts = requisitionCounts(state, req.id);
                    const priorityValue = requirementPriority(req);
                    const overdue = req.outcome === "active" && req.stage !== "Placed" && req.startDate < todayKey();
                    return (
                      <tr key={req.id}>
                        <td>
                          <Link href={`/staffing/requirements/${req.id}`} className={styles.rowLink}>
                            {req.title}
                          </Link>
                          {overdue && <div className="muted">Overdue start {formatDate(req.startDate)}</div>}
                        </td>
                        <td>{account?.name ?? "—"}</td>
                        <td>{req.category}</td>
                        <td>
                          <div>{req.mustHaveSkills.slice(0, 2).join(", ") || "—"}</div>
                          <div className="muted">{req.sector}</div>
                        </td>
                        <td className="tabular">{req.headcount}</td>
                        <td>
                          <span className={`chip ${priorityValue === "high" ? "chip-ai" : ""}`}>{priorityValue}</span>
                        </td>
                        <td>{owner?.name ?? "Unassigned"}</td>
                        <td>
                          <div>{formatDate(req.startDate)}</div>
                          <div className="muted">{req.durationWeeks} wks</div>
                        </td>
                        <td>
                          <span className="chip chip-dot">{mapRequirementToOpsStage(req)}</span>
                          <div className="muted">{req.stage} · {req.outcome}</div>
                        </td>
                        <td className="tabular">
                          <span title="Shortlisted / Interviewed / Offered / Filled">
                            S{counts.shortlisted} · I{counts.interviewed} · O{counts.offered} · F{counts.filled}
                          </span>
                        </td>
                        <td className="tabular">{daysOpen(req)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
