"use client";

import { useState } from "react";
import Link from "next/link";
import Button from "@/components/ui/Button";
import Select from "@/components/ui/Select";
import { EmptyState, SkeletonRows } from "@/components/ui/bits";
import { useWorkspace } from "@/components/shell/WorkspaceContext";
import { avatarStyle, initials, plural } from "@/lib/format";
import { fullName, segmentLeads } from "@/lib/signal-growth/engine";
import { flushDue, growth, useGrowth } from "@/lib/signal-growth/store";

import styles from "./sequences.module.css";

function nextLabel(iso: string) {
  const diff = new Date(iso).getTime() - Date.now();
  if (diff <= 60_000) return "due";
  const hours = Math.round(diff / 3_600_000);
  if (hours < 24) return `next in ${hours}h`;
  return `next in ${Math.round(hours / 24)}d`;
}

function waitLabel(hours: number) {
  if (hours % 24 === 0) {
    const days = hours / 24;
    return `After ${plural(days, "day")}`;
  }
  return `After ${plural(hours, "hour")}`;
}

type StepDraft = { templateId: string; waitDays: number };

const EXAMPLE_STEPS: StepDraft[] = [
  { templateId: "tm_audit", waitDays: 0 },
  { templateId: "tm_follow", waitDays: 3 },
  { templateId: "tm_follow", waitDays: 4 },
];

export default function SequencesPage() {
  const state = useGrowth();
  const { toast } = useWorkspace();
  const [sequenceId, setSequenceId] = useState("sq_audit");
  const [segmentId, setSegmentId] = useState("sg_uae");
  const [creating, setCreating] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [draftSteps, setDraftSteps] = useState<StepDraft[]>(EXAMPLE_STEPS);
  const [stopOnReply, setStopOnReply] = useState(true);
  const [stopOnSignup, setStopOnSignup] = useState(true);
  const [stopOnPaid, setStopOnPaid] = useState(true);
  const [stopOnUnsubscribe, setStopOnUnsubscribe] = useState(true);
  const [draftOverlap, setDraftOverlap] = useState(false);
  const [enrolOnSave, setEnrolOnSave] = useState(false);
  if (!state) return <div className="page"><SkeletonRows rows={6} /></div>;

  const sequence = state.sequences.find((item) => item.id === sequenceId) ?? state.sequences[0];
  const audience = segmentLeads(state, segmentId);
  const blocked = audience.filter((lead) => lead.dnc.email).length;
  const enrolled = state.enrollments.filter((item) => item.sequenceId === sequence?.id);
  const active = enrolled.filter((item) => item.status === "active").length;
  const stops = sequence
    ? [
        sequence.stopOnReply ? "Reply" : "",
        sequence.stopOnSignup ? "Signed up" : "",
        sequence.stopOnPaid ? "Paid" : "",
        sequence.stopOnUnsubscribe ? "Unsubscribed" : "",
      ].filter(Boolean)
    : [];

  const openBuilder = () => {
    const first = state.templates[0]?.id ?? "";
    const follow = state.templates.find((item) => item.id === "tm_follow")?.id ?? first;
    const opener = state.templates.find((item) => item.id === "tm_audit")?.id ?? first;
    setCreating(true);
    setDraftName("");
    setDraftSteps([
      { templateId: opener, waitDays: 0 },
      { templateId: follow, waitDays: 3 },
      { templateId: follow, waitDays: 4 },
    ]);
    setStopOnReply(true);
    setStopOnSignup(true);
    setStopOnPaid(true);
    setStopOnUnsubscribe(true);
    setDraftOverlap(false);
    setEnrolOnSave(false);
  };

  const saveSequence = () => {
    if (!draftName.trim()) {
      toast("Name the sequence.");
      return;
    }
    const id = growth.createSequence({
      name: draftName,
      steps: draftSteps,
      stopOnReply,
      stopOnSignup,
      stopOnPaid,
      stopOnUnsubscribe,
      allowOverlap: draftOverlap,
    });
    if (!id) {
      toast("Each step needs a template.");
      return;
    }
    setSequenceId(id);
    setCreating(false);
    const enrolledMsg = enrolOnSave ? growth.enrol(id, audience.map((lead) => lead.id)) : "";
    toast(enrolledMsg ? `Sequence saved. ${enrolledMsg}` : "Sequence saved.");
  };

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <p className="kicker">Signal</p>
          <h1>Sequences</h1>
          <p className="subtitle">Follow-ups walk a lead through each step, then stop on a reply, a sign-up, a payment, or an unsubscribe. A lead stays in one sequence unless overlap is on.</p>
        </div>
        <Button variant="secondary" onClick={() => { flushDue(); toast("Due steps and triggers have been checked."); }}>Run due follow-ups</Button>
      </header>

      <div className={styles.studio}>
        <aside className={styles.library} aria-label="Sequences">
          <Button icon="plus" variant="secondary" fullWidth onClick={openBuilder}>New sequence</Button>
          <p className={styles.groupLabel}>Sequences</p>
          {state.sequences.map((item) => {
            const count = state.enrollments.filter((row) => row.sequenceId === item.id && row.status === "active").length;
            return (
              <button type="button" key={item.id} className={styles.seqCard} aria-current={!creating && sequence?.id === item.id ? "true" : undefined} onClick={() => { setCreating(false); setSequenceId(item.id); }}>
                <i className={styles.pip} />
                <span>
                  <b>{item.name}</b>
                  <small>{plural(item.steps.length, "step")} · {plural(count, "active lead", "active leads")}</small>
                </span>
              </button>
            );
          })}
          <p className={styles.groupLabel}>Stops when</p>
          <ul className={styles.stops}>
            {stops.map((stop) => <li key={stop}>{stop}</li>)}
          </ul>
          <label className={styles.overlap}>
            <input type="checkbox" checked={sequence?.allowOverlap ?? false} onChange={(event) => sequence && growth.setAllowOverlap(sequence.id, event.target.checked)} />
            <span>
              <b>Allow overlap</b>
              <small>A lead can sit in two sequences at once.</small>
            </span>
          </label>
        </aside>

        <section className={styles.board} aria-label={creating ? "New sequence" : "Sequence steps"}>
          {creating ? (
            <form className={styles.builder} onSubmit={(event) => { event.preventDefault(); saveSequence(); }}>
              <h2>New sequence</h2>
              <p className={styles.hint}>Each step is a template plus the days to wait before it. Day 0, then 3, then 4 more lands on day 7.</p>
              <label>
                Name
                <input className="input" value={draftName} onChange={(event) => setDraftName(event.target.value)} placeholder="Checkout follow-up" required />
              </label>
              <ol className={styles.stepList}>
                {draftSteps.map((step, index) => {
                  const day = draftSteps.slice(0, index + 1).reduce((sum, item) => sum + (Number(item.waitDays) || 0), 0);
                  return (
                    <li key={index} className={styles.stepRow}>
                      <label>
                        {index === 0 ? "Start" : `Day ${day}`}
                        <input className="input" type="number" min={0} aria-label={`Wait before step ${index + 1}`} value={step.waitDays} onChange={(event) => setDraftSteps((rows) => rows.map((row, rowIndex) => rowIndex === index ? { ...row, waitDays: Number(event.target.value) } : row))} />
                      </label>
                      <label>
                        Template
                        <Select className={styles.stepTemplate} value={step.templateId} aria-label={`Template for step ${index + 1}`} onChange={(event) => setDraftSteps((rows) => rows.map((row, rowIndex) => rowIndex === index ? { ...row, templateId: event.target.value } : row))}>
                          {state.templates.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                        </Select>
                      </label>
                      <Button type="button" size="small" variant="ghost" disabled={draftSteps.length === 1} onClick={() => setDraftSteps((rows) => rows.filter((_, rowIndex) => rowIndex !== index))}>Remove</Button>
                    </li>
                  );
                })}
              </ol>
              <Button type="button" variant="secondary" size="small" onClick={() => setDraftSteps((rows) => [...rows, { templateId: state.templates[0]?.id ?? "", waitDays: 3 }])}>Add step</Button>
              <div className={styles.stopGrid}>
                <label><input type="checkbox" checked={stopOnReply} onChange={(event) => setStopOnReply(event.target.checked)} /> Stop on reply</label>
                <label><input type="checkbox" checked={stopOnSignup} onChange={(event) => setStopOnSignup(event.target.checked)} /> Stop on sign-up</label>
                <label><input type="checkbox" checked={stopOnPaid} onChange={(event) => setStopOnPaid(event.target.checked)} /> Stop on paid</label>
                <label><input type="checkbox" checked={stopOnUnsubscribe} onChange={(event) => setStopOnUnsubscribe(event.target.checked)} /> Stop on unsubscribe</label>
                <label><input type="checkbox" checked={draftOverlap} onChange={(event) => setDraftOverlap(event.target.checked)} /> Allow overlap</label>
                <label><input type="checkbox" checked={enrolOnSave} onChange={(event) => setEnrolOnSave(event.target.checked)} /> Enrol this segment now</label>
              </div>
              <div className="page-actions">
                <Button type="button" variant="ghost" onClick={() => setCreating(false)}>Cancel</Button>
                <Button type="submit">Save sequence</Button>
              </div>
            </form>
          ) : (
          <>
          <h2>{sequence?.name}</h2>
          <p className={styles.hint}>{plural(active, "lead is", "leads are")} still moving through this sequence.</p>
          <ol className={styles.track}>
            {sequence?.steps.map((step, index) => {
              const day = sequence.steps.slice(0, index + 1).reduce((sum, item) => sum + item.waitDays, 0);
              const template = state.templates.find((item) => item.id === step.templateId);
              const here = enrolled.filter((item) => item.status === "active" && item.stepIndex === index).length;
              return (
                <li key={`${step.templateId}-${index}`} className={styles.step}>
                  <span className={styles.when}>{index === 0 ? "Start" : `Day ${day}`}</span>
                  <span className={styles.rail}><i className={styles.dot} /></span>
                  <article className={styles.stepCard}>
                    <b>{template?.name ?? "Template"}</b>
                    <p>{template?.subject || "No subject"}{here ? ` · ${plural(here, "lead is", "leads are")} here` : ""}</p>
                  </article>
                </li>
              );
            })}
          </ol>
          </>
          )}
        </section>

        <aside className={styles.side}>
          <h2>Enrol</h2>
          <div className={styles.enrol}>
            <Select className={styles.segment} value={segmentId} aria-label="Segment" onChange={(event) => setSegmentId(event.target.value)}>
              {state.segments.map((segment) => <option key={segment.id} value={segment.id}>{segment.name}</option>)}
            </Select>
            <p className={styles.hint}>{creating ? "Save the sequence, then enrol this segment." : `${plural(audience.length - blocked, "person", "people")} can join · ${blocked} do-not-contact`}</p>
            <Button fullWidth disabled={creating} onClick={() => sequence && toast(growth.enrol(sequence.id, audience.map((lead) => lead.id)))}>Enrol segment</Button>
          </div>
          <p className={styles.groupLabel}>In this sequence</p>
          {enrolled.length === 0 ? (
            <EmptyState icon="users" title="No one enrolled">Pick a segment and enrol the people who can be emailed.</EmptyState>
          ) : (
            <ul className={styles.people}>
              {enrolled.map((item) => {
                const lead = state.leads.find((row) => row.id === item.leadId);
                const name = lead ? fullName(lead) : item.leadId;
                return (
                  <li key={item.id} className={styles.personRow}>
                    <Link href={lead ? `/growth/leads/${lead.id}` : "/growth/leads"} className={styles.person}>
                      <span className="avatar avatar-sm" style={avatarStyle(name)}>{initials(name)}</span>
                      <span>
                        <b>{name}</b>
                        <small>{lead?.company ?? "—"} · step {(item.stepIndex ?? 0) + 1}{item.status === "active" ? ` · ${nextLabel(item.nextAt)}` : ""}</small>
                      </span>
                    </Link>
                    <span className={`chip ${item.status === "active" ? "chip-qualified" : "chip-lost"}`}>{item.stopReason || item.status}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </aside>
      </div>

      <section aria-label="Signal triggers">
        <p className={styles.groupLabel}>Signal triggers</p>
        <div className={styles.triggers}>
          {state.triggers.map((trigger) => {
            const template = state.templates.find((item) => item.id === trigger.templateId);
            return (
              <article key={trigger.id} className={styles.trigger}>
                <b>{trigger.name}</b>
                <p>{waitLabel(trigger.waitHours)}, {template?.name ?? "a template"} sends once per lead. {trigger.channel === "whatsapp" ? "WhatsApp still needs opt-in." : "Email skips do-not-contact."}</p>
                <div className={styles.triggerFoot}>
                  <span className="tag">{trigger.channel}</span>
                  <span className={styles.hint}>{trigger.fired.length ? `Fired ${trigger.fired.length}` : "Not fired yet"}</span>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
