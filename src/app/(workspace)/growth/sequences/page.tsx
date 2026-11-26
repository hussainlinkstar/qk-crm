"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";
import Select from "@/components/ui/Select";
import { SkeletonRows } from "@/components/ui/bits";
import { useWorkspace } from "@/components/shell/WorkspaceContext";
import { fullName, segmentLeads } from "@/lib/signal-growth/engine";
import { flushDue, growth, useGrowth } from "@/lib/signal-growth/store";
import sales from "@/app/(workspace)/sales/sales.module.css";
import signal from "../signal.module.css";
import { PageHero } from "@/components/ui/workspace";

export default function SequencesPage() {
  const state = useGrowth();
  const { toast } = useWorkspace();
  const [sequenceId, setSequenceId] = useState("sq_audit");
  const [segmentId, setSegmentId] = useState("sg_uae");
  if (!state) return <div className="page"><SkeletonRows rows={4} /></div>;
  const sequence = state.sequences.find((item) => item.id === sequenceId) ?? state.sequences[0];

  return (
    <div className="page">
      <PageHero
        kicker="Signal"
        title="Sequences"
        lede="Follow-ups stop when someone replies, signs up, pays, or unsubscribes. A lead is in one sequence unless you allow overlap."
        action={<Button variant="secondary" onClick={() => { flushDue(); toast("Due steps and triggers have been checked."); }}>Run due follow-ups</Button>}
      />

      <div className={sales.overviewGrid}>
        <section className="card">
          <div className="card-head">
            <h2>{sequence?.name}</h2>
            {state.sequences.length > 1 && (
              <Select className="select" value={sequence?.id ?? ""} onChange={(event) => setSequenceId(event.target.value)} aria-label="Sequence">
                {state.sequences.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </Select>
            )}
          </div>
          <div className="card-body">
            <ol className="form-grid">
              {sequence?.steps.map((step, index) => {
                const template = state.templates.find((item) => item.id === step.templateId);
                return <li key={`${step.templateId}-${index}`}>Day {sequence.steps.slice(0, index).reduce((sum, item) => sum + item.waitDays, 0)} · {template?.name}</li>;
              })}
            </ol>
            <label className="notice-banner" style={{ marginTop: 14 }}>
              <input type="checkbox" checked={sequence?.allowOverlap ?? false} onChange={(event) => sequence && growth.setAllowOverlap(sequence.id, event.target.checked)} />
              <span>Allow two sequences at once</span>
            </label>
            <div className="page-actions" style={{ marginTop: 14 }}>
              <div className={signal.narrow}>
                <Select className="select" value={segmentId} onChange={(event) => setSegmentId(event.target.value)} aria-label="Segment">
                  {state.segments.map((segment) => <option key={segment.id} value={segment.id}>{segment.name}</option>)}
                </Select>
              </div>
              <Button onClick={() => sequence && toast(growth.enrol(sequence.id, segmentLeads(state, segmentId).map((lead) => lead.id)))}>Enrol segment</Button>
            </div>
            <div className="table-wrap" style={{ marginTop: 16 }}>
              <table className="table">
                <thead><tr><th>Lead</th><th>Status</th><th>Stop</th></tr></thead>
                <tbody>
                  {state.enrollments.filter((item) => item.sequenceId === sequence?.id).map((item) => {
                    const lead = state.leads.find((row) => row.id === item.leadId);
                    return (
                      <tr key={item.id}>
                        <td>{lead ? fullName(lead) : item.leadId}</td>
                        <td><span className="chip">{item.status}</span></td>
                        <td className="muted">{item.stopReason || "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>
        <section className="card">
          <div className="card-head"><h2>Signal triggers</h2></div>
          <div className="card-body">
            <p className="card-sub">Each trigger fires once per lead. WhatsApp triggers still require opt-in.</p>
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Trigger</th><th>Channel</th><th>Fired</th></tr></thead>
                <tbody>
                  {state.triggers.map((trigger) => (
                    <tr key={trigger.id}>
                      <td>{trigger.name}</td>
                      <td><span className="tag">{trigger.channel}</span></td>
                      <td className="tabular">{trigger.fired.length}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
