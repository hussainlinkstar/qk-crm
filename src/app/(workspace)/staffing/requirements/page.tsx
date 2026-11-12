"use client";

import { useMemo, useState } from "react";
import Select from "@/components/ui/Select";
import { useRouter, useSearchParams } from "next/navigation";
import Button from "@/components/ui/Button";
import CreateRequirementModal from "@/components/staffing/CreateRequirementModal";
import RequirementQuickPanel from "@/components/staffing/RequirementQuickPanel";
import { EmptyState, SkeletonRows, useWorkspaceData } from "@/components/ui/bits";
import { useWorkspace } from "@/components/shell/WorkspaceContext";
import { crm } from "@/lib/crm-store";
import { formatDate, todayKey } from "@/lib/format";
import { formatCandidateProgress, mapRequirementToOpsStage, verifiedAvailableMatchCount } from "@/lib/tessiant-insights";
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
  const layoutParam = params.get("layout") === "table" ? "table" : "board";

  const [layout, setLayout] = useState<Layout>(layoutParam);
  const [showForm, setShowForm] = useState(params.get("new") === "1");
  const [previewId, setPreviewId] = useState<string | null>(null);
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
  const openRequirements =
    tessiant?.requirements.filter((item) => !item.archived && item.outcome === "active" && item.stage !== "Placed") ?? [];
  const verifiedAvailableTalent =
    tessiant?.associates.filter(
      (item) => item.status === "active" && item.availability === "available" && Boolean(item.verifiedAt),
    ) ?? [];
  const uncoveredRequirements = state
    ? openRequirements.filter((item) => verifiedAvailableMatchCount(state, item.id) === 0)
    : [];
  const totalOpenPositions = openRequirements.reduce((sum, item) => sum + Math.max(1, item.headcount), 0);
  const topSectorDemand = [
    ...openRequirements
      .reduce<Map<string, number>>((counts, item) => {
        counts.set(item.sector, (counts.get(item.sector) ?? 0) + Math.max(1, item.headcount));
        return counts;
      }, new Map())
      .entries(),
  ].sort((a, b) => b[1] - a[1])[0] ?? null;
  const topSeniorityDemand = [
    ...openRequirements
      .reduce<Map<string, number>>((counts, item) => {
        counts.set(item.seniority, (counts.get(item.seniority) ?? 0) + Math.max(1, item.headcount));
        return counts;
      }, new Map())
      .entries(),
  ].sort((a, b) => b[1] - a[1])[0] ?? null;

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
    if (next === "table") search.set("layout", "table");
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
    setLayoutAndUrl(layout);
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
          <p className="subtitle">Demand from brief to placement.</p>
        </div>
        <div className="page-actions">
          <div className="segmented" role="group" aria-label="Layout">
            <button type="button" aria-pressed={layout === "board"} onClick={() => setLayoutAndUrl("board")}>
              Board
            </button>
            <button type="button" aria-pressed={layout === "table"} onClick={() => setLayoutAndUrl("table")}>
              Table
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

      <section className={styles.requirementMetrics} aria-label="Requirement intelligence">
        <div>
          <b className="tabular">{openRequirements.length}</b>
          <span>Open requirements</span>
          <small>{openRequirements.reduce((sum, item) => sum + Math.max(1, item.headcount), 0)} open positions</small>
        </div>
        <div>
          <b className="tabular">{verifiedAvailableTalent.length}</b>
          <span>Verified talent available</span>
          <small>Recorded as active and available</small>
        </div>
        <div data-alert={uncoveredRequirements.length > 0 ? "true" : undefined}>
          <b className="tabular">{uncoveredRequirements.length}</b>
          <span>Requirements without coverage</span>
          <small>No verified available match recorded</small>
        </div>
        <div>
          <b className="tabular">
            {topSectorDemand && totalOpenPositions ? Math.round((topSectorDemand[1] / totalOpenPositions) * 100) : 0}%
          </b>
          <span>{topSectorDemand ? `${topSectorDemand[0]} demand` : "Sector demand"}</span>
          <small>
            {topSeniorityDemand && totalOpenPositions
              ? `${Math.round((topSeniorityDemand[1] / totalOpenPositions) * 100)}% ${topSeniorityDemand[0]} · current snapshot`
              : "No open-position mix recorded"}
          </small>
        </div>
      </section>

      <button
        type="button"
        className={styles.requirementInsight}
        disabled={uncoveredRequirements.length === 0}
        onClick={() => uncoveredRequirements[0] && setPreviewId(uncoveredRequirements[0].id)}
      >
        <span>
          <small>Requirement insight</small>
          <b>
            {uncoveredRequirements.length > 0
              ? `${uncoveredRequirements.length} open ${uncoveredRequirements.length === 1 ? "requirement has" : "requirements have"} no verified available match`
              : "Every open requirement has verified available coverage"}
          </b>
        </span>
        <span>
          {uncoveredRequirements[0]
            ? `Review ${uncoveredRequirements[0].title} and start a focused talent search.`
            : "Coverage is based on currently recorded availability."}
        </span>
        <span aria-hidden="true">{uncoveredRequirements.length > 0 ? "→" : "✓"}</span>
      </button>

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
            <Select className="input" value={clientId} onChange={(e) => setClientId(e.target.value)} aria-label="Filter by client">
              <option value="">All clients</option>
              {tessiant.accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </Select>
            <Select className="input" value={stageFilter} onChange={(e) => setStageFilter(e.target.value)} aria-label="Filter by stage">
              <option value="">All stages</option>
              {OPS_PIPELINE_STAGES.map((stage) => (
                <option key={stage} value={stage}>
                  {stage}
                </option>
              ))}
            </Select>
            <Select className="input" value={priority} onChange={(e) => setPriority(e.target.value)} aria-label="Filter by priority">
              <option value="">All priorities</option>
              {REQUIREMENT_PRIORITIES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </Select>
            <Button variant="secondary" className={styles.controlMatch} onClick={() => setMoreFilters((value) => !value)} aria-expanded={moreFilters}>
              More
            </Button>
          </div>
          {moreFilters && (
            <div className={styles.moreFilters}>
              <Select className="input" value={ownerId} onChange={(e) => setOwnerId(e.target.value)} aria-label="Filter by owner">
                <option value="">All owners</option>
                <option value="none">Unassigned</option>
                {state.members.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name}
                  </option>
                ))}
              </Select>
              <Select className="input" value={sector} onChange={(e) => setSector(e.target.value)} aria-label="Filter by sector">
                <option value="">All sectors</option>
                {sectors.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </Select>
              <Select className="input" value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Filter by requirement type">
                <option value="">All types</option>
                <option value="augmentation">Augmentation</option>
                <option value="project team">Project team</option>
                <option value="advisory">Advisory</option>
              </Select>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <input type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="From date" />
                <input type="date" className="input" value={to} onChange={(e) => setTo(e.target.value)} aria-label="To date" />
              </div>
            </div>
          )}

          {rows.length === 0 ? (
            <EmptyState title="No requirements match" icon="flag" />
          ) : layout === "board" ? (
            <div className={`kanban-board ${styles.board}`} aria-label="Requirement board">
              {columns.map((column) => (
                <div
                  key={column.stage}
                  className={`kanban-column ${styles.boardColumn}`}
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
                      const owner = state.members.find((item) => item.id === req.ownerId);
                      const priorityValue = requirementPriority(req);
                      const overdue = req.outcome === "active" && req.stage !== "Placed" && req.startDate < todayKey();
                      const counts = requisitionCounts(state, req.id);
                      const verified = verifiedAvailableMatchCount(state, req.id);
                      return (
                        <article
                          key={req.id}
                          className={`kanban-card ${styles.boardCard}`}
                          data-overdue={overdue ? "true" : undefined}
                          data-priority={priorityValue}
                          draggable
                          role="button"
                          tabIndex={0}
                          onDragStart={(event) => {
                            event.dataTransfer.setData("text/requirement-id", req.id);
                            event.dataTransfer.effectAllowed = "move";
                          }}
                          onClick={() => setPreviewId(req.id)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              setPreviewId(req.id);
                            }
                          }}
                        >
                          <div className={styles.boardCardTitle}>{req.title}</div>
                          <div className={styles.boardCardClient}>{account?.name ?? "—"}</div>
                          <div className={styles.boardProgress}>
                            {req.headcount} {req.headcount === 1 ? "position" : "positions"} · {formatCandidateProgress(counts)}
                          </div>
                          <div className={styles.boardOwner}>Owner · {owner?.name ?? "Unassigned"}</div>
                          <div className={styles.boardMeta}>
                            <span className={`chip ${priorityValue === "high" ? "chip-ai" : ""}`}>{priorityValue}</span>
                            {overdue ? <span className="chip">Overdue</span> : <span className="muted tabular">{daysOpen(req)}d</span>}
                            <span className={`chip tabular ${verified === 0 ? "chip-high" : ""}`}>{verified} verified</span>
                          </div>
                        </article>
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
                    <th>Requirement</th>
                    <th>Client</th>
                    <th>Priority</th>
                    <th>Owner</th>
                    <th>Start</th>
                    <th>Stage</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((req) => {
                    const account = tessiant.accounts.find((item) => item.id === req.accountId);
                    const owner = state.members.find((item) => item.id === req.ownerId);
                    const priorityValue = requirementPriority(req);
                    const overdue = req.outcome === "active" && req.stage !== "Placed" && req.startDate < todayKey();
                    return (
                      <tr key={req.id} className={styles.clickRow} onClick={() => setPreviewId(req.id)}>
                        <td>
                          <button type="button" className={styles.rowLink} onClick={() => setPreviewId(req.id)}>
                            {req.title}
                          </button>
                        </td>
                        <td className="nowrap">{account?.name ?? "—"}</td>
                        <td className="nowrap">
                          <span className={`chip ${priorityValue === "high" ? "chip-ai" : ""}`}>{priorityValue}</span>
                        </td>
                        <td className="nowrap">{owner?.name ?? "Unassigned"}</td>
                        <td className="nowrap">
                          {formatDate(req.startDate)}
                          {overdue ? <span className="chip" style={{ marginLeft: 6 }}>Overdue</span> : null}
                        </td>
                        <td className="nowrap">
                          <span className="chip chip-dot">{mapRequirementToOpsStage(req)}</span>
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

      {previewId ? <RequirementQuickPanel requirementId={previewId} onClose={() => setPreviewId(null)} /> : null}
    </div>
  );
}
