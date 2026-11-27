"use client";

import { useState } from "react";
import Link from "next/link";
import Button from "@/components/ui/Button";
import Icon from "@/components/ui/Icon";
import Select from "@/components/ui/Select";
import { SkeletonRows } from "@/components/ui/bits";
import { OutcomeGrid, PageHero } from "@/components/ui/workspace";
import { useWorkspace } from "@/components/shell/WorkspaceContext";
import { avatarStyle, initials, plural } from "@/lib/format";
import { fullName, segmentLeads } from "@/lib/signal-growth/engine";
import { flushDue, growth, useGrowth } from "@/lib/signal-growth/store";
import type { Sequence } from "@/lib/signal-growth/types";

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

function sendDays(steps: StepDraft[]) {
  let day = 0;
  return steps.map((step) => {
    day += Number(step.waitDays) || 0;
    return day;
  });
}

function withSendDay(steps: StepDraft[], index: number, raw: number) {
  const days = sendDays(steps);
  const previous = index === 0 ? 0 : days[index - 1];
  const next = Math.max(previous, Number.isFinite(raw) ? Math.floor(raw) : previous);
  const updated = days.slice();
  updated[index] = next;
  for (let cursor = index + 1; cursor < updated.length; cursor += 1) {
    if (updated[cursor] < updated[cursor - 1]) updated[cursor] = updated[cursor - 1];
  }
  return steps.map((step, stepIndex) => ({
    ...step,
    waitDays: stepIndex === 0 ? updated[0] : updated[stepIndex] - updated[stepIndex - 1],
  }));
}

function afterCopy(index: number, day: number, previous: number) {
  const wait = day - previous;
  if (index === 0 && wait === 0) return "Right when they join";
  if (index === 0) return `${plural(wait, "day", "days")} after they join`;
  if (wait === 0) return `Same day as email ${index}`;
  return `${plural(wait, "day", "days")} after email ${index}`;
}

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
  const [editingId, setEditingId] = useState<string | null>(null);
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
  const segment = state.segments.find((item) => item.id === segmentId);
  const blocked = audience.filter((lead) => lead.dnc.email).length;
  const enrolled = state.enrollments.filter((item) => item.sequenceId === sequence?.id);

  const openBuilder = () => {
    const first = state.templates[0]?.id ?? "";
    const follow = state.templates.find((item) => item.id === "tm_follow")?.id ?? first;
    const opener = state.templates.find((item) => item.id === "tm_audit")?.id ?? first;
    setCreating(true);
    setEditingId(null);
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

  const openEditor = (item: Sequence) => {
    setCreating(true);
    setEditingId(item.id);
    setSequenceId(item.id);
    setDraftName(item.name);
    setDraftSteps(item.steps.map((step) => ({ templateId: step.templateId, waitDays: step.waitDays })));
    setStopOnReply(item.stopOnReply);
    setStopOnSignup(item.stopOnSignup);
    setStopOnPaid(item.stopOnPaid);
    setStopOnUnsubscribe(item.stopOnUnsubscribe);
    setDraftOverlap(item.allowOverlap);
    setEnrolOnSave(false);
  };

  const saveSequence = () => {
    if (!draftName.trim()) {
      toast("Name the sequence.");
      return;
    }
    const payload = {
      name: draftName,
      steps: draftSteps,
      stopOnReply,
      stopOnSignup,
      stopOnPaid,
      stopOnUnsubscribe,
      allowOverlap: draftOverlap,
    };
    if (editingId) {
      if (!growth.updateSequence(editingId, payload)) {
        toast("Each step needs a template.");
        return;
      }
      setSequenceId(editingId);
      setCreating(false);
      setEditingId(null);
      toast("Sequence updated.");
      return;
    }
    const id = growth.createSequence(payload);
    if (!id) {
      toast("Each step needs a template.");
      return;
    }
    setSequenceId(id);
    setEditingId(null);
    setCreating(false);
    const enrolledMsg = enrolOnSave ? growth.enrol(id, audience.map((lead) => lead.id)) : "";
    toast(enrolledMsg ? `Sequence saved. ${enrolledMsg}` : "Sequence saved.");
  };

  const activeLeads = state.enrollments.filter((item) => item.status === "active").length;
  const flowSteps = creating ? draftSteps : sequence?.steps ?? [];

  return (
    <div className="page">
        <PageHero
          kicker="Signal"
          title="Sequences"
          lede="Each email sends on its day, then the sequence stops on a reply, a sign-up, a payment, or an unsubscribe."
          action={
            <>
              <Button variant="secondary" onClick={() => { flushDue(); toast("Due steps and triggers have been checked."); }}>Run due</Button>
              <Button icon="plus" onClick={openBuilder}>New sequence</Button>
            </>
          }
        />

        <OutcomeGrid
          label="Sequence totals"
          tiles={[
            { key: "sequences", label: "Sequences", numeric: state.sequences.length, sub: "Follow-up flows", icon: "layers", iconTone: "qiko", tone: "qiko" },
            { key: "active", label: "Active leads", numeric: activeLeads, sub: "Still moving", icon: "users", iconTone: "qiko", tone: "qiko" },
            { key: "emails", label: "Emails in this flow", numeric: flowSteps.length, sub: creating ? "This draft" : (sequence?.name ?? "Sequence"), icon: "send", iconTone: "qiko", tone: "qiko" },
            { key: "join", label: "Can join", numeric: Math.max(audience.length - blocked, 0), sub: segment?.name ?? "Segment", icon: "userCheck", iconTone: "qiko", tone: "qiko" },
          ]}
        />

        {creating ? (
          <form className={styles.editor} onSubmit={(event) => { event.preventDefault(); saveSequence(); }}>
            <div className={styles.editorHead}>
              <label className={styles.nameField}>
                Name
                <input className="input" value={draftName} onChange={(event) => setDraftName(event.target.value)} placeholder="Checkout follow-up" required />
              </label>
            </div>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Email</th>
                    <th>Sends on day</th>
                    <th>After</th>
                    <th>Template</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {draftSteps.map((step, index) => {
                    const days = sendDays(draftSteps);
                    const day = days[index];
                    const previous = index === 0 ? 0 : days[index - 1];
                    return (
                      <tr key={index}>
                        <td>Email {index + 1}</td>
                        <td>
                          <input className={`input ${styles.dayInput}`} type="number" min={previous} aria-label={`Day email ${index + 1} sends`} value={day} onChange={(event) => setDraftSteps((rows) => withSendDay(rows, index, Number(event.target.value)))} />
                        </td>
                        <td className="muted">{afterCopy(index, day, previous)}</td>
                        <td>
                          <Select className={styles.stepTemplate} value={step.templateId} aria-label={`Template for step ${index + 1}`} onChange={(event) => setDraftSteps((rows) => rows.map((row, rowIndex) => rowIndex === index ? { ...row, templateId: event.target.value } : row))}>
                            {state.templates.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                          </Select>
                        </td>
                        <td>
                          <button type="button" className={styles.quietBtn} aria-label={`Remove email ${index + 1}`} disabled={draftSteps.length === 1} onClick={() => setDraftSteps((rows) => rows.filter((_, rowIndex) => rowIndex !== index))}>Remove</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className={styles.editorFoot}>
              <button type="button" className={styles.quietBtn} onClick={() => setDraftSteps((rows) => [...rows, { templateId: state.templates[0]?.id ?? "", waitDays: 3 }])}>Add email</button>
              <div className={styles.checks}>
                <span>Stops when</span>
                <label><input type="checkbox" checked={stopOnReply} onChange={(event) => setStopOnReply(event.target.checked)} /> Reply</label>
                <label><input type="checkbox" checked={stopOnSignup} onChange={(event) => setStopOnSignup(event.target.checked)} /> Sign-up</label>
                <label><input type="checkbox" checked={stopOnPaid} onChange={(event) => setStopOnPaid(event.target.checked)} /> Paid</label>
                <label><input type="checkbox" checked={stopOnUnsubscribe} onChange={(event) => setStopOnUnsubscribe(event.target.checked)} /> Unsubscribe</label>
                <span className={styles.checksSplit} aria-hidden="true" />
                <label><input type="checkbox" checked={draftOverlap} onChange={(event) => setDraftOverlap(event.target.checked)} /> Overlap</label>
                <label><input type="checkbox" checked={enrolOnSave} onChange={(event) => setEnrolOnSave(event.target.checked)} /> Enrol now</label>
              </div>
              <span className={styles.spacer} />
              <Button type="button" variant="ghost" onClick={() => { setCreating(false); setEditingId(null); }}>Cancel</Button>
              <Button type="submit">{editingId ? "Save changes" : "Save sequence"}</Button>
            </div>
          </form>
        ) : (
          <section className="card">
            <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Sequence</th>
                  <th>Emails</th>
                  <th>Active</th>
                  <th>Stops when</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {state.sequences.map((item) => {
                  const count = state.enrollments.filter((row) => row.sequenceId === item.id && row.status === "active").length;
                  const stopNames = [item.stopOnReply ? "Reply" : "", item.stopOnSignup ? "Sign-up" : "", item.stopOnPaid ? "Paid" : "", item.stopOnUnsubscribe ? "Unsubscribe" : ""].filter(Boolean);
                  return (
                    <tr key={item.id} className={sequence?.id === item.id ? styles.picked : undefined}>
                      <td>
                        <button type="button" className={styles.templateName} onClick={() => { setCreating(false); setSequenceId(item.id); }}>
                          <b>{item.name}</b>
                          <small>{item.steps.length} emails</small>
                        </button>
                      </td>
                      <td className="tabular">{item.steps.length}</td>
                      <td className="tabular">{count}</td>
                      <td className="muted">{stopNames.join(" · ")}</td>
                      <td><span className={item.paused ? "chip chip-pending" : count ? "chip chip-won" : "chip"}>{item.paused ? "Paused" : count ? "Active" : "Idle"}</span></td>
                      <td>
                        <div className={styles.rowActions}>
                          <button type="button" className={styles.iconBtn} aria-label={`Edit ${item.name}`} onClick={() => openEditor(item)}><Icon name="edit" size={16} /></button>
                          {item.paused ? (
                            <button type="button" className={styles.quietBtn} onClick={() => { growth.setSequencePaused(item.id, false); toast(`${item.name} resumed.`); }}>Resume</button>
                          ) : (
                            <button type="button" className={styles.quietBtn} onClick={() => { growth.setSequencePaused(item.id, true); toast(`${item.name} paused.`); }}>Pause</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
          </section>
        )}

        <div className={styles.bottom}>
          <div className={styles.enrol}>
            <Select className={styles.segment} value={segmentId} aria-label="Segment" onChange={(event) => setSegmentId(event.target.value)}>
              {state.segments.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </Select>
            <p>{creating ? "Save, then enrol this segment." : `${plural(audience.length - blocked, "person", "people")} can join · ${blocked} skipped`}</p>
            <Button size="small" disabled={creating} onClick={() => sequence && toast(growth.enrol(sequence.id, audience.map((lead) => lead.id)))}>Enrol</Button>
          </div>
          <div className={styles.peopleBand}>
            {enrolled.length === 0 ? <span className={styles.muted}>No one enrolled</span> : enrolled.map((item) => {
              const lead = state.leads.find((row) => row.id === item.leadId);
              const name = lead ? fullName(lead) : item.leadId;
              return (
                <Link key={item.id} href={lead ? `/growth/leads/${lead.id}` : "/growth/leads"} className={styles.personChip}>
                  <span className="avatar avatar-sm" style={avatarStyle(name)}>{initials(name)}</span>
                  <span>
                    <b>{name}</b>
                    <small>step {(item.stepIndex ?? 0) + 1}{item.status === "active" ? ` · ${nextLabel(item.nextAt)}` : ` · ${item.stopReason || item.status}`}</small>
                  </span>
                </Link>
              );
            })}
          </div>
          {!creating && sequence ? (
            <label className={styles.overlapInline}>
              <input type="checkbox" checked={sequence.allowOverlap} onChange={(event) => growth.setAllowOverlap(sequence.id, event.target.checked)} />
              Overlap
            </label>
          ) : null}
        </div>

        <ul className={styles.triggerRow} aria-label="Signal triggers">
          {state.triggers.map((trigger) => {
            const template = state.templates.find((item) => item.id === trigger.templateId);
            const detail = `${waitLabel(trigger.waitHours)}, ${template?.name ?? "a template"} sends once per lead. ${trigger.channel === "whatsapp" ? "WhatsApp still needs opt-in." : "Email skips do-not-contact."}`;
            return (
              <li key={trigger.id} title={detail}>
                <b>{trigger.name}</b>
                <small>{waitLabel(trigger.waitHours)} · {trigger.channel} · {trigger.fired.length ? `Fired ${trigger.fired.length}` : "Not fired yet"}</small>
              </li>
            );
          })}
        </ul>
    </div>
  );
}
