"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import Button from "@/components/ui/Button";
import { EmptyState, SkeletonRows } from "@/components/ui/bits";
import { useWorkspace } from "@/components/shell/WorkspaceContext";
import { avatarStyle, initials, timeAgo } from "@/lib/format";
import { fullName } from "@/lib/signal-growth/engine";
import { growth, useGrowth } from "@/lib/signal-growth/store";
import styles from "./whatsapp.module.css";

const META_CHIP = { Approved: "chip-won", Submitted: "chip-pending", Draft: "chip" } as const;

export default function WhatsAppPage() {
  const state = useGrowth();
  const { toast } = useWorkspace();
  const [leadId, setLeadId] = useState("ld_noor");
  const [text, setText] = useState("");
  const [templateId, setTemplateId] = useState("wa_checkout");
  if (!state) return <div className="page"><SkeletonRows rows={6} /></div>;

  const thread = state.threads.find((item) => item.leadId === leadId);
  const lead = state.leads.find((item) => item.id === leadId);
  const template = state.whatsappTemplates.find((item) => item.id === templateId);
  const opted = state.leads.filter((item) => item.whatsappOptIn);
  const name = lead ? fullName(lead) : "";

  const sendThread = (event: FormEvent) => {
    event.preventDefault();
    if (!text.trim() || !lead || !thread) return;
    if (thread.aiPaused) growth.humanWhatsApp(lead.id, text);
    else growth.inboundWhatsApp(lead.id, text);
    setText("");
  };

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <p className="kicker">Signal</p>
          <h1>WhatsApp</h1>
          <p className="subtitle">Only opted-in leads and existing users. Cold outreach is not on this channel. An approved template is the only one that can go out.</p>
        </div>
      </header>

      <div className={styles.studio}>
        <aside className={styles.library} aria-label="Conversations">
          <p className={styles.groupLabel}>Inbox</p>
          {state.threads.length === 0 ? <EmptyState icon="message" title="No conversations" /> : state.threads.map((item) => {
            const person = state.leads.find((row) => row.id === item.leadId);
            const personName = person ? fullName(person) : item.leadId;
            const last = item.messages[item.messages.length - 1];
            return (
              <button key={item.leadId} type="button" className={styles.chatCard} aria-pressed={item.leadId === leadId} onClick={() => setLeadId(item.leadId)}>
                <span className="avatar avatar-sm" style={avatarStyle(personName)}>{initials(personName)}</span>
                <span>
                  <b>{personName}</b>
                  <small>{last?.text || (item.aiPaused ? "You have this chat" : "AI is answering")}</small>
                </span>
              </button>
            );
          })}
        </aside>

        <section className={styles.chat} aria-label="Conversation">
          {lead && thread ? (
            <>
              <div className={styles.chatHead}>
                <Link href={`/growth/leads/${lead.id}`} className={styles.who}>
                  <span className="avatar" style={avatarStyle(name)}>{initials(name)}</span>
                  <span>
                    <b>{name}</b>
                    <small>{lead.company} · {lead.whatsappOptIn ? "Opted in" : "No opt-in"}{lead.dnc.whatsapp ? " · STOP" : ""} · {thread.aiPaused ? "You have this chat" : "AI is answering"}</small>
                  </span>
                </Link>
                <Button variant="secondary" size="small" onClick={() => growth.takeOver(lead.id, !thread.aiPaused)}>{thread.aiPaused ? "Hand back to AI" : "Take over"}</Button>
              </div>
              <div className={styles.thread}>
                {thread.messages.map((message) => {
                  const mine = message.from !== "lead";
                  return (
                    <article key={message.id} className={`${styles.bubble} ${mine ? styles.bubbleOut : styles.bubbleIn}`}>
                      <b>{message.from === "lead" ? name.split(" ")[0] : message.from === "human" ? "You" : "AI"}</b>
                      <p>{message.text}</p>
                      <small>{timeAgo(message.at)}</small>
                    </article>
                  );
                })}
              </div>
              <form className={styles.composer} onSubmit={sendThread}>
                <input className="input" value={text} onChange={(event) => setText(event.target.value)} aria-label={thread.aiPaused ? "Reply as the team" : `What ${name.split(" ")[0]} replies`} placeholder={thread.aiPaused ? "Reply as the team" : `${name.split(" ")[0]} replies…`} />
                <Button type="submit" disabled={!text.trim()}>{thread.aiPaused ? "Send" : "Log reply"}</Button>
              </form>
            </>
          ) : <div className="card-body"><EmptyState icon="message" title="Pick a conversation" /></div>}
        </section>

        <aside className={styles.templates} aria-label="Templates">
          <p className={styles.groupLabel}>Templates</p>
          {state.whatsappTemplates.map((item) => (
            <button key={item.id} type="button" className={styles.templateCard} aria-pressed={item.id === templateId} onClick={() => setTemplateId(item.id)}>
              <span className={styles.templateTop}>
                <b>{item.name}</b>
                <span className={`chip ${META_CHIP[item.meta]}`}>{item.meta}</span>
              </span>
              <p>{item.body}</p>
            </button>
          ))}
          <p className={styles.hint}>{opted.length} opted in. {template?.meta === "Approved" ? "This template can be sent." : "Only an approved template can be sent."}</p>
          <Button fullWidth disabled={template?.meta !== "Approved"} onClick={() => toast(growth.sendWhatsApp(opted.map((item) => item.id), templateId, window.location.origin))}>Send to opted-in leads</Button>
        </aside>
      </div>
    </div>
  );
}
