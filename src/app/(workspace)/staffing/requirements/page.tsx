"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Button from "@/components/ui/Button";
import CreateRequirementModal from "@/components/staffing/CreateRequirementModal";
import { EmptyState, SkeletonRows, useWorkspaceData } from "@/components/ui/bits";
import { useWorkspace } from "@/components/shell/WorkspaceContext";
import { crm } from "@/lib/crm-store";
import { formatDate, todayKey } from "@/lib/format";
import { formatCandidatePipelineSummary, mapRequirementToOpsStage } from "@/lib/tessiant-insights";
import {
  applyOpsBoardMove,
  boardColumns,
  daysOpen,
  filterRequisitions,
  requirementPriority,
  requisitionCounts,
} from "@/lib/requisition";
import {
  OPS_PIPELINE_STAGES,
  REQUIREMENT_PRIORITIES,
  type OpsPipelineStage,
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
      <div className={`page ${styles.density}`}>
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

  const closeForm = () => {
    setShowForm(false);
    if (params.get("new") === "1") {
      const search = new URLSearchParams(params.toString());
      search.delete("new");
      router.replace(`/staffing/requirements${search.size ? `?${search}` : ""}`);
    }
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
    <div className={`page ${styles.density}`}>
      <header className="page-head">
        <div>
          <h1>Client Requirements</h1>
          <p className="subtitle">Track staffing demand from brief to placement.</p>
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
          <Button icon="plus" onClick={() => setShowForm(true)}>
            New requirement
          </Button>
        </div>
      </header>

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
                    <b>{column.stage}</b>
                    <span className="chip tabular">{column.items.length}</span>
                  </div>
                  {column.items.length === 0 ? (
                    <div className="muted" style={{ padding: 8 }}>
                      Drop here
                    </div>
                  ) : (
                    column.items.map((req) => {
                      const account = tessiant.accounts.find((item) => item.id === req.accountId);
                      const priorityValue = requirementPriority(req);
                      const overdue = req.outcome === "active" && req.stage !== "Placed" && req.startDate < todayKey();
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
                          <div className="muted nowrap" style={{ marginTop: 4 }}>
                            {account?.name ?? "—"}
                          </div>
                          <div className={styles.boardMeta}>
                            {priorityValue === "high" ? <span className="chip chip-ai">high</span> : null}
                            <span className="muted tabular">{req.headcount} pos · {daysOpen(req)}d open</span>
                          </div>
                        </Link>
                      );
                    })
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="table-wrap">
              <table className={`table ${styles.reqTable}`}>
                <thead>
                  <tr>
                    <th>Requirement / Role</th>
                    <th>Client</th>
                    <th>Type</th>
                    <th>Priority</th>
                    <th>Positions</th>
                    <th>Owner</th>
                    <th>Start Date</th>
                    <th>Stage</th>
                    <th>Candidates</th>
                    <th>Actions</th>
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
                        </td>
                        <td className="nowrap">{account?.name ?? "—"}</td>
                        <td className="nowrap">{req.category}</td>
                        <td className="nowrap">
                          <span className={`chip ${priorityValue === "high" ? "chip-ai" : ""}`}>{priorityValue}</span>
                        </td>
                        <td className="tabular nowrap">{req.headcount}</td>
                        <td className="nowrap">{owner?.name ?? "Unassigned"}</td>
                        <td className="nowrap">
                          {formatDate(req.startDate)}
                          {overdue ? <span className="chip" style={{ marginLeft: 6 }}>Overdue</span> : null}
                        </td>
                        <td className="nowrap">
                          <span className="chip chip-dot">{mapRequirementToOpsStage(req)}</span>
                        </td>
                        <td className="nowrap">{formatCandidatePipelineSummary(counts)}</td>
                        <td className="nowrap">
                          <Link href={`/staffing/requirements/${req.id}`} className="text-link">
                            Open
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {showForm && (
        <CreateRequirementModal
          onClose={closeForm}
          onCreated={(id) => {
            setShowForm(false);
            router.push(`/staffing/requirements/${id}`);
          }}
        />
      )}
    </div>
  );
}
