"use client";

import Link from "next/link";
import { useState } from "react";
import BarList from "@/components/ui/BarList";
import Button from "@/components/ui/Button";
import Select from "@/components/ui/Select";
import { SkeletonRows } from "@/components/ui/bits";
import InsightSignals, { type InsightSignalItem } from "@/components/sales/InsightSignals";
import { useWorkspace } from "@/components/shell/WorkspaceContext";
import { avatarStyle, initials } from "@/lib/format";
import { fullName, segmentLeads } from "@/lib/signal-growth/engine";
import { growth, useGrowth } from "@/lib/signal-growth/store";
import leadStyles from "@/app/(workspace)/sales/leads/leads.module.css";
import salesStyles from "@/app/(workspace)/sales/sales.module.css";

export default function AuditsPage() {
  const state = useGrowth();
  const { toast } = useWorkspace();
  const [segmentId, setSegmentId] = useState("sg_uae");
  const [cap, setCap] = useState<number | null>(null);
  if (!state) return <div className="page"><SkeletonRows rows={4} /></div>;
  const currentCap = cap ?? state.caps.auditCap;
  const remaining = Math.max(state.caps.auditCap - state.caps.auditsUsed, 0);
  const rows = state.leads.filter((lead) => lead.audit);
  const scoreRows = rows.map((lead) => ({
    key: lead.id,
    label: fullName(lead),
    value: lead.audit?.aio ?? 0,
    display: `${lead.audit?.aio ?? "—"} / ${lead.audit?.seo ?? "—"}`,
    caption: lead.audit?.status,
    href: `/growth/leads/${lead.id}`,
    tone: (lead.audit?.unreadable ? "warning" : "brand") as "warning" | "brand",
  }));
  const items: InsightSignalItem[] = rows.map((lead) => {
    const preview = Boolean(lead.audit && !lead.audit.unreadable);
    return {
      id: lead.id,
      kind: lead.audit?.status ?? "Audit",
      title: fullName(lead),
      detail: lead.audit?.topProblem ?? "",
      evidence: `${lead.audit?.aio ?? "—"} / ${lead.audit?.seo ?? "—"}`,
      actionLabel: preview ? "Preview" : "Send",
      href: preview ? `/r/${lead.audit?.token}` : undefined,
      onClick: preview ? undefined : () => toast(growth.sendAudit(lead.id)),
    };
  });

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <p className="kicker">Signal</p>
          <h1>Prospect audits</h1>
          <p className="subtitle">Fast-tier audits, capped per day. Unreadable sites are held and never sent.</p>
        </div>
        <Button onClick={() => toast(growth.runAudits(segmentLeads(state, segmentId).filter((lead) => !lead.audit).map((lead) => lead.id)))}>Run Fast audit</Button>
      </header>

      <InsightSignals
        title={`${state.caps.auditsUsed} of ${state.caps.auditCap} credits used today`}
        summary={`${remaining} left. A segment larger than the cap stops at the cap.`}
        items={items}
      />

      <div className={salesStyles.overviewGrid}>
        <section className="card">
          <div className="card-head">
            <div>
              <h2>Reports</h2>
            </div>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            <div className="table-wrap">
              <table className={`table ${leadStyles.table}`}>
                <thead>
                  <tr>
                    <th>Lead</th>
                    <th>Status</th>
                    <th>Scores</th>
                    <th>Top problem</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((lead) => {
                    const name = fullName(lead);
                    return (
                      <tr key={lead.id}>
                        <td>
                          <span className={leadStyles.person}>
                            <span className="avatar avatar-sm" style={avatarStyle(name)}>{initials(name)}</span>
                            <span>
                              <Link href={`/growth/leads/${lead.id}`} className="text-link"><b>{name}</b></Link>
                              {lead.manualCheck ? <small>Manual check</small> : null}
                            </span>
                          </span>
                        </td>
                        <td><span className="chip">{lead.audit?.status}</span></td>
                        <td className="tabular">{lead.audit?.aio ?? "—"} / {lead.audit?.seo ?? "—"}</td>
                        <td>{lead.audit?.topProblem}</td>
                        <td>
                          <div className="page-actions">
                            {lead.audit && !lead.audit.unreadable ? <Link href={`/r/${lead.audit.token}`} className="text-link">Preview</Link> : null}
                            <Button size="small" variant="secondary" onClick={() => toast(growth.sendAudit(lead.id))}>Send</Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="card">
          <div className="card-head">
            <div>
              <h2>Daily cap</h2>
            </div>
          </div>
          <div className="card-body">
            <div className="form-grid">
              <label className="field">
                <span>Daily cap</span>
                <input className="input" type="number" min={0} value={currentCap} onChange={(event) => setCap(Number(event.target.value))} />
              </label>
              <label className="field">
                <span>Segment</span>
                <Select className="select" value={segmentId} onChange={(event) => setSegmentId(event.target.value)}>
                  {state.segments.map((segment) => <option key={segment.id} value={segment.id}>{segment.name}</option>)}
                </Select>
              </label>
              <Button variant="secondary" onClick={() => { growth.setAuditCap(currentCap); toast("Daily cap saved"); }}>Save cap</Button>
            </div>
            <div style={{ marginTop: 18 }}>
              <BarList label="Scores" max={100} rows={scoreRows} />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
