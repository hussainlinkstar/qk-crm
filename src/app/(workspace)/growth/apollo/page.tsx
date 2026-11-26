"use client";

import { useMemo, useState } from "react";
import Button from "@/components/ui/Button";
import Icon from "@/components/ui/Icon";
import IconTile from "@/components/ui/IconTile";
import Select from "@/components/ui/Select";
import { EmptyState, SkeletonRows, useNow } from "@/components/ui/bits";
import { useWorkspace } from "@/components/shell/WorkspaceContext";
import { avatarStyle, initials, timeAgo } from "@/lib/format";
import { growth, useGrowth } from "@/lib/signal-growth/store";
import type { ApolloProspect } from "@/lib/signal-growth/types";
import styles from "@/app/(workspace)/sales/leads/leads.module.css";
import queueStyles from "@/components/sales/OriginationQueue.module.css";

const PAGE_SIZE = 15;

type Ready = "verified" | "website" | "email";

const READY_LABEL: Record<Ready, string> = {
  verified: "Verified",
  website: "No website",
  email: "Email not verified",
};

function readiness(person: ApolloProspect): Ready {
  if (person.verified && person.hasWebsite) return "verified";
  if (!person.hasWebsite) return "website";
  return "email";
}

export default function ApolloPage() {
  const state = useGrowth();
  const { toast, askQiko } = useWorkspace();
  const now = useNow();
  const [query, setQuery] = useState("Head of Marketing");
  const [country, setCountry] = useState("UAE");
  const [industry, setIndustry] = useState("E-commerce");
  const [ready, setReady] = useState<"" | Ready>("");
  const [picked, setPicked] = useState<string[]>([]);
  const [ownerId, setOwnerId] = useState("ed");
  const [segmentId, setSegmentId] = useState("sg_uae");
  const [queueAudit, setQueueAudit] = useState(false);
  const [layout, setLayout] = useState<"table" | "board">("table");
  const [page, setPage] = useState(1);
  const [queueOpen, setQueueOpen] = useState(false);

  const catalog = state?.apolloCatalog ?? [];
  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return catalog.filter((person) => {
      if (country && person.country !== country) return false;
      if (industry && person.industry !== industry) return false;
      if (ready && readiness(person) !== ready) return false;
      if (term && !`${person.firstName} ${person.lastName} ${person.email} ${person.company} ${person.title}`.toLowerCase().includes(term)) return false;
      return true;
    });
  }, [catalog, query, country, industry, ready]);

  if (!state) return <div className="page"><SkeletonRows rows={8} /></div>;

  const total = catalog.length || 1;
  const percent = (count: number) => Math.round((count / total) * 100);
  const verifiedCount = catalog.filter((person) => person.verified).length;
  const websiteCount = catalog.filter((person) => person.hasWebsite).length;
  const readyCount = catalog.filter((person) => readiness(person) === "verified").length;
  const creditPercent = Math.round((state.caps.apolloUsed / Math.max(state.caps.apolloCap, 1)) * 100);
  const insights = [
    { value: `${percent(verifiedCount)}%`, text: "of this search has a verified email.", detail: `${verifiedCount} of ${catalog.length} people` },
    { value: `${percent(websiteCount)}%`, text: "of this search has a company website.", detail: `${websiteCount} of ${catalog.length} people` },
    { value: `${percent(readyCount)}%`, text: "are ready to import.", detail: `${readyCount} of ${catalog.length} people` },
    { value: `${creditPercent}%`, text: "of today's Apollo credits are used.", detail: `${state.caps.apolloUsed} of ${state.caps.apolloCap} credits` },
  ];
  const readyPeople = catalog.filter((person) => readiness(person) === "verified");
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pages);
  const visible = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);
  const rangeStart = visible.length ? (current - 1) * PAGE_SIZE + 1 : 0;
  const rangeEnd = rangeStart ? rangeStart + visible.length - 1 : 0;
  const countOf = (value: Ready) => catalog.filter((person) => readiness(person) === value).length;
  const filtersOn = Boolean(query || country || industry || ready);

  const toggle = (person: ApolloProspect) => {
    if (readiness(person) !== "verified") return;
    setPicked((currentIds) => (currentIds.includes(person.id) ? currentIds.filter((id) => id !== person.id) : [...currentIds, person.id]));
  };

  const importSelected = () => {
    toast(growth.importApollo(picked, ownerId, segmentId, queueAudit).message);
    setPicked([]);
  };

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Apollo</h1>
          <p className="subtitle">Search, preview, then import. Only a verified email and a company website come in. Credits today {state.caps.apolloUsed}/{state.caps.apolloCap}.</p>
        </div>
        <div className="page-actions">
          <div className="segmented" role="group" aria-label="Layout">
            <button type="button" aria-pressed={layout === "table"} onClick={() => setLayout("table")}>Table</button>
            <button type="button" aria-pressed={layout === "board"} onClick={() => setLayout("board")}>Board</button>
          </div>
          <Button icon="userPlus" disabled={!picked.length} onClick={importSelected}>Import selected</Button>
        </div>
      </header>

      <section className={styles.insightSection} aria-label="Apollo insights">
        <div className={styles.insightHead}>
          <IconTile name="sparkles" tone="qiko" size="lg" />
          <div>
            <p className="kicker kicker-qiko">Qiko</p>
            <h2>Who is ready to import</h2>
          </div>
        </div>
        <div className={styles.insightStrip}>
          {insights.map((insight) => (
            <div key={insight.text} className={styles.insightCard}>
              <b className="tabular">{insight.value}</b>
              <span>{insight.text}</span>
              <small>{insight.detail}</small>
            </div>
          ))}
        </div>
      </section>

      <section className={`card ${queueStyles.queue}`} aria-labelledby="apollo-queue-title" data-collapsed={queueOpen ? undefined : "true"}>
        <div className={queueStyles.head}>
          <button type="button" className={queueStyles.headCopy} onClick={() => setQueueOpen((value) => !value)} aria-expanded={queueOpen}>
            <IconTile name="compass" tone="qiko" size="lg" />
            <div>
              <p className="kicker kicker-qiko">Qiko · Import queue</p>
              <h2 id="apollo-queue-title">
                Ready to import
                <span className={queueStyles.count}>{readyPeople.length}</span>
                <Icon name="chevronDown" size={16} className={queueStyles.chevron} />
              </h2>
              <p className={queueStyles.sub}>{queueOpen ? "Only a verified email and a company website come in." : "Collapsed. Open to see who has a verified email and a website."}</p>
            </div>
          </button>
        </div>
        {queueOpen ? (
          <ol className={queueStyles.list}>
            {readyPeople.map((person) => {
              const name = `${person.firstName} ${person.lastName}`;
              return (
                <li key={person.id} className={queueStyles.row}>
                  <span className={queueStyles.meter} data-level="3" aria-hidden="true" />
                  <span className="avatar avatar-sm" style={avatarStyle(name)}>{initials(name)}</span>
                  <div>
                    <b>{name}</b>
                    <p>{person.company} · {person.email}</p>
                  </div>
                  <Button size="small" variant="secondary" onClick={() => toggle(person)}>{picked.includes(person.id) ? "Selected" : "Select"}</Button>
                </li>
              );
            })}
          </ol>
        ) : null}
      </section>

      <section className="card">
        <div className={styles.toolbar}>
          <div className="segmented" role="group" aria-label="Filter by readiness">
            <button type="button" aria-pressed={!ready} onClick={() => { setReady(""); setPage(1); }}>
              All <span className="count">{catalog.length}</span>
            </button>
            {(Object.keys(READY_LABEL) as Ready[]).map((item) => (
              <button type="button" key={item} aria-pressed={ready === item} onClick={() => { setReady(item); setPage(1); }}>
                {READY_LABEL[item]} <span className="count">{countOf(item)}</span>
              </button>
            ))}
          </div>
          <div className={styles.filters}>
            <label className={`search-field ${styles.search}`}>
              <Icon name="search" size={15} />
              <input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Search name, email, company" aria-label="Search people" />
              {query ? (
                <button type="button" aria-label="Clear search" onClick={() => setQuery("")}>
                  <Icon name="x" size={13} />
                </button>
              ) : null}
            </label>
            <input className={`input ${styles.filter}`} value={country} onChange={(event) => { setCountry(event.target.value); setPage(1); }} aria-label="Country" placeholder="Country" />
            <input className={`input ${styles.filter}`} value={industry} onChange={(event) => { setIndustry(event.target.value); setPage(1); }} aria-label="Industry" placeholder="Industry" />
            <Select className={`select ${styles.filter}`} value={ownerId} onChange={(event) => setOwnerId(event.target.value)} aria-label="Owner">
              {state.owners.map((owner) => <option key={owner.id} value={owner.id}>{owner.name}</option>)}
            </Select>
            <Select className={`select ${styles.filter}`} value={segmentId} onChange={(event) => setSegmentId(event.target.value)} aria-label="Segment">
              {state.segments.map((segment) => <option key={segment.id} value={segment.id}>{segment.name}</option>)}
            </Select>
            <label className="notice-banner">
              <input type="checkbox" checked={queueAudit} onChange={(event) => setQueueAudit(event.target.checked)} /> Queue a prospect audit
            </label>
            {filtersOn ? (
              <Button size="small" variant="ghost" icon="x" onClick={() => { setQuery(""); setCountry(""); setIndustry(""); setReady(""); setPage(1); }}>Clear</Button>
            ) : null}
          </div>
        </div>

        <p className={styles.resultLine}>
          Showing <b>{layout === "table" && filtered.length ? `${rangeStart}–${rangeEnd}` : filtered.length}</b> of <b>{filtered.length}</b> {filtered.length === 1 ? "person" : "people"}
        </p>

        {filtered.length === 0 ? (
          <div className={styles.empty}>
            <EmptyState icon="search" title="No matches" actions={<Button variant="secondary" onClick={() => { setQuery(""); setCountry(""); setIndustry(""); setReady(""); }}>Clear filters</Button>}>
              Try heads of marketing at e-commerce brands in the UAE.
            </EmptyState>
          </div>
        ) : layout === "board" ? (
          <div className={styles.leadBoard}>
            {(Object.keys(READY_LABEL) as Ready[]).map((column) => {
              const items = filtered.filter((person) => readiness(person) === column);
              return (
                <div key={column} className={styles.boardColumn}>
                  <div className={styles.boardColumnHead}>
                    <b>{READY_LABEL[column]}</b>
                    <span className="chip tabular">{items.length}</span>
                  </div>
                  {items.map((person) => {
                    const name = `${person.firstName} ${person.lastName}`;
                    return (
                      <button key={person.id} type="button" className={styles.leadCard} onClick={() => toggle(person)}>
                        <span className={styles.person}>
                          <span className="avatar avatar-sm" style={avatarStyle(name)}>{initials(name)}</span>
                          <span>
                            <b>{name}</b>
                            <small>{person.company}</small>
                          </span>
                        </span>
                        <span className={styles.leadCardMeta}>
                          <span className="tag">Apollo</span>
                          <span className="muted">{person.title}</span>
                        </span>
                      </button>
                    );
                  })}
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
                {visible.map((person) => {
                  const name = `${person.firstName} ${person.lastName}`;
                  const status = readiness(person);
                  const selected = picked.includes(person.id);
                  return (
                    <tr key={person.id} className="clickable" onClick={() => toggle(person)}>
                      <td>
                        <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <input type="checkbox" disabled={status !== "verified"} checked={selected} onClick={(event) => event.stopPropagation()} onChange={() => toggle(person)} aria-label={`Select ${name}`} />
                          <span className={styles.person}>
                            <span className="avatar" style={avatarStyle(name)}>{initials(name)}</span>
                            <span>
                              <b>{name}</b>
                              <small>{person.email}</small>
                            </span>
                          </span>
                        </span>
                      </td>
                      <td className="muted">{person.company}</td>
                      <td><span className="tag">Apollo</span></td>
                      <td><span className={`chip ${status === "verified" ? "chip-qualified" : status === "website" ? "chip-pending" : "chip-lost"}`}>{READY_LABEL[status]}</span></td>
                      <td onClick={(event) => event.stopPropagation()}>
                        <Select className={styles.ownerSelect} value={ownerId} aria-label={`Owner for ${name}`} onChange={(event) => setOwnerId(event.target.value)}>
                          {state.owners.map((owner) => <option key={owner.id} value={owner.id}>{owner.name}</option>)}
                        </Select>
                      </td>
                      <td className={styles.next}>{status === "verified" ? (selected ? "Selected to import" : person.title) : READY_LABEL[status]}</td>
                      <td>
                        <span className={styles.activity}>
                          <b>{person.website ? person.website.replace(/^https?:\/\//, "") : "No website"}</b>
                          <small>{person.country} · {person.industry}</small>
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {layout === "table" && pages > 1 ? (
          <nav className={styles.pager} aria-label="Pagination">
            <span>Page {current} of {pages}</span>
            <div>
              <Button size="small" variant="secondary" icon="chevronLeft" disabled={current === 1} onClick={() => setPage(current - 1)} aria-label="Previous page" />
              <Button size="small" variant="secondary" icon="chevronRight" disabled={current === pages} onClick={() => setPage(current + 1)} aria-label="Next page" />
            </div>
          </nav>
        ) : null}
      </section>

      <button type="button" className={styles.askStrip} onClick={() => askQiko("Who in this Apollo search is ready to import?")}>
        <Icon name="sparkles" size={15} />
        Ask Qiko who is ready to import
        <Icon name="arrowRight" size={14} />
      </button>

      <section className="card">
        <div className="card-head"><h2>Import history</h2></div>
        <div className="table-wrap">
          <table className={`table ${styles.table}`}>
            <thead><tr><th>When</th><th>Search</th><th>Imported</th><th>Skipped</th><th>Credits</th></tr></thead>
            <tbody>
              {state.apolloImports.map((row) => (
                <tr key={row.id}>
                  <td>{timeAgo(row.at, now || undefined)}</td>
                  <td>{row.search}</td>
                  <td className="tabular">{row.imported}</td>
                  <td className="tabular">{row.skipped}</td>
                  <td className="tabular">{row.credits}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
