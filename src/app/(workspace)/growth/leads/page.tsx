"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState, type DragEvent } from "react";
import Button from "@/components/ui/Button";
import Icon from "@/components/ui/Icon";
import Select from "@/components/ui/Select";
import { OutcomeGrid, PageHero } from "@/components/ui/workspace";
import { Modal } from "@/components/ui/Overlay";
import { EmptyState, SkeletonRows } from "@/components/ui/bits";
import AddSignalLeadModal from "@/components/growth/AddSignalLeadModal";
import { useWorkspace } from "@/components/shell/WorkspaceContext";
import { initials, timeAgo } from "@/lib/format";
import { fullName, matchLead, planOf } from "@/lib/signal-growth/engine";
import { growth, useGrowth } from "@/lib/signal-growth/store";
import { PLANS, SOURCES, STAGES, type LeadQuery, type Stage } from "@/lib/signal-growth/types";
import styles from "@/app/(workspace)/sales/leads/leads.module.css";
import signal from "../signal.module.css";

const PAGE_SIZE = 15;

const STAGE_CHIP: Record<Stage, string> = {
  New: "chip-new",
  Contacted: "chip-contacted",
  Replied: "chip-qualified",
  "Signed up": "chip-working",
  "Audit run": "chip-ai",
  "Checkout started": "chip-pending",
  Paid: "chip-won",
  Lost: "chip-lost",
};

function readQuery(params: URLSearchParams): LeadQuery {
  return {
    q: params.get("q") ?? "",
    stage: (params.get("stage") ?? "") as LeadQuery["stage"],
    source: (params.get("source") ?? "") as LeadQuery["source"],
    country: params.get("country") ?? "",
    industry: params.get("industry") ?? "",
    plan: (params.get("plan") ?? "") as LeadQuery["plan"],
    ownerId: params.get("owner") ?? "",
    preset: (params.get("preset") ?? "") as LeadQuery["preset"],
  };
}

export default function LeadsPage() {
  return (
    <Suspense fallback={<div className="page"><SkeletonRows rows={8} /></div>}>
      <LeadsBody />
    </Suspense>
  );
}

function LeadsBody() {
  const state = useGrowth();
  const router = useRouter();
  const params = useSearchParams();
  const { toast } = useWorkspace();
  const filter = readQuery(params);
  const [layout, setLayout] = useState<"table" | "board">("table");
  const [page, setPage] = useState(1);
  const [addOpen, setAddOpen] = useState(false);
  const [csvOpen, setCsvOpen] = useState(false);
  const [csvText, setCsvText] = useState("first,last,email,company,website,country,industry,title");
  const [segmentName, setSegmentName] = useState("");
  const [dragOver, setDragOver] = useState<Stage | null>(null);
  const [lostFor, setLostFor] = useState<string | null>(null);
  const [reason, setReason] = useState("Not a fit");

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    setPage(1);
    router.replace(`/growth/leads${next.size ? `?${next}` : ""}`, { scroll: false });
  };

  const leads = useMemo(() => (state ? state.leads.filter((lead) => matchLead(lead, filter)) : []), [state, filter]);
  if (!state) return <div className="page"><SkeletonRows rows={8} /></div>;

  const stageCount = (stage: Stage) => state.leads.filter((lead) => lead.stage === stage).length;
  const pages = Math.max(1, Math.ceil(leads.length / PAGE_SIZE));
  const current = Math.min(page, pages);
  const visible = leads.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);
  const rangeStart = visible.length ? (current - 1) * PAGE_SIZE + 1 : 0;
  const rangeEnd = rangeStart ? rangeStart + visible.length - 1 : 0;
  const activeFilters = [filter.q, filter.source, filter.country, filter.industry, filter.plan, filter.ownerId, filter.preset].filter(Boolean).length;

  const move = (event: DragEvent, stage: Stage) => {
    event.preventDefault();
    const id = event.dataTransfer.getData("text/lead-id");
    setDragOver(null);
    if (!id) return;
    if (stage === "Lost") {
      setLostFor(id);
      return;
    }
    growth.setStage(id, stage);
    toast(`Stage → ${stage}`);
  };

  return (
    <div className="page">
      <PageHero
        kicker="Signal"
        title="Leads"
        lede="One list for outreach and for Signal users. The same email or domain never creates a second lead."
        action={
          <>
            <div className="segmented" role="group" aria-label="Layout">
              <button type="button" aria-pressed={layout === "table"} onClick={() => setLayout("table")}>Table</button>
              <button type="button" aria-pressed={layout === "board"} onClick={() => setLayout("board")}>Board</button>
            </div>
            <Button variant="secondary" onClick={() => setCsvOpen(true)}>Import CSV</Button>
            <Button icon="userPlus" onClick={() => setAddOpen(true)}>Add lead</Button>
          </>
        }
      />

      <OutcomeGrid
        label="Saved segments"
        tiles={state.segments.slice(0, 4).map((segment) => {
          const next = new URLSearchParams();
          Object.entries(segment.filter).forEach(([key, value]) => {
            if (!value) return;
            next.set(key === "ownerId" ? "owner" : key, String(value));
          });
          return {
            key: segment.id,
            href: `/growth/leads${next.size ? `?${next}` : ""}`,
            label: segment.name,
            numeric: state.leads.filter((lead) => matchLead(lead, segment.filter)).length,
            sub: "Same filters as this list",
            icon: "sparkles" as const,
            iconTone: "qiko" as const,
            tone: "qiko" as const,
          };
        })}
      />

      <section className="card">
        <div className={styles.toolbar}>
          <div className="segmented" role="group" aria-label="Filter by stage">
            <button type="button" aria-pressed={!filter.stage} onClick={() => setParam("stage", "")}>All <span className="count">{state.leads.length}</span></button>
            {STAGES.map((stage) => (
              <button type="button" key={stage} aria-pressed={filter.stage === stage} onClick={() => setParam("stage", filter.stage === stage ? "" : stage)}>
                {stage} <span className="count">{stageCount(stage)}</span>
              </button>
            ))}
          </div>
          <div className={styles.filters}>
            <label className={`search-field ${styles.search}`}>
              <Icon name="search" size={15} />
              <input value={filter.q ?? ""} onChange={(event) => setParam("q", event.target.value)} placeholder="Search name, email, company" aria-label="Search leads" />
            </label>
            <Select className={`select ${styles.filter}`} value={filter.source ?? ""} onChange={(event) => setParam("source", event.target.value)} aria-label="Source">
              <option value="">All sources</option>
              {SOURCES.map((source) => <option key={source}>{source}</option>)}
            </Select>
            <Select className={`select ${styles.filter}`} value={filter.plan ?? ""} onChange={(event) => setParam("plan", event.target.value)} aria-label="Plan">
              <option value="">All plans</option>
              {PLANS.map((plan) => <option key={plan}>{plan}</option>)}
            </Select>
            <Select className={`select ${styles.filter}`} value={filter.ownerId ?? ""} onChange={(event) => setParam("owner", event.target.value)} aria-label="Owner">
              <option value="">All owners</option>
              <option value="none">Unassigned</option>
              {state.owners.map((owner) => <option key={owner.id} value={owner.id}>{owner.name}</option>)}
            </Select>
            <input className={`input ${styles.filter}`} value={filter.country ?? ""} onChange={(event) => setParam("country", event.target.value)} placeholder="Country" aria-label="Country" />
            <input className={`input ${styles.filter}`} value={filter.industry ?? ""} onChange={(event) => setParam("industry", event.target.value)} placeholder="Industry" aria-label="Industry" />
            <input className={`input ${styles.filter}`} placeholder="Save these filters as a segment" value={segmentName} onChange={(event) => setSegmentName(event.target.value)} aria-label="Segment name" />
            <Button size="small" variant="secondary" disabled={!segmentName.trim()} onClick={() => { growth.saveSegment(segmentName.trim(), filter); toast("Segment saved"); setSegmentName(""); }}>Save segment</Button>
            {activeFilters > 0 && <Button size="small" variant="ghost" icon="x" onClick={() => router.replace("/growth/leads")}>Clear</Button>}
          </div>
        </div>
        <p className={styles.resultLine}>
          Showing <b>{layout === "table" && leads.length ? `${rangeStart}–${rangeEnd}` : leads.length}</b> of <b>{leads.length}</b> {leads.length === 1 ? "lead" : "leads"}
        </p>

        {leads.length === 0 ? (
          <div className={styles.empty}>
            <EmptyState icon="search" title="No leads match these filters" actions={<Button variant="secondary" onClick={() => router.replace("/growth/leads")}>Clear filters</Button>}>
              Try a different search or add the lead.
            </EmptyState>
          </div>
        ) : layout === "board" ? (
          <div className={signal.wideBoard}>
            {STAGES.map((stage) => {
              const items = leads.filter((lead) => lead.stage === stage);
              return (
                <div key={stage} className={`${styles.boardColumn} ${dragOver === stage ? styles.boardColumnOver : ""}`} onDragOver={(event) => { event.preventDefault(); setDragOver(stage); }} onDrop={(event) => move(event, stage)}>
                  <div className={styles.boardColumnHead}><b>{stage}</b><span className="chip tabular">{items.length}</span></div>
                  {items.map((lead) => (
                    <button key={lead.id} type="button" draggable className={styles.leadCard} onClick={() => router.push(`/growth/leads/${lead.id}`)} onDragStart={(event) => event.dataTransfer.setData("text/lead-id", lead.id)}>
                      <span className={styles.person}>
                        <span className="avatar avatar-sm">{initials(fullName(lead))}</span>
                        <span><b>{fullName(lead)}</b><small>{lead.company || "No company"}</small></span>
                      </span>
                      <span className={styles.leadCardMeta}><span className="tag">{lead.source}</span><span className="muted">{planOf(lead)}</span></span>
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
                  <tr key={lead.id} className="clickable" onClick={() => router.push(`/growth/leads/${lead.id}`)}>
                    <td>
                      <span className={styles.person}>
                        <span className="avatar">{initials(fullName(lead))}</span>
                        <span><b>{fullName(lead)}</b><small>{lead.email}</small></span>
                      </span>
                    </td>
                    <td className="muted">{lead.company || "—"}</td>
                    <td><span className="tag">{lead.source}</span></td>
                    <td onClick={(event) => event.stopPropagation()}>
                      <Select
                        className={`${styles.inlineSelect} ${STAGE_CHIP[lead.stage]}`}
                        value={lead.stage}
                        aria-label={`Status for ${fullName(lead)}`}
                        onChange={(event) => {
                          const next = event.target.value as Stage;
                          if (next === "Lost") {
                            setLostFor(lead.id);
                            setReason(lead.lostReason || "Not a fit");
                            return;
                          }
                          growth.setStage(lead.id, next);
                          toast(`Stage → ${next}`);
                        }}
                      >
                        {STAGES.map((stage) => <option key={stage}>{stage}</option>)}
                      </Select>
                    </td>
                    <td onClick={(event) => event.stopPropagation()}>
                      <Select className={styles.ownerSelect} value={lead.ownerId ?? ""} aria-label={`Owner for ${fullName(lead)}`} onChange={(event) => growth.setOwner(lead.id, event.target.value || null)}>
                        <option value="">Unassigned</option>
                        {state.owners.map((owner) => <option key={owner.id} value={owner.id}>{owner.name}</option>)}
                      </Select>
                    </td>
                    <td className={styles.next}>{lead.tasks.find((task) => !task.done)?.text ?? (lead.dnc.email ? "Do not contact" : planOf(lead))}</td>
                    <td>
                      <span className={styles.activity}>
                        <b>{lead.timeline[0]?.summary ?? "No activity"}</b>
                        <small>{timeAgo(lead.timeline[0]?.at ?? lead.createdAt)}</small>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {layout === "table" && leads.length > PAGE_SIZE && (
          <div className={styles.pager}>
            <span>Page {current} of {pages}</span>
            <div>
              <button type="button" className={styles.pageButton} disabled={current === 1} onClick={() => setPage(current - 1)}>Prev</button>
              <button type="button" className={styles.pageButton} disabled={current === pages} onClick={() => setPage(current + 1)}>Next</button>
            </div>
          </div>
        )}
      </section>

      {addOpen && <AddSignalLeadModal owners={state.owners} onClose={() => setAddOpen(false)} />}
      {csvOpen && (
        <Modal kicker="Import" title="Import CSV" description="Columns: first, last, email, company, website, country, industry, title. Duplicate emails and domains are skipped." onClose={() => setCsvOpen(false)} footer={<><Button variant="secondary" onClick={() => setCsvOpen(false)}>Cancel</Button><Button type="submit" form="csv-import">Import</Button></>}>
          <form id="csv-import" onSubmit={(event) => { event.preventDefault(); const result = growth.importCsv(csvText, "ed"); toast(result.message); setCsvOpen(false); }}>
            <label className="field"><span>CSV</span><textarea className="input" rows={6} value={csvText} onChange={(event) => setCsvText(event.target.value)} /></label>
          </form>
        </Modal>
      )}
      {lostFor && (
        <Modal kicker="Pipeline" title="Mark lost" description="A reason is kept on the lead." onClose={() => setLostFor(null)} footer={<><Button variant="secondary" onClick={() => setLostFor(null)}>Cancel</Button><Button type="submit" form="lost-reason">Mark lost</Button></>}>
          <form id="lost-reason" onSubmit={(event) => { event.preventDefault(); growth.setStage(lostFor, "Lost", reason); toast("Stage → Lost"); setLostFor(null); }}>
            <label className="field"><span>Reason</span><input className="input" value={reason} onChange={(event) => setReason(event.target.value)} required /></label>
          </form>
        </Modal>
      )}
    </div>
  );
}
