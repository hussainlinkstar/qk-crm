"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { crm } from "@/lib/crm-store";
import { initials, timeAgo } from "@/lib/format";
import type { LeadView } from "@/lib/insights";
import { LEAD_SOURCES, LEAD_STATUSES, type LeadStatus } from "@/lib/types";
import Button from "@/components/ui/Button";
import Icon from "@/components/ui/Icon";
import { ConfirmDialog } from "@/components/ui/Overlay";
import { EmptyState, SkeletonRows, useNow, useWorkspaceData } from "@/components/ui/bits";
import LeadQuickPanel from "@/components/leads/LeadQuickPanel";
import { useWorkspace } from "@/components/shell/WorkspaceContext";
import styles from "./leads.module.css";

const PAGE_SIZE = 15;
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

type PendingChange = { lead: LeadView; field: "status" | "owner"; value: string };

export default function LeadsPage() {
  return (
    <Suspense fallback={<div className="page"><SkeletonRows rows={8} /></div>}>
      <LeadsView />
    </Suspense>
  );
}

function LeadsView() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { state, workspace } = useWorkspaceData();
  const { openAddLead, toast, askQiko } = useWorkspace();
  const now = useNow();
  const [page, setPage] = useState(1);
  const [panelLead, setPanelLead] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingChange | null>(null);

  const q = params.get("q") ?? "";
  const status = params.get("status") ?? "";
  const source = params.get("source") ?? "";
  const owner = params.get("owner") ?? "";
  const activity = params.get("activity") ?? "";
  const sort = params.get("sort") ?? "recent";

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    setPage(1);
    router.replace(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false });
  };

  const suggestionLeads = useMemo(() => new Set(workspace?.suggestions.map((item) => item.leadId)), [workspace]);

  const filtered = useMemo(() => {
    if (!workspace) return [];
    const term = q.trim().toLowerCase();
    const list = workspace.leads.filter((lead) => {
      if (term && !`${lead.name} ${lead.email} ${lead.company ?? ""} ${lead.role ?? ""}`.toLowerCase().includes(term)) return false;
      if (status && lead.status !== status) return false;
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
  }, [workspace, q, status, source, owner, activity, sort, now, suggestionLeads]);

  if (!state || !workspace) {
    return (
      <div className="page">
        <SkeletonRows rows={8} />
      </div>
    );
  }

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pages);
  const visible = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);
  const rangeStart = visible.length ? (current - 1) * PAGE_SIZE + 1 : 0;
  const rangeEnd = rangeStart ? rangeStart + visible.length - 1 : 0;
  const memberById = new Map(state.members.map((member) => [member.id, member]));
  const statusCount = (value: string) => workspace.leads.filter((lead) => lead.status === value).length;
  const activeFilters = [source, owner, activity, q].filter(Boolean).length + (sort !== "recent" ? 1 : 0);

  const exportCsv = () => {
    const header = ["Name", "Email", "Phone", "Company", "Source", "Status", "Owner", "Last activity", "Last activity at", "Next action", "Engagement"];
    const rows = filtered.map((lead) => [lead.name, lead.email, lead.phone ?? "", lead.company ?? "", lead.source, lead.status, lead.ownerId ? memberById.get(lead.ownerId)?.name ?? "" : "", lead.lastActivity?.title ?? "", lead.lastActivity?.occurredAt ?? "", lead.nextActionLabel, String(lead.engagementScore)]);
    const csv = [header, ...rows].map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `qiko-core-leads-${new Date(now).toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast(`Exported ${filtered.length} leads`);
  };

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Leads</h1>
          <p className="subtitle">Every prospect from Qiko Signal, the website, free audits and manual entry — one record per person.</p>
        </div>
        <div className="page-actions">
          <Button variant="secondary" icon="board" onClick={() => {
            const next = new URLSearchParams(params.toString());
            next.delete("status");
            router.push(`/sales/pipeline${next.size ? `?${next}` : ""}`);
          }} className="mobile-icon-button" aria-label="Board view"><span className="mobile-icon-label">Board</span></Button>
          <Button variant="secondary" icon="file" className="mobile-icon-button" aria-label="Export CSV" onClick={exportCsv} disabled={!filtered.length}><span className="mobile-icon-label">Export CSV</span></Button>
          <Button icon="userPlus" className="mobile-icon-button" aria-label="Add lead" onClick={openAddLead}><span className="mobile-icon-label">Add lead</span></Button>
        </div>
      </header>

      <section className="card">
        <div className={styles.toolbar}>
          <div className="segmented" role="group" aria-label="Filter by status">
            <button type="button" aria-pressed={!status} onClick={() => setParam("status", "")}>
              All <span className="count">{workspace.leads.length}</span>
            </button>
            {LEAD_STATUSES.map((item) => (
              <button type="button" key={item} aria-pressed={status === item} onClick={() => setParam("status", item)}>
                {item} <span className="count">{statusCount(item)}</span>
              </button>
            ))}
          </div>
          <div className={styles.filters}>
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
              <Button size="small" variant="ghost" icon="x" onClick={() => { setPage(1); router.replace(status ? `${pathname}?status=${status}` : pathname, { scroll: false }); }}>
                Clear
              </Button>
            )}
          </div>
        </div>

        <p className={styles.resultLine}>
          {filtered.length ? (
            <>Showing <b>{rangeStart}–{rangeEnd}</b> of <b>{filtered.length}</b> {filtered.length === 1 ? "lead" : "leads"}</>
          ) : (
            <>Showing <b>0</b> of <b>0</b> leads</>
          )}
          {status && <> · status <b>{status}</b></>}
          {source && <> · source <b>{source}</b></>}
        </p>

        {filtered.length === 0 ? (
          <div className={styles.empty}>
            <EmptyState icon="search" title="No leads match these filters" actions={<><Button variant="secondary" onClick={() => router.replace(pathname)}>Clear filters</Button><Button icon="userPlus" onClick={openAddLead}>Add lead</Button></>}>
              Try a different search or filter, or add the lead manually.
            </EmptyState>
          </div>
        ) : (
          <div className="table-wrap">
            <table className={`table ${styles.table}`}>
              <colgroup>
                <col className={styles.leadColumn} />
                <col className={styles.companyColumn} />
                <col className={styles.sourceColumn} />
                <col className={styles.activityColumn} />
                <col className={styles.statusColumn} />
                <col className={styles.ownerColumn} />
                <col className={styles.nextColumn} />
                <col className={styles.actionsColumn} />
              </colgroup>
              <thead>
                <tr>
                  <th>Lead</th>
                  <th className={styles.company}>Company</th>
                  <th className={styles.sourceColumn}>Source</th>
                  <th className={styles.activityColumn}>Activity</th>
                  <th>Status</th>
                  <th>Owner</th>
                  <th>Next action</th>
                  <th aria-label="Actions" className={styles.sticky} />
                </tr>
              </thead>
              <tbody>
                {visible.map((lead) => (
                  <tr key={lead.id} className="clickable" onClick={() => setPanelLead(lead.id)}>
                    <td>
                      <span className={styles.person}>
                        <span className="avatar">{initials(lead.name)}</span>
                        <span>
                          <b>{lead.name}</b>
                          <small>{lead.email}</small>
                        </span>
                        {suggestionLeads.has(lead.id) && <span className={styles.flag} title="Qiko suggests an action"><Icon name="sparkles" size={11} /></span>}
                      </span>
                    </td>
                    <td className={`${styles.muted} ${styles.company}`}>{lead.company ?? "—"}</td>
                    <td className={styles.sourceColumn}><span className="tag">{lead.source}</span></td>
                    <td className={styles.activityColumn}>
                      <span className={styles.activity}>
                        <b>{lead.lastActivity?.title ?? "No activity"}</b>
                        <small>{lead.lastActivity ? timeAgo(lead.lastActivity.occurredAt, now || undefined) : "—"}</small>
                      </span>
                    </td>
                    <td onClick={(event) => event.stopPropagation()}>
                      <select className={`${styles.inlineSelect} chip-${lead.status.toLowerCase()}`} value={lead.status} aria-label={`Status for ${lead.name}`} onChange={(event) => setPending({ lead, field: "status", value: event.target.value })}>
                        {LEAD_STATUSES.map((item) => <option key={item}>{item}</option>)}
                      </select>
                    </td>
                    <td onClick={(event) => event.stopPropagation()}>
                      <select className={styles.ownerSelect} value={lead.ownerId ?? ""} aria-label={`Owner for ${lead.name}`} onChange={(event) => setPending({ lead, field: "owner", value: event.target.value })}>
                        <option value="">Unassigned</option>
                        {state.members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
                      </select>
                    </td>
                    <td className={`${styles.next} ${styles.nextColumn}`}>{lead.nextActionLabel}</td>
                    <td className={styles.sticky} onClick={(event) => event.stopPropagation()}>
                      <Button size="small" variant="secondary" onClick={() => router.push(`/sales/leads/${lead.id}`)}>View</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {pages > 1 && (
          <nav className={styles.pager} aria-label="Pagination">
            <span>Page {current} of {pages}</span>
            <div>
              <Button size="small" variant="secondary" icon="chevronLeft" disabled={current === 1} onClick={() => setPage(current - 1)} aria-label="Previous page" />
              {Array.from({ length: pages }, (_, index) => index + 1).map((number) => (
                <button type="button" key={number} className={styles.pageButton} aria-current={number === current ? "page" : undefined} onClick={() => setPage(number)}>
                  {number}
                </button>
              ))}
              <Button size="small" variant="secondary" icon="chevronRight" disabled={current === pages} onClick={() => setPage(current + 1)} aria-label="Next page" />
            </div>
          </nav>
        )}
      </section>

      <button type="button" className={styles.askStrip} onClick={() => askQiko("Which leads should I follow up with first?")}>
        <Icon name="sparkles" size={15} />
        Not sure where to start? Ask Qiko which leads to follow up with first.
        <Icon name="arrowRight" size={14} />
      </button>

      {panelLead && <LeadQuickPanel leadId={panelLead} onClose={() => setPanelLead(null)} />}
      {pending && (
        <ConfirmDialog
          title={`Update ${pending.field} for ${pending.lead.name}?`}
          description={
            pending.field === "status" ? (
              <>Change status from <b>{pending.lead.status}</b> to <b>{pending.value}</b>. This is recorded on the lead&apos;s timeline.</>
            ) : (
              <>Reassign from <b>{pending.lead.ownerId ? memberById.get(pending.lead.ownerId)?.name : "Unassigned"}</b> to <b>{pending.value ? memberById.get(pending.value)?.name : "Unassigned"}</b>.</>
            )
          }
          confirmLabel="Yes, update"
          onCancel={() => setPending(null)}
          onConfirm={() => {
            if (pending.field === "status") crm.updateLead(pending.lead.id, { status: pending.value as LeadStatus });
            else crm.updateLead(pending.lead.id, { ownerId: pending.value || null });
            toast(pending.field === "status" ? `Status updated to ${pending.value}` : "Owner updated");
            setPending(null);
          }}
        />
      )}
    </div>
  );
}
