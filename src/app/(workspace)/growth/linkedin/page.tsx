"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";
import { SkeletonRows } from "@/components/ui/bits";
import { useWorkspace } from "@/components/shell/WorkspaceContext";
import { PageHero } from "@/components/ui/workspace";
import { fullName } from "@/lib/signal-growth/engine";
import { growth, useGrowth } from "@/lib/signal-growth/store";

export default function LinkedInPage() {
  const state = useGrowth();
  const { toast } = useWorkspace();
  const [reply, setReply] = useState("Thanks, send it over.");
  if (!state) return <div className="page"><SkeletonRows rows={4} /></div>;
  const account = state.linkedinAccounts[0];

  return (
    <div className="page">
      <PageHero kicker="Signal" title="LinkedIn" lede="Assisted mode. The queue is drafted here, and a person clicks send. Daily limits stay low on purpose." />

      {account && (
        <section className="card">
          <div className="card-head">
            <div>
              <h2>{account.name}</h2>
              <p className="card-sub">{account.sentToday} of {account.dailyLimit} sends today. The limit is never exceeded.</p>
            </div>
          </div>
        </section>
      )}

      <section className="card">
        <div className="card-head"><h2>Queue</h2></div>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Lead</th><th>Step</th><th>Draft</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {state.linkedinQueue.map((item) => {
                const lead = state.leads.find((row) => row.id === item.leadId);
                return (
                  <tr key={item.id}>
                    <td>{lead ? fullName(lead) : item.leadId}</td>
                    <td>{item.step}</td>
                    <td>{item.text}</td>
                    <td><span className="chip">{item.status}</span></td>
                    <td>{item.status === "queued" && <Button size="small" onClick={() => toast(growth.sendLinkedIn(item.id))}>Send</Button>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card">
        <div className="card-head"><h2>Log a reply</h2></div>
        <form className="card-body" onSubmit={(event) => { event.preventDefault(); growth.reply("ld_layla", "linkedin", reply); toast("Reply logged. Layla leaves any active sequence."); }}>
          <label className="field"><span>What Layla said</span><input className="input" value={reply} onChange={(event) => setReply(event.target.value)} /></label>
          <div className="page-actions" style={{ marginTop: 12 }}>
            <Button type="submit" variant="secondary">Layla replied</Button>
          </div>
        </form>
      </section>
    </div>
  );
}
