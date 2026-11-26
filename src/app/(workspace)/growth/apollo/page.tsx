"use client";

import { useMemo, useState } from "react";
import Button from "@/components/ui/Button";
import Icon from "@/components/ui/Icon";
import Select from "@/components/ui/Select";
import { EmptyState, SkeletonRows } from "@/components/ui/bits";
import { useWorkspace } from "@/components/shell/WorkspaceContext";
import { growth, useGrowth } from "@/lib/signal-growth/store";
import leads from "@/app/(workspace)/sales/leads/leads.module.css";
import { PageHero } from "@/components/ui/workspace";

export default function ApolloPage() {
  const state = useGrowth();
  const { toast } = useWorkspace();
  const [country, setCountry] = useState("UAE");
  const [industry, setIndustry] = useState("E-commerce");
  const [title, setTitle] = useState("Head of Marketing");
  const [picked, setPicked] = useState<string[]>([]);
  const [ownerId, setOwnerId] = useState("ed");
  const [segmentId, setSegmentId] = useState("sg_uae");
  const [queueAudit, setQueueAudit] = useState(false);

  const results = useMemo(() => {
    if (!state) return [];
    return state.apolloCatalog.filter((person) => {
      if (country && person.country !== country) return false;
      if (industry && person.industry !== industry) return false;
      if (title && !person.title.toLowerCase().includes(title.toLowerCase())) return false;
      return true;
    });
  }, [state, country, industry, title]);

  if (!state) return <div className="page"><SkeletonRows rows={4} /></div>;

  return (
    <div className="page">
      <PageHero kicker="Signal" title="Apollo" lede={`Search, preview, then import. Only a verified email and a company website come in. Credits today ${state.caps.apolloUsed}/${state.caps.apolloCap}.`} />

      <section className="card">
        <div className={leads.toolbar}>
          <div className={leads.filters}>
            <label className={`search-field ${leads.search}`}>
              <Icon name="search" size={15} />
              <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Job title" aria-label="Job title" />
            </label>
            <input className={`input ${leads.filter}`} value={country} onChange={(event) => setCountry(event.target.value)} aria-label="Country" placeholder="Country" />
            <input className={`input ${leads.filter}`} value={industry} onChange={(event) => setIndustry(event.target.value)} aria-label="Industry" placeholder="Industry" />
          </div>
        </div>
        <p className={leads.resultLine}>Showing <b>{results.length}</b> {results.length === 1 ? "person" : "people"}</p>
        {results.length === 0 ? (
          <div className={leads.empty}><EmptyState icon="search" title="No matches">Try heads of marketing at e-commerce brands in the UAE.</EmptyState></div>
        ) : (
          <div className="table-wrap">
            <table className={`table ${leads.table}`}>
              <thead><tr><th></th><th>Person</th><th>Company</th><th>Email</th><th>Ready</th></tr></thead>
              <tbody>
                {results.map((person) => {
                  const ready = person.verified && person.hasWebsite;
                  return (
                    <tr key={person.id}>
                      <td><input type="checkbox" disabled={!ready} checked={picked.includes(person.id)} onChange={(event) => setPicked((current) => event.target.checked ? [...current, person.id] : current.filter((id) => id !== person.id))} aria-label={`Select ${person.firstName}`} /></td>
                      <td>
                        <span className={leads.person}>
                          <span><b>{person.firstName} {person.lastName}</b><small>{person.title}</small></span>
                        </span>
                      </td>
                      <td className={leads.company}>{person.company}<div className="muted">{person.website || "No website"}</div></td>
                      <td>{person.email}</td>
                      <td>{ready ? <span className="chip">Verified</span> : <span className="muted">{person.verified ? "No website" : "Email not verified"}</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <div className={leads.filters} style={{ padding: "12px 18px 16px" }}>
          <Select className={`select ${leads.filter}`} value={ownerId} onChange={(event) => setOwnerId(event.target.value)} aria-label="Owner">
            {state.owners.map((owner) => <option key={owner.id} value={owner.id}>{owner.name}</option>)}
          </Select>
          <Select className={`select ${leads.filter}`} value={segmentId} onChange={(event) => setSegmentId(event.target.value)} aria-label="Segment">
            {state.segments.map((segment) => <option key={segment.id} value={segment.id}>{segment.name}</option>)}
          </Select>
          <label className="notice-banner"><input type="checkbox" checked={queueAudit} onChange={(event) => setQueueAudit(event.target.checked)} /> Queue a prospect audit</label>
          <Button disabled={!picked.length} onClick={() => { toast(growth.importApollo(picked, ownerId, segmentId, queueAudit).message); setPicked([]); }}>Import selected</Button>
        </div>
      </section>

      <section className="card">
        <div className="card-head"><h2>Import history</h2></div>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>When</th><th>Search</th><th>Imported</th><th>Skipped</th><th>Credits</th></tr></thead>
            <tbody>
              {state.apolloImports.map((row) => (
                <tr key={row.id}>
                  <td>{new Date(row.at).toLocaleString()}</td>
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
