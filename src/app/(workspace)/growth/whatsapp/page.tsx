"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";
import Select from "@/components/ui/Select";
import { EmptyState, SkeletonRows } from "@/components/ui/bits";
import { useWorkspace } from "@/components/shell/WorkspaceContext";
import { initials } from "@/lib/format";
import { fullName } from "@/lib/signal-growth/engine";
import { growth, useGrowth } from "@/lib/signal-growth/store";
import profile from "@/app/(workspace)/sales/leads/[id]/profile.module.css";
import signal from "../signal.module.css";
import { PageHero } from "@/components/ui/workspace";

export default function WhatsAppPage() {
  const state = useGrowth();
  const { toast } = useWorkspace();
  const [leadId, setLeadId] = useState("ld_noor");
  const [text, setText] = useState("");
  const [templateId, setTemplateId] = useState("wa_checkout");
  if (!state) return <div className="page"><SkeletonRows rows={4} /></div>;
  const thread = state.threads.find((item) => item.leadId === leadId);
  const lead = state.leads.find((item) => item.id === leadId);
  const opted = state.leads.filter((item) => item.whatsappOptIn);

  return (
    <div className="page">
      <PageHero kicker="Signal" title="WhatsApp" lede="Opted-in leads and existing users only. Cold outreach is not available on this channel." />

      <div className={signal.inbox}>
        <aside className="card">
          <div className="card-head"><h2>Inbox</h2></div>
          <div className="card-body">
            {state.threads.length === 0 && <EmptyState icon="message" title="No conversations" />}
            <div className={profile.stack}>
              {state.threads.map((item) => {
                const person = state.leads.find((row) => row.id === item.leadId);
                const active = item.leadId === leadId;
                return (
                  <button key={item.leadId} type="button" className="notice-banner" aria-pressed={active} onClick={() => setLeadId(item.leadId)} style={active ? { borderColor: "var(--brand-ring)", background: "var(--brand-soft)" } : undefined}>
                    <span className="avatar avatar-sm">{initials(person ? fullName(person) : item.leadId)}</span>
                    <span>
                      <b>{person ? fullName(person) : item.leadId}</b>
                      <div className="muted">{item.aiPaused ? "You have this chat" : "AI is answering"}</div>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </aside>
        <section className="card">
          {lead && thread ? (
            <>
              <div className="card-head">
                <div>
                  <h2>{fullName(lead)}</h2>
                  <p className="card-sub">{lead.whatsappOptIn ? "Opted in" : "No opt-in"}{lead.dnc.whatsapp ? " · STOP" : ""}</p>
                </div>
                <Button variant="secondary" onClick={() => growth.takeOver(lead.id, !thread.aiPaused)}>{thread.aiPaused ? "Hand back to AI" : "Take over"}</Button>
              </div>
              <div className="card-body">
                <div className={profile.thread}>
                  {thread.messages.map((message) => (
                    <div key={message.id} className={`${profile.bubble} ${message.from === "lead" ? profile.bubbleIn : profile.bubbleOut}`}>
                      <b>{message.from === "lead" ? fullName(lead) : message.from === "human" ? "You" : "AI"}</b>
                      <p>{message.text}</p>
                    </div>
                  ))}
                </div>
                <form className={signal.composer} onSubmit={(event) => { event.preventDefault(); if (!text.trim()) return; if (thread.aiPaused) growth.humanWhatsApp(lead.id, text); else growth.inboundWhatsApp(lead.id, text); setText(""); }}>
                  <label className={`field ${signal.composerField}`}>
                    <span className="sr-only">{thread.aiPaused ? "Reply as the team" : "Simulate a reply from the lead"}</span>
                    <input className="input" value={text} onChange={(event) => setText(event.target.value)} placeholder={thread.aiPaused ? "Reply as the team" : "Simulate a reply from the lead"} />
                  </label>
                  <Button type="submit">Send</Button>
                </form>
              </div>
            </>
          ) : <div className="card-body"><EmptyState icon="message" title="Pick a conversation" /></div>}
        </section>
      </div>

      <section className="card">
        <div className="card-head"><h2>Templates</h2></div>
        <div className="card-body">
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Template</th><th>Meta</th></tr></thead>
              <tbody>
                {state.whatsappTemplates.map((item) => (
                  <tr key={item.id}><td>{item.name}</td><td className="muted">{item.meta}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="page-actions" style={{ marginTop: 14 }}>
            <div className={signal.narrow}>
              <Select className="select" value={templateId} onChange={(event) => setTemplateId(event.target.value)} aria-label="Template">
                {state.whatsappTemplates.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </Select>
            </div>
            <Button onClick={() => toast(growth.sendWhatsApp(opted.map((item) => item.id), templateId, window.location.origin))}>Send to opted-in leads</Button>
          </div>
        </div>
      </section>
    </div>
  );
}
