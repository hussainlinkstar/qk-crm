"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useRef, useState, type DragEvent } from "react";
import { crm } from "@/lib/crm-store";
import { initials, timeAgo } from "@/lib/format";
import type { LeadView } from "@/lib/insights";
import { LEAD_SOURCES, LEAD_STATUSES, type LeadStatus } from "@/lib/types";
import Button from "@/components/ui/Button";
import Icon from "@/components/ui/Icon";
import { ConfirmDialog } from "@/components/ui/Overlay";
import { MemberAvatar, SkeletonRows, useNow, useWorkspaceData } from "@/components/ui/bits";
import LeadQuickPanel from "@/components/leads/LeadQuickPanel";
import { useWorkspace } from "@/components/shell/WorkspaceContext";
import styles from "./pipeline.module.css";

const ACTIVITY_FILTERS = [
  ["", "Any activity"],
  ["attention", "Needs attention"],
  ["scan", "Completed a scan"],
  ["active", "Active in 30 days"],
  ["open_task", "Has open task"],
  ["no_owner", "Unassigned"],
] as const;

const SORTS = [
  ["recent", "Last activity"],
  ["newest", "Newest leads"],
  ["engagement", "Engagement"],
  ["name", "Name A–Z"],
] as const;

const COLUMNS: { status: LeadStatus; hint: string }[] = [
  { status: "New", hint: "Not contacted yet" },
  { status: "Contacted", hint: "In conversation" },
  { status: "Qualified", hint: "Ready to progress" },
  { status: "Won", hint: "Closed successfully" },
  { status: "Lost", hint: "Not moving forward" },
];

export default function PipelinePage() {
  return (
    <Suspense fallback={<div className="page"><SkeletonRows rows={4} height={220} /></div>}>
      <PipelineBoard />
    </Suspense>
  );
}

function PipelineBoard() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { state, workspace } = useWorkspaceData();
  const { openAddLead, toast, askQiko } = useWorkspace();
  const now = useNow();
  const [panelLead, setPanelLead] = useState<string | null>(null);
  const [pending, setPending] = useState<{ lead: LeadView; status: LeadStatus } | null>(null);
  const [dragOver, setDragOver] = useState<LeadStatus | null>(null);
  const skipClick = useRef(false);

  const q = params.get("q") ?? "";
  const source = params.get("source") ?? "";
  const owner = params.get("owner") ?? "";
  const activity = params.get("activity") ?? "";
  const sort = params.get("sort") ?? "recent";

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params.toString());
    next.delete("status");
    if (value) next.set(key, value);
    else next.delete(key);
    router.replace(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false });
  };

  const suggestionLeads = useMemo(() => new Set(workspace?.suggestions.map((item) => item.leadId)), [workspace]);

  const filtered = useMemo(() => {
    if (!workspace) return [];
    const term = q.trim().toLowerCase();
    const list = workspace.leads.filter((lead) => {
      if (term && !`${lead.name} ${lead.email} ${lead.company ?? ""} ${lead.role ?? ""}`.toLowerCase().includes(term)) return false;
      if (source && lead.source !== source) return false;
      if (owner && (owner === "none" ? lead.ownerId !== null : lead.ownerId !== owner)) return false;
      if (activity === "scan" && lead.scansCount === 0) return false;
      if (activity === "active" && !(lead.lastActivity && now - new Date(lead.lastActivity.occurredAt).getTime() < 30 * 86_400_000 && ["login", "product", "report", "scan"].includes(lead.lastActivity.kind))) return false;
      if (activity === "open_task" && lead.openTasks.length === 0) return false;
      if (activity === "no_owner" && lead.ownerId) return false;
      if (activity === "attention" && !suggestionLeads.has(lead.id)) return false;
      return true;
    });
    return list.sort((a, b) => {
      if (sort === "newest") return b.createdAt.localeCompare(a.createdAt);
      if (sort === "engagement") return b.engagementScore - a.engagementScore;
      if (sort === "name") return a.name.localeCompare(b.name);
      return (b.lastActivity?.occurredAt ?? b.createdAt).localeCompare(a.lastActivity?.occurredAt ?? a.createdAt);
    });
  }, [workspace, q, source, owner, activity, sort, now, suggestionLeads]);

  if (!state || !workspace) {
    return (
      <div className="page">
        <SkeletonRows rows={4} height={220} />
      </div>
    );
  }

  const memberById = new Map(state.members.map((member) => [member.id, member]));
  const activeFilters = [source, owner, activity, q].filter(Boolean).length + (sort !== "recent" ? 1 : 0);

  const openTable = () => {
    const next = new URLSearchParams(params.toString());
    next.delete("status");
    router.push(`/sales/leads${next.size ? `?${next}` : ""}`);
  };

  const exportCsv = () => {
    const header = ["Name", "Email", "Phone", "Company", "Source", "Status", "Owner", "Last activity", "Last activity at", "Next action", "Engagement"];
    const rows = filtered.map((lead) => [lead.name, lead.email, lead.phone ?? "", lead.company ?? "", lead.source, lead.status, lead.ownerId ? memberById.get(lead.ownerId)?.name ?? "" : "", lead.lastActivity?.title ?? "", lead.lastActivity?.occurredAt ?? "", lead.nextActionLabel, String(lead.engagementScore)]);
    const csv = [header, ...rows].map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `qiko-core-pipeline-${new Date(now).toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast(`Exported ${filtered.length} leads`);
  };

  const requestMove = (lead: LeadView, status: LeadStatus) => {
    if (lead.status === status) return;
    setPending({ lead, status });
  };

  const onDrop = (event: DragEvent, status: LeadStatus) => {
    event.preventDefault();
    setDragOver(null);
    const id = event.dataTransfer.getData("text/lead-id");
    const lead = filtered.find((item) => item.id === id) ?? workspace.leads.find((item) => item.id === id);
    if (lead) requestMove(lead, status);
  };

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Pipeline</h1>
          <p className="subtitle">The same leads, grouped by stage. Drag a card to update its status — the table view stays unchanged.</p>
        </div>
        <div className="page-actions">
          <Button variant="secondary" icon="list" className="mobile-icon-button" aria-label="Table view" onClick={openTable}><span className="mobile-icon-label">Table</span></Button>
          <Button variant="secondary" icon="file" className="mobile-icon-button" aria-label="Export CSV" onClick={exportCsv} disabled={!filtered.length}><span className="mobile-icon-label">Export CSV</span></Button>
          <Button icon="userPlus" className="mobile-icon-button" aria-label="Add lead" onClick={openAddLead}><span className="mobile-icon-label">Add lead</span></Button>
        </div>
      </header>

      <section className={styles.toolbar}>
        <label className={styles.search}>
          <Icon name="search" size={15} />
          <input value={q} onChange={(event) => setParam("q", event.target.value)} placeholder="Search name, email, company" aria-label="Search leads" />
          {q && (
            <button type="button" aria-label="Clear search" onClick={() => setParam("q", "")}>
              <Icon name="x" size={13} />
            </button>
          )}
        </label>
        <select className={`select ${styles.filter}`} value={source} onChange={(event) => setParam("source", event.target.value)} aria-label="Source">
          <option value="">All sources</option>
          {LEAD_SOURCES.map((item) => <option key={item}>{item}</option>)}
        </select>
        <select className={`select ${styles.filter}`} value={owner} onChange={(event) => setParam("owner", event.target.value)} aria-label="Owner">
          <option value="">All owners</option>
          <option value="none">Unassigned</option>
          {state.members.map((member) => <option key={member.id} value={member.id}>{member.id === "me" ? "Me" : member.name}</option>)}
        </select>
        <select className={`select ${styles.filter}`} value={activity} onChange={(event) => setParam("activity", event.target.value)} aria-label="Activity">
          {ACTIVITY_FILTERS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <select className={`select ${styles.filter}`} value={sort} onChange={(event) => setParam("sort", event.target.value === "recent" ? "" : event.target.value)} aria-label="Sort">
          {SORTS.map(([value, label]) => <option key={value} value={value}>Sort: {label}</option>)}
        </select>
        {activeFilters > 0 && (
          <Button size="small" variant="ghost" icon="x" onClick={() => router.replace(pathname, { scroll: false })}>Clear</Button>
        )}
      </section>

      <p className={styles.resultLine}>
        {filtered.length ? (
          <>Showing <b>1–{filtered.length}</b> of <b>{filtered.length}</b> {filtered.length === 1 ? "lead" : "leads"}</>
        ) : (
          <>Showing <b>0</b> of <b>0</b> leads</>
        )}
        {source && <> · source <b>{source}</b></>}
      </p>

      <section className={styles.board} aria-label="Lead pipeline">
        {COLUMNS.map((column) => {
          const items = filtered.filter((lead) => lead.status === column.status);
          return (
            <div
              key={column.status}
              className={`${styles.column} ${dragOver === column.status ? styles.columnOver : ""}`}
              onDragOver={(event) => { event.preventDefault(); setDragOver(column.status); }}
              onDragLeave={() => setDragOver((current) => (current === column.status ? null : current))}
              onDrop={(event) => onDrop(event, column.status)}
            >
              <div className={styles.columnHead}>
                <div>
                  <p className={styles.columnTitle}>
                    <i className={styles[column.status.toLowerCase()]} />
                    {column.status}
                  </p>
                  <p className={styles.columnHint}>{column.hint}</p>
                </div>
                <span className={styles.columnCount}>{items.length}</span>
              </div>
              <div className={styles.columnBody}>
                {items.length === 0 ? (
                  <div className={styles.columnEmpty}>
                    <b>{activeFilters ? "No matches" : "Empty stage"}</b>
                    <span>{activeFilters ? "Nothing in this stage matches the filters." : "Drag a lead here to move it."}</span>
                  </div>
                ) : (
                  items.map((lead) => (
                    <article
                      key={lead.id}
                      className={styles.card}
                      draggable
                      onDragStart={(event) => {
                        skipClick.current = true;
                        event.dataTransfer.setData("text/lead-id", lead.id);
                        event.dataTransfer.effectAllowed = "move";
                      }}
                      onDragEnd={() => window.setTimeout(() => { skipClick.current = false; }, 0)}
                    >
                      <button
                        type="button"
                        className={styles.cardMain}
                        onClick={() => { if (!skipClick.current) setPanelLead(lead.id); }}
                      >
                        <span className={styles.person}>
                          <span className="avatar avatar-sm">{initials(lead.name)}</span>
                          <span className={styles.personText}>
                            <b>{lead.name}</b>
                            <small>{lead.company ?? lead.email}</small>
                          </span>
                          {suggestionLeads.has(lead.id) && (
                            <span className={styles.flag} title="Qiko suggests an action">
                              <Icon name="sparkles" size={11} />
                            </span>
                          )}
                        </span>
                        <span className={styles.meta}>
                          <span className="tag">{lead.source}</span>
                        </span>
                        <span className={styles.activity}>
                          <b>{lead.lastActivity?.title ?? "No activity"}</b>
                          <small>{lead.lastActivity ? timeAgo(lead.lastActivity.occurredAt, now || undefined) : "—"}</small>
                        </span>
                        <span className={styles.next}>{lead.nextActionLabel}</span>
                      </button>
                      <div className={styles.cardFoot}>
                        <span className={styles.owner}>
                          <MemberAvatar member={lead.ownerId ? memberById.get(lead.ownerId) : null} />
                          <span>{lead.ownerId ? memberById.get(lead.ownerId)?.name : "Unassigned"}</span>
                        </span>
                        <label className={styles.move}>
                          <span className="sr-only">Move {lead.name}</span>
                          <select
                            value={lead.status}
                            aria-label={`Move ${lead.name}`}
                            onChange={(event) => requestMove(lead, event.target.value as LeadStatus)}
                          >
                            {LEAD_STATUSES.map((item) => <option key={item}>{item}</option>)}
                          </select>
                        </label>
                      </div>
                    </article>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </section>

      <button type="button" className={styles.askStrip} onClick={() => askQiko("Which leads should I follow up with first?")}>
        <Icon name="sparkles" size={15} />
        Not sure where to start? Ask Qiko which leads to follow up with first.
        <Icon name="arrowRight" size={14} />
      </button>

      {panelLead && <LeadQuickPanel leadId={panelLead} onClose={() => setPanelLead(null)} />}
      {pending && (
        <ConfirmDialog
          title={`Update status for ${pending.lead.name}?`}
          description={<>Change status from <b>{pending.lead.status}</b> to <b>{pending.status}</b>. This is recorded on the lead&apos;s timeline.</>}
          confirmLabel="Yes, update"
          onCancel={() => setPending(null)}
          onConfirm={() => {
            crm.setLeadStatus(pending.lead.id, pending.status);
            toast(`Status updated to ${pending.status}`);
            setPending(null);
          }}
        />
      )}
    </div>
  );
}
