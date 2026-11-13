"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Select from "@/components/ui/Select";
import { Suspense, useMemo, useState, type DragEvent } from "react";
import { crm } from "@/lib/crm-store";
import { initials, timeAgo } from "@/lib/format";
import type { LeadView } from "@/lib/insights";
import { LEAD_SOURCES, LEAD_STATUSES, type LeadStatus } from "@/lib/types";
import Button from "@/components/ui/Button";
import Icon from "@/components/ui/Icon";
import IconTile from "@/components/ui/IconTile";
import { EmptyState, SkeletonRows, useNow, useWorkspaceData } from "@/components/ui/bits";
import LeadQuickPanel from "@/components/leads/LeadQuickPanel";
import OriginationQueue from "@/components/sales/OriginationQueue";
import { useWorkspace } from "@/components/shell/WorkspaceContext";
import styles from "./leads.module.css";

const PAGE_SIZE = 15;
const ACTIVITY_FILTERS = [
  ["", "Any activity"],
  ["attention", "Needs attention"],
  ["open_task", "Has open task"],
  ["no_owner", "Unassigned"],
] as const;
const SORTS = [
  ["recent", "Last activity"],
  ["newest", "Newest leads"],
  ["name", "Name A–Z"],
] as const;
const RELATIONSHIP_SOURCES = new Set(["Referral", "Associate introduction", "SIA introduction", "Partner", "Existing client"]);
const NEW_CONNECTION_SOURCES = new Set(["Inbound", "Campaign", "Website", "Event", "Outbound"]);

export default function LeadsPage() {
  return (
    <Suspense
      fallback={
        <div className="page">
          <SkeletonRows rows={8} />
        </div>
      }
    >
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
  const [layout, setLayout] = useState<"table" | "board">("table");
  const [flashId, setFlashId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<LeadStatus | null>(null);

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
      if (activity === "open_task" && lead.openTasks.length === 0) return false;
      if (activity === "no_owner" && lead.ownerId) return false;
      if (activity === "attention" && !suggestionLeads.has(lead.id)) return false;
      return true;
    });
    return list.sort((a, b) => {
      if (sort === "newest") return b.createdAt.localeCompare(a.createdAt);
      if (sort === "name") return a.name.localeCompare(b.name);
      return (b.lastActivity?.occurredAt ?? b.createdAt).localeCompare(a.lastActivity?.occurredAt ?? a.createdAt);
    });
  }, [workspace, q, status, source, owner, activity, sort, suggestionLeads]);

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
  const leadInsights = (() => {
    const total = workspace.leads.length || 1;
    const percent = (count: number) => Math.round((count / total) * 100);
    const websiteCount = workspace.leads.filter((lead) => lead.source === "Website").length;
    const relationshipCount = workspace.leads.filter((lead) => RELATIONSHIP_SOURCES.has(lead.source)).length;
    const newConnectionCount = workspace.leads.filter((lead) => NEW_CONNECTION_SOURCES.has(lead.source)).length;
    const sectors = workspace.leads.reduce<Map<string, number>>((counts, lead) => {
      const sectorName = lead.sector?.trim();
      if (sectorName) counts.set(sectorName, (counts.get(sectorName) ?? 0) + 1);
      return counts;
    }, new Map());
    const topSector = [...sectors.entries()].sort((a, b) => b[1] - a[1])[0] ?? null;
    return [
      {
        value: `${percent(websiteCount)}%`,
        text: "of leads came through the website.",
        detail: `${websiteCount} of ${workspace.leads.length} leads`,
      },
      {
        value: `${percent(relationshipCount)}%`,
        text: "of leads came through a recorded relationship source.",
        detail: `${relationshipCount} of ${workspace.leads.length} leads`,
      },
      {
        value: `${percent(newConnectionCount)}%`,
        text: "came through new outreach or inbound channels.",
        detail: `${newConnectionCount} of ${workspace.leads.length} leads`,
      },
      topSector
        ? {
            value: `${percent(topSector[1])}%`,
            text: `of all leads are recorded in ${topSector[0]}.`,
            detail: `${topSector[1]} of ${workspace.leads.length} leads`,
          }
        : {
            value: "0%",
            text: "of leads have a recorded sector.",
            detail: "Add sector data to unlock this insight",
          },
    ];
  })();

  const flash = (leadId: string) => {
    setFlashId(leadId);
    window.setTimeout(() => setFlashId((currentId) => (currentId === leadId ? null : currentId)), 700);
  };

  const updateStatus = (lead: LeadView, value: LeadStatus) => {
    if (lead.status === value) return;
    if (value === "Converted" && !lead.convertedOpportunityId) {
      setPanelLead(lead.id);
      toast("Open the lead and use Convert to opportunity.");
      return;
    }
    crm.updateLead(lead.id, { status: value });
    toast(`Status → ${value}`);
    flash(lead.id);
  };

  const updateOwner = (lead: LeadView, value: string) => {
    const nextOwner = value || null;
    if ((lead.ownerId ?? null) === nextOwner) return;
    crm.updateLead(lead.id, { ownerId: nextOwner });
    toast(nextOwner ? `Owner → ${memberById.get(nextOwner)?.name ?? "Updated"}` : "Owner cleared");
    flash(lead.id);
  };

  const moveLead = (event: DragEvent, nextStatus: LeadStatus) => {
    event.preventDefault();
    const id = event.dataTransfer.getData("text/lead-id");
    const lead = workspace.leads.find((item) => item.id === id);
    setDraggingId(null);
    setDragOver(null);
    if (!lead || lead.status === nextStatus) return;
    if (nextStatus === "Converted" && !lead.convertedOpportunityId) {
      setPanelLead(lead.id);
      toast("Open the lead and use Convert to opportunity.");
      return;
    }
    updateStatus(lead, nextStatus);
  };

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Leads</h1>
          <p className="subtitle">Qualify prospects into opportunities.</p>
        </div>
        <div className="page-actions">
          <div className="segmented" role="group" aria-label="Layout">
            <button type="button" aria-pressed={layout === "table"} onClick={() => setLayout("table")}>
              Table
            </button>
            <button type="button" aria-pressed={layout === "board"} onClick={() => setLayout("board")}>
              Board
            </button>
          </div>
          <Button icon="userPlus" className="mobile-icon-button mobile-main-button" aria-label="Add lead" onClick={openAddLead}>
            <span className="mobile-icon-label">Add lead</span>
          </Button>
        </div>
      </header>

      <section className={styles.insightSection} aria-label="Lead insights">
        <div className={styles.insightHead}>
          <IconTile name="sparkles" tone="qiko" size="lg" />
          <div>
            <p className="kicker kicker-qiko">Qiko</p>
            <h2>Where leads come from</h2>
          </div>
        </div>
        <div className={styles.insightStrip}>
          {leadInsights.map((insight) => (
            <div key={insight.text} className={styles.insightCard}>
              <b className="tabular">{insight.value}</b>
              <span>{insight.text}</span>
              <small>{insight.detail}</small>
            </div>
          ))}
        </div>
      </section>

      <OriginationQueue onOpenLead={(leadId) => setPanelLead(leadId)} />

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
            <label className={`search-field ${styles.search}`}>
              <Icon name="search" size={15} />
              <input value={q} onChange={(event) => setParam("q", event.target.value)} placeholder="Search name, email, company" aria-label="Search leads" />
              {q && (
                <button type="button" aria-label="Clear search" onClick={() => setParam("q", "")}>
                  <Icon name="x" size={13} />
                </button>
              )}
            </label>
            <Select className={`select ${styles.filter}`} value={source} onChange={(event) => setParam("source", event.target.value)} aria-label="Source">
              <option value="">All sources</option>
              {LEAD_SOURCES.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </Select>
            <Select className={`select ${styles.filter}`} value={owner} onChange={(event) => setParam("owner", event.target.value)} aria-label="Owner">
              <option value="">All owners</option>
              <option value="none">Unassigned</option>
              {state.members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.id === "me" ? "Me" : member.name}
                </option>
              ))}
            </Select>
            <Select className={`select ${styles.filter}`} value={activity} onChange={(event) => setParam("activity", event.target.value)} aria-label="Activity">
              {ACTIVITY_FILTERS.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
            <Select
              className={`select ${styles.filter}`}
              value={sort}
              onChange={(event) => setParam("sort", event.target.value === "recent" ? "" : event.target.value)}
              aria-label="Sort"
            >
              {SORTS.map(([value, label]) => (
                <option key={value} value={value}>
                  Sort: {label}
                </option>
              ))}
            </Select>
            {activeFilters > 0 && (
              <Button
                size="small"
                variant="ghost"
                icon="x"
                onClick={() => {
                  setPage(1);
                  router.replace(status ? `${pathname}?status=${status}` : pathname, { scroll: false });
                }}
              >
                Clear
              </Button>
            )}
          </div>
        </div>

        <p className={styles.resultLine}>
          {filtered.length ? (
            <>
              Showing <b>{layout === "table" ? `${rangeStart}–${rangeEnd}` : filtered.length}</b> of <b>{filtered.length}</b>{" "}
              {filtered.length === 1 ? "lead" : "leads"}
            </>
          ) : (
            <>
              Showing <b>0</b> of <b>0</b> leads
            </>
          )}
        </p>

        {filtered.length === 0 ? (
          <div className={styles.empty}>
            <EmptyState
              icon="search"
              title="No leads match these filters"
              actions={
                <>
                  <Button variant="secondary" onClick={() => router.replace(pathname)}>
                    Clear filters
                  </Button>
                  <Button icon="userPlus" onClick={openAddLead}>
                    Add lead
                  </Button>
                </>
              }
            >
              Try a different search or add the lead.
            </EmptyState>
          </div>
        ) : layout === "board" ? (
          <div className={styles.leadBoard}>
            {LEAD_STATUSES.map((columnStatus) => {
              const items = filtered.filter((lead) => lead.status === columnStatus);
              return (
                <div
                  key={columnStatus}
                  className={`${styles.boardColumn} ${dragOver === columnStatus ? styles.boardColumnOver : ""}`}
                  onDragOver={(event) => {
                    event.preventDefault();
                    event.dataTransfer.dropEffect = "move";
                    setDragOver(columnStatus);
                  }}
                  onDragLeave={() => setDragOver((currentStatus) => (currentStatus === columnStatus ? null : currentStatus))}
                  onDrop={(event) => moveLead(event, columnStatus)}
                >
                  <div className={styles.boardColumnHead}>
                    <b>{columnStatus}</b>
                    <span className="chip tabular">{items.length}</span>
                  </div>
                  {items.map((lead) => (
                    <button
                      key={lead.id}
                      type="button"
                      draggable
                      className={`${styles.leadCard} ${flashId === lead.id ? styles.flash : ""} ${draggingId === lead.id ? styles.leadCardDragging : ""}`}
                      onClick={() => setPanelLead(lead.id)}
                      onDragStart={(event) => {
                        event.dataTransfer.setData("text/lead-id", lead.id);
                        event.dataTransfer.effectAllowed = "move";
                        setDraggingId(lead.id);
                      }}
                      onDragEnd={() => {
                        setDraggingId(null);
                        setDragOver(null);
                      }}
                    >
                      <span className={styles.person}>
                        <span className="avatar avatar-sm">{initials(lead.name)}</span>
                        <span>
                          <b>{lead.name}</b>
                          <small>{lead.company ?? "No company"}</small>
                        </span>
                      </span>
                      <span className={styles.leadCardMeta}>
                        <span className="tag">{lead.source}</span>
                        <span className="muted">{lead.nextActionLabel}</span>
                      </span>
                    </button>
                  ))}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="table-wrap">
            <table className={`table ${styles.table}`}>
              <thead>
                <tr>
                  <th>Lead</th>
                  <th>Company</th>
                  <th>Source</th>
                  <th>Status</th>
                  <th>Owner</th>
                  <th>Next action</th>
                  <th>Last activity</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((lead) => (
                  <tr
                    key={lead.id}
                    className={`clickable ${flashId === lead.id ? styles.flashRow : ""}`}
                    onClick={() => setPanelLead(lead.id)}
                  >
                    <td>
                      <span className={styles.person}>
                        <span className="avatar">{initials(lead.name)}</span>
                        <span>
                          <b>{lead.name}</b>
                          <small>{lead.email}</small>
                        </span>
                      </span>
                    </td>
                    <td className="muted">{lead.company ?? "—"}</td>
                    <td>
                      <span className="tag">{lead.source}</span>
                    </td>
                    <td onClick={(event) => event.stopPropagation()}>
                      <Select
                        className={`${styles.inlineSelect} chip-${lead.status.toLowerCase()}`}
                        value={lead.status}
                        disabled={lead.status === "Converted"}
                        aria-label={`Status for ${lead.name}`}
                        onChange={(event) => updateStatus(lead, event.target.value as LeadStatus)}
                      >
                        {LEAD_STATUSES.map((item) => (
                          <option key={item}>{item}</option>
                        ))}
                      </Select>
                    </td>
                    <td onClick={(event) => event.stopPropagation()}>
                      <Select
                        className={styles.ownerSelect}
                        value={lead.ownerId ?? ""}
                        aria-label={`Owner for ${lead.name}`}
                        onChange={(event) => updateOwner(lead, event.target.value)}
                      >
                        <option value="">Unassigned</option>
                        {state.members.map((member) => (
                          <option key={member.id} value={member.id}>
                            {member.name}
                          </option>
                        ))}
                      </Select>
                    </td>
                    <td className={styles.next}>{lead.nextActionLabel}</td>
                    <td>
                      <span className={styles.activity}>
                        <b>{lead.lastActivity?.title ?? "No activity"}</b>
                        <small>{lead.lastActivity ? timeAgo(lead.lastActivity.occurredAt, now || undefined) : "—"}</small>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {layout === "table" && pages > 1 && (
          <nav className={styles.pager} aria-label="Pagination">
            <span>
              Page {current} of {pages}
            </span>
            <div>
              <Button size="small" variant="secondary" icon="chevronLeft" disabled={current === 1} onClick={() => setPage(current - 1)} aria-label="Previous page" />
              <Button size="small" variant="secondary" icon="chevronRight" disabled={current === pages} onClick={() => setPage(current + 1)} aria-label="Next page" />
            </div>
          </nav>
        )}
      </section>

      <button type="button" className={styles.askStrip} onClick={() => askQiko("Which leads should I qualify or convert next?")}>
        <Icon name="sparkles" size={15} />
        Ask Qiko about qualification priorities
        <Icon name="arrowRight" size={14} />
      </button>

      {panelLead && <LeadQuickPanel leadId={panelLead} onClose={() => setPanelLead(null)} />}
    </div>
  );
}
