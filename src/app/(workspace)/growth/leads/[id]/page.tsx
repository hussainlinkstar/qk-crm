"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Suspense, useState } from "react";
import LeadProfileFrame from "@/components/leads/LeadProfileFrame";
import {
  EngagementCard,
  FilterBar,
  LeadTimeline,
  MessageThread,
  NoteArticle,
  OriginCard,
  PanelCard,
  RecordStack,
  profileStyles,
  type RecordEvent,
  type RecordMessage,
} from "@/components/leads/LeadRecordSections";
import RelationshipIntelligence from "@/components/sales/RelationshipIntelligence";
import type { SalesRelationshipIntel } from "@/lib/sales-relationship";
import { TaskCardView } from "@/components/tasks/TaskCard";
import Button from "@/components/ui/Button";
import Icon from "@/components/ui/Icon";
import IconTile, { type IconTone } from "@/components/ui/IconTile";
import type { IconName } from "@/components/ui/Icon";
import Select from "@/components/ui/Select";
import { EmptyState, SkeletonRows, useNow } from "@/components/ui/bits";
import { useWorkspace } from "@/components/shell/WorkspaceContext";
import { dueLabel, formatDate, formatDateTime, plural, timeAgo, toDateKey, todayKey } from "@/lib/format";
import { fullName, planOf } from "@/lib/signal-growth/engine";
import { growth, useGrowth } from "@/lib/signal-growth/store";
import { CHANNELS, STAGES, type Channel, type SignalEvent, type Stage, type TimelineEvent } from "@/lib/signal-growth/types";
import signal from "../../signal.module.css";

const CHANNEL_MARK: Record<Channel, { label: string; icon: IconName; tone: IconTone }> = {
  email: { label: "Email", icon: "mail", tone: "brand" },
  whatsapp: { label: "WhatsApp", icon: "message", tone: "success" },
  linkedin: { label: "LinkedIn", icon: "link", tone: "info" },
};

const CHANNEL_LABEL: Record<TimelineEvent["channel"], string> = {
  email: "Email",
  whatsapp: "WhatsApp",
  linkedin: "LinkedIn",
  signal: "Signal",
  note: "Note",
  audit: "Qiko Signal",
};

const EVENTS: Array<{ id: SignalEvent; label: string }> = [
  { id: "account_created", label: "Account created" },
  { id: "first_audit", label: "First audit" },
  { id: "checkout_started", label: "Checkout started" },
  { id: "subscription_paid", label: "Subscription paid" },
  { id: "subscription_cancelled", label: "Subscription cancelled" },
];

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

const ACTIVITY_FILTERS = [
  { key: "all", label: "All" },
  { key: "product", label: "Product" },
  { key: "scans", label: "Scans" },
  { key: "enquiries", label: "Enquiries" },
  { key: "crm", label: "CRM" },
];

type Tab = "overview" | "activity" | "conversations" | "scans" | "tasks" | "notes";

function bucket(event: TimelineEvent) {
  if (event.channel === "audit" || event.kind === "audit") return "scans";
  if (event.channel === "signal" || event.kind === "signal") return "product";
  if (event.kind === "replied") return "enquiries";
  if (event.kind === "note" || event.kind === "system") return "crm";
  return "outreach";
}

function toRecord(event: TimelineEvent): RecordEvent {
  const mark = CHANNEL_MARK[event.channel as Channel];
  const icon: IconName =
    event.channel === "audit" || event.kind === "audit" ? "scan"
      : event.channel === "signal" ? "zap"
        : event.kind === "replied" ? "message"
          : event.kind === "note" ? "note"
            : mark?.icon ?? "clock";
  const kind =
    event.channel === "audit" || event.kind === "audit" ? "scan"
      : event.channel === "signal" ? "signup"
        : event.kind === "replied" ? "enquiry"
          : event.kind === "note" ? "lead_created"
            : "status_change";
  return {
    id: event.id,
    kind,
    icon,
    title: event.summary,
    source: CHANNEL_LABEL[event.channel],
    occurredAt: event.at,
  };
}

function groupByDay(items: RecordEvent[]) {
  return items.reduce<Array<{ day: string; items: RecordEvent[] }>>((acc, event) => {
    const day = toDateKey(new Date(event.occurredAt));
    const last = acc[acc.length - 1];
    if (last && last.day === day) last.items.push(event);
    else acc.push({ day, items: [event] });
    return acc;
  }, []);
}

function LeadProfilePage() {
  const state = useGrowth();
  const params = useParams<{ id: string }>();
  const { toast, askQiko } = useWorkspace();
  const now = useNow();
  const [tab, setTab] = useState<Tab>("overview");
  const [activityFilter, setActivityFilter] = useState("all");
  const [convoFilter, setConvoFilter] = useState<"all" | "email" | "whatsapp">("all");
  const [note, setNote] = useState("");
  const [creating, setCreating] = useState(false);
  const [task, setTask] = useState("");
  const [due, setDue] = useState("");
  const lead = state?.leads.find((item) => item.id === params.id);

  if (!state) return <div className="page"><SkeletonRows rows={6} height={72} /></div>;
  if (!lead) {
    return (
      <div className="page">
        <EmptyState icon="users" title="Lead not found" actions={<Link href="/growth/leads" className="text-link">Back to leads</Link>} />
      </div>
    );
  }

  const owner = state.owners.find((item) => item.id === lead.ownerId);
  const ownerMember = owner ? { id: owner.id, name: owner.name, email: "", role: "" } : null;
  const name = fullName(lead);
  const first = lead.firstName;
  const plan = planOf(lead);
  const openTasks = lead.tasks.filter((item) => !item.done);
  const closedTasks = lead.tasks.filter((item) => item.done);
  const blocked = CHANNELS.filter((channel) => lead.dnc[channel]);
  const records = lead.timeline.map(toRecord);
  const recent30 = lead.timeline.filter((event) => now - new Date(event.at).getTime() <= 30 * 86_400_000);
  const opened = lead.timeline.filter((event) => event.kind === "opened" || event.kind === "clicked").length + (lead.audit?.viewedAt && !lead.timeline.some((event) => event.kind === "opened") ? 1 : 0);
  const latest = lead.timeline[0];
  const messages: RecordMessage[] = lead.timeline
    .filter((event) => event.channel === "email" || event.channel === "whatsapp")
    .slice()
    .sort((a, b) => a.at.localeCompare(b.at))
    .map((event) => ({
      id: event.id,
      channel: event.channel,
      subject: event.summary,
      body: event.summary,
      actor: CHANNEL_LABEL[event.channel],
      at: event.at,
      direction: event.kind === "replied" ? "in" : "out",
    }));
  const visibleMessages = convoFilter === "all" ? messages : messages.filter((message) => message.channel === convoFilter);
  const filtered = activityFilter === "all" ? records : records.filter((event, index) => bucket(lead.timeline[index]) === activityFilter);
  const grouped = groupByDay(activityFilter === "all" ? records : lead.timeline.filter((event) => bucket(event) === activityFilter).map(toRecord));
  const systems = [...new Set(lead.timeline.map((event) => CHANNEL_LABEL[event.channel]))];
  const missing = [
    !lead.signal.linked ? "Signal account" : null,
    !lead.audit ? "prospect audit" : null,
    openTasks.length === 0 ? "named next task" : null,
  ].filter((item): item is string => Boolean(item));
  const intel: SalesRelationshipIntel = {
    strength: lead.timeline.some((event) => event.kind === "replied") ? "Developing" : lead.timeline.length ? "Limited" : "Unknown",
    strengthWhy: lead.timeline.length
      ? `${owner?.name ?? "An owner"} is assigned, with a recorded touch on this lead.`
      : "No outreach is recorded on this lead yet.",
    ownerName: owner?.name ?? "Unassigned",
    network: [],
    clients: [],
    lastInteraction: latest ? { title: latest.summary, at: latest.at, source: CHANNEL_LABEL[latest.channel] } : null,
    missing,
    coverageLabel: missing.length ? `Missing: ${missing.join(", ")}.` : "Owner, account, and a recent touch are on the record.",
    nextAction: openTasks[0]?.text ?? "No open task on this lead.",
    recommendation: null,
  };
  const tabs: Array<{ key: Tab; label: string; count?: number }> = [
    { key: "overview", label: "Overview" },
    { key: "activity", label: "Activity", count: lead.timeline.length },
    { key: "conversations", label: "Conversations", count: messages.length },
    { key: "scans", label: "Scans & reports", count: lead.audit ? 1 : 0 },
    { key: "tasks", label: "Tasks", count: openTasks.length },
    { key: "notes", label: "Notes", count: lead.notes.length },
  ];

  const openTasksTab = () => {
    setCreating(true);
    setTab("tasks");
  };

  return (
    <LeadProfileFrame
      back={{ href: "/growth/leads", label: "Leads" }}
      name={name}
      chips={
        <>
          <span className={`chip chip-dot ${STAGE_CHIP[lead.stage]}`}>{lead.stage}</span>
          {blocked.length > 0 ? <span className="chip">Do not contact</span> : null}
          {lead.manualCheck ? <span className="chip chip-ai">Manual check</span> : null}
        </>
      }
      role={<>{lead.title ? `${lead.title} · ` : ""}{lead.company || "No company on record"}</>}
      contact={
        <>
          <a href={`mailto:${lead.email}`}><Icon name="mail" size={13} /> {lead.email}</a>
          {lead.website ? <span><Icon name="globe" size={13} /> {lead.website.replace(/^https?:\/\//, "")}</span> : null}
          <span><Icon name="globe" size={13} /> {lead.source}</span>
        </>
      }
      controls={
        <>
          <label className={profileStyles.control}>
            <span>Stage</span>
            <Select className="select" aria-label="Stage" value={lead.stage} onChange={(event) => { growth.setStage(lead.id, event.target.value as Stage, lead.lostReason); toast(`Stage → ${event.target.value}`); }}>
              {STAGES.map((stage) => <option key={stage}>{stage}</option>)}
            </Select>
          </label>
          <label className={profileStyles.control}>
            <span>Owner</span>
            <Select className="select" aria-label="Owner" value={lead.ownerId ?? ""} onChange={(event) => growth.setOwner(lead.id, event.target.value || null)}>
              <option value="">Unassigned</option>
              {state.owners.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </Select>
          </label>
        </>
      }
      actions={
        <>
          <Button icon="plus" onClick={openTasksTab}>Create task</Button>
          <Button variant="secondary" icon="mail" onClick={() => { setConvoFilter("email"); setTab("conversations"); }}>Email</Button>
          <Button variant="secondary" icon="whatsapp" onClick={() => { setConvoFilter("whatsapp"); setTab("conversations"); }}>WhatsApp</Button>
          <Button variant="soft" icon="sparkles" onClick={() => askQiko(`Show me everything we know about ${name}`)}>Ask Qiko about {first}</Button>
        </>
      }
      tabs={tabs}
      tab={tab}
      onTab={(key) => setTab(key as Tab)}
      side={
        <>
          <section className="card">
            <div className="card-head"><h2>Details</h2></div>
            <div className="card-body">
              <dl className={profileStyles.details}>
                <div><dt>Email</dt><dd>{lead.email}</dd></div>
                <div><dt>Phone</dt><dd>—</dd></div>
                <div><dt>Company</dt><dd>{lead.company || "—"}</dd></div>
                <div><dt>Job title</dt><dd>{lead.title || "—"}</dd></div>
                <div><dt>Owner</dt><dd>{owner?.name ?? "Unassigned"}</dd></div>
                <div><dt>Next action</dt><dd>{openTasks[0]?.text ?? "No open task"}</dd></div>
              </dl>
            </div>
          </section>
          <OriginCard
            source={lead.source}
            firstSeen={formatDate(lead.createdAt, true)}
            systems={systems.join(", ") || "—"}
            summary={<>{plural(lead.timeline.length, "activity", "activities")} from {plural(systems.length, "system")} merged into one record by email ({lead.email}).</>}
          />
          <section className="card">
            <div className="card-head"><h2>Do not contact</h2></div>
            <div className="card-body">
              <ul className={signal.channelList}>
                {CHANNELS.map((channel) => {
                  const mark = CHANNEL_MARK[channel];
                  const off = lead.dnc[channel];
                  return (
                    <li key={channel}>
                      <label className={signal.channelRow}>
                        <IconTile name={mark.icon} tone={off ? "danger" : mark.tone} size="sm" />
                        <span className={signal.channelCopy}>
                          <b>{mark.label}</b>
                          <small>{off ? "Blocked" : "Can contact"}</small>
                        </span>
                        <input className={signal.switch} type="checkbox" checked={off} aria-label={`${mark.label} do not contact`} onChange={(event) => growth.setDnc(lead.id, channel, event.target.checked)} />
                      </label>
                    </li>
                  );
                })}
              </ul>
              <p className="card-sub">A blocked channel is left out of campaigns, sequences and messages.</p>
            </div>
          </section>
        </>
      }
    >
      {tab === "overview" && (
        <RecordStack>
          <section className="card">
            <div className="card-body">
              <RelationshipIntelligence intel={intel} variant="page" />
            </div>
          </section>
          <EngagementCard
            name={first}
            stats={[
              { label: "Activity · 30 days", value: recent30.length },
              { label: "Free scans", value: lead.audit && !lead.audit.unreadable ? 1 : lead.signal.auditsRun },
              { label: "Reports opened", value: opened },
              { label: "Logins", value: lead.signal.lastLogin ? 1 : 0 },
              { label: "Last activity", value: latest ? timeAgo(latest.at, now || undefined) : "—" },
              { label: "Open tasks", value: openTasks.length },
            ]}
          />
          <PanelCard
            title="Email and WhatsApp"
            extra={
              <div className={profileStyles.convoActions}>
                <Button size="small" variant="secondary" icon="mail" onClick={() => { setConvoFilter("email"); setTab("conversations"); }}>Email</Button>
                <Button size="small" variant="secondary" icon="whatsapp" onClick={() => { setConvoFilter("whatsapp"); setTab("conversations"); }}>WhatsApp</Button>
              </div>
            }
          >
            {messages.length === 0 ? (
              <EmptyState icon="message" title="No messages yet">Send an email or WhatsApp and the thread stays on this lead.</EmptyState>
            ) : (
              <>
                <MessageThread messages={messages.slice(-4)} now={now} />
                {messages.length > 4 ? (
                  <button type="button" className="link-button" onClick={() => setTab("conversations")}>
                    All {messages.length} messages <Icon name="arrowRight" size={13} />
                  </button>
                ) : null}
              </>
            )}
          </PanelCard>
          <PanelCard
            title={openTasks.length ? "Planned follow-ups" : "Next step"}
            extra={<Button size="small" variant="secondary" icon="plus" onClick={openTasksTab}>Task</Button>}
            stack
          >
            {openTasks.map((item) => {
              const dueText = dueLabel(item.due || null, "pending");
              return (
                <TaskCardView
                  key={item.id}
                  title={item.text}
                  done={false}
                  closed={false}
                  overdue={Boolean(item.due && item.due < todayKey())}
                  priority="medium"
                  dueText={dueText.text}
                  dueTone={dueText.tone}
                  owner={ownerMember}
                  onToggle={() => growth.toggleTask(lead.id, item.id)}
                />
              );
            })}
            {openTasks.length === 0 ? (
              <EmptyState icon="checkCircle" title="No open task" actions={<Button size="small" icon="plus" onClick={openTasksTab}>Plan a follow-up</Button>}>
                No open tasks or suggestions for this lead.
              </EmptyState>
            ) : null}
          </PanelCard>
          <PanelCard
            title="Recent activity"
            extra={<button type="button" className="link-button" onClick={() => setTab("activity")}>Full history <Icon name="arrowRight" size={13} /></button>}
          >
            {records.length === 0 ? <EmptyState icon="clock" title="No outreach yet" /> : <LeadTimeline groups={groupByDay(records).slice(0, 2)} now={now} />}
          </PanelCard>
        </RecordStack>
      )}

      {tab === "activity" && (
        <PanelCard
          title={plural(filtered.length, "event")}
          extra={<FilterBar label="Filter activity" value={activityFilter} options={ACTIVITY_FILTERS} onChange={setActivityFilter} />}
        >
          {grouped.length ? <LeadTimeline groups={grouped} now={now} /> : <EmptyState title="No events of this type" />}
        </PanelCard>
      )}

      {tab === "conversations" && (
        <PanelCard
          title={plural(visibleMessages.length, "message")}
          extra={
            <div className={profileStyles.convoActions}>
              <Button size="small" variant="secondary" icon="mail" onClick={() => setConvoFilter("email")}>Email</Button>
              <Button size="small" variant="secondary" icon="whatsapp" onClick={() => setConvoFilter("whatsapp")}>WhatsApp</Button>
            </div>
          }
        >
          <FilterBar
            label="Filter conversation"
            value={convoFilter}
            onChange={(key) => setConvoFilter(key as "all" | "email" | "whatsapp")}
            options={[
              { key: "all", label: "All", count: messages.length },
              { key: "email", label: "Email", count: messages.filter((message) => message.channel === "email").length },
              { key: "whatsapp", label: "WhatsApp", count: messages.filter((message) => message.channel === "whatsapp").length },
            ]}
          />
          {visibleMessages.length === 0 ? (
            <EmptyState icon={convoFilter === "whatsapp" ? "whatsapp" : "mail"} title={convoFilter === "all" ? "No messages yet" : `No ${convoFilter === "email" ? "email" : "WhatsApp"} messages`}>
              New messages are saved here and opened in your email or WhatsApp app.
            </EmptyState>
          ) : (
            <MessageThread messages={visibleMessages} now={now} />
          )}
        </PanelCard>
      )}

      {tab === "scans" && (
        <RecordStack>
          {!lead.audit ? (
            <EmptyState icon="scan" title="No scans or reports yet">When {first} completes a free scan on Qiko Signal it will appear here.</EmptyState>
          ) : (
            <article className={`card ${profileStyles.scan}`}>
              <div className={profileStyles.scanScore} data-tone={lead.audit.aio == null ? "mid" : lead.audit.aio < 50 ? "low" : lead.audit.aio < 70 ? "mid" : "high"}>
                <b>{lead.audit.aio ?? "—"}</b>
                <small>AIO</small>
              </div>
              <div className={profileStyles.scanBody}>
                <p className="kicker">Fast audit · {lead.audit.sentAt ? formatDate(lead.audit.sentAt, true) : lead.audit.status}</p>
                <h3>{lead.website || lead.company}</h3>
                <ul>
                  <li>{lead.audit.topProblem}</li>
                  {lead.audit.seo != null ? <li>SEO {lead.audit.seo}</li> : null}
                  {lead.audit.fixes.map((finding) => <li key={finding}>{finding}</li>)}
                </ul>
                <div className={profileStyles.scanFoot}>
                  <span className="tag"><Icon name="file" size={11} />&nbsp;{lead.audit.status}</span>
                  {lead.audit.token && !lead.audit.unreadable ? <Link href={`/r/${lead.audit.token}`} className="text-link">Open report</Link> : null}
                </div>
              </div>
            </article>
          )}
          <PanelCard title="Signal account" stack>
            {!lead.signal.linked ? (
              <p className="card-sub">No Signal account linked yet. It links by email when they sign up.</p>
            ) : (
              <p>Plan {plan} · {lead.signal.auditsRun} {lead.signal.auditsRun === 1 ? "audit" : "audits"} · AIO {lead.signal.aio ?? "—"} · SEO {lead.signal.seo ?? "—"}</p>
            )}
            <div className={profileStyles.convoActions}>
              {EVENTS.map((event) => (
                <Button key={event.id} size="small" variant="secondary" onClick={() => { growth.signal(lead.id, event.id); toast(event.label); }}>{event.label}</Button>
              ))}
            </div>
          </PanelCard>
        </RecordStack>
      )}

      {tab === "tasks" && (
        <PanelCard
          title={plural(openTasks.length, "open task")}
          extra={<Button size="small" icon="plus" onClick={() => setCreating(true)}>New task</Button>}
          stack
        >
          {creating ? (
            <form className="form-grid" onSubmit={(event) => { event.preventDefault(); if (task.trim().length < 2 || !due) return; growth.addTask(lead.id, task.trim(), due); setTask(""); setDue(""); setCreating(false); toast("Task added"); }}>
              <div className="form-row">
                <label className="field"><span>Task</span><input className="input" value={task} onChange={(event) => setTask(event.target.value)} placeholder={`Follow up with ${first}`} /></label>
                <label className="field"><span>Due</span><input className="input" type="date" value={due} onChange={(event) => setDue(event.target.value)} required /></label>
              </div>
              <Button type="submit" size="small" icon="plus" disabled={task.trim().length < 2}>Add task</Button>
            </form>
          ) : null}
          {openTasks.length === 0 ? <EmptyState icon="tasks" title="No open tasks" actions={<Button size="small" icon="plus" onClick={() => setCreating(true)}>Create task</Button>} /> : null}
          {openTasks.map((item) => {
            const dueText = dueLabel(item.due || null, "pending");
            return (
              <TaskCardView
                key={item.id}
                title={item.text}
                done={false}
                closed={false}
                overdue={Boolean(item.due && item.due < todayKey())}
                priority="medium"
                dueText={dueText.text}
                dueTone={dueText.tone}
                owner={ownerMember}
                onToggle={() => growth.toggleTask(lead.id, item.id)}
              />
            );
          })}
          {closedTasks.length > 0 ? <p className={`kicker ${profileStyles.subhead}`}>Completed & dismissed</p> : null}
          {closedTasks.map((item) => {
            const dueText = dueLabel(item.due || null, "completed");
            return (
              <TaskCardView
                key={item.id}
                title={item.text}
                done
                closed
                overdue={false}
                priority="medium"
                dueText={dueText.text}
                dueTone={dueText.tone}
                owner={ownerMember}
                onToggle={() => growth.toggleTask(lead.id, item.id)}
              />
            );
          })}
        </PanelCard>
      )}

      {tab === "notes" && (
        <PanelCard title="Team notes" stack>
          <form className={profileStyles.noteForm} onSubmit={(event) => { event.preventDefault(); if (note.trim().length < 2) return; growth.addNote(lead.id, note.trim(), owner?.name ?? "Ed"); setNote(""); toast("Note added"); }}>
            <textarea className="textarea" rows={3} value={note} onChange={(event) => setNote(event.target.value)} placeholder={`Add a note about ${first}…`} aria-label="New note" />
            <Button type="submit" size="small" icon="plus" disabled={note.trim().length < 2}>Add note</Button>
          </form>
          {lead.notes.length === 0 ? <EmptyState icon="note" title="No notes yet">Capture context from calls and meetings so the whole team has it.</EmptyState> : null}
          {lead.notes.map((item) => (
            <NoteArticle key={item.id} author={item.author} when={timeAgo(item.at, now || undefined)} whenTitle={formatDateTime(item.at)} body={item.text} />
          ))}
        </PanelCard>
      )}
    </LeadProfileFrame>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<div className="page"><SkeletonRows rows={6} height={72} /></div>}>
      <LeadProfilePage />
    </Suspense>
  );
}
