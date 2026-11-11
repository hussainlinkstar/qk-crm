"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";
import { crm } from "@/lib/crm-store";
import { addDays, formatDate, formatDateTime, initials, plural, timeAgo, toDateKey } from "@/lib/format";
import { isOpen, sortTasks, type LeadView } from "@/lib/insights";
import { LEAD_STATUSES, type ActivityKind, type ConversationChannel, type CrmState, type LeadStatus } from "@/lib/types";
import Button from "@/components/ui/Button";
import Icon from "@/components/ui/Icon";
import { ConfirmDialog } from "@/components/ui/Overlay";
import { KIND_ICON } from "@/components/ui/kind-icons";
import { EmptyState, LeadStatusChip, SkeletonRows, useNow, useWorkspaceData } from "@/components/ui/bits";
import SuggestionCard from "@/components/tasks/SuggestionCard";
import TaskCard from "@/components/tasks/TaskCard";
import LogInteractionModal from "@/components/leads/LogInteractionModal";
import ComposeMessageModal from "@/components/leads/ComposeMessageModal";
import { useWorkspace } from "@/components/shell/WorkspaceContext";
import RelationshipIntelligence from "@/components/sales/RelationshipIntelligence";
import { salesRelationshipIntel } from "@/lib/sales-relationship";
import styles from "./profile.module.css";

type Tab = "overview" | "activity" | "conversations" | "scans" | "tasks" | "notes";
const ACTIVITY_GROUPS: { key: string; label: string; kinds: ActivityKind[] }[] = [
  { key: "all", label: "All", kinds: [] },
  { key: "product", label: "Product", kinds: ["signup", "login", "product", "report"] },
  { key: "scans", label: "Scans", kinds: ["scan"] },
  { key: "enquiries", label: "Enquiries", kinds: ["enquiry"] },
  { key: "crm", label: "CRM", kinds: ["lead_created", "status_change", "owner_change", "interaction", "task", "note", "opportunity", "conversion"] },
];

export default function LeadProfilePage() {
  const params = useParams<{ id: string }>();
  const { state, workspace } = useWorkspaceData();
  if (!state || !workspace) {
    return (
      <div className="page">
        <SkeletonRows rows={5} height={80} />
      </div>
    );
  }
  const lead = workspace.leadById.get(params.id);
  if (!lead) {
    return (
      <div className="page">
        <EmptyState icon="users" title="Lead not found" actions={<Link href="/sales/leads">Back to leads</Link>}>
          This lead may have been removed, or the link is incorrect.
        </EmptyState>
      </div>
    );
  }
  return <Profile key={lead.id} lead={lead} state={state} />;
}

function Profile({ lead, state }: { lead: LeadView; state: CrmState }) {
  const router = useRouter();
  const { workspace } = useWorkspaceData();
  const { openTaskForm, askQiko, toast } = useWorkspace();
  const now = useNow();
  const [tab, setTab] = useState<Tab>("overview");
  const [activityFilter, setActivityFilter] = useState("all");
  const [logOpen, setLogOpen] = useState(false);
  const [compose, setCompose] = useState<ConversationChannel | null>(null);
  const [convoFilter, setConvoFilter] = useState<ConversationChannel | "all">("all");
  const [pending, setPending] = useState<{ field: "status" | "owner"; value: string } | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [deleteNote, setDeleteNote] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [details, setDetails] = useState({ email: lead.email, phone: lead.phone ?? "", company: lead.company ?? "", role: lead.role ?? "", nextAction: lead.nextAction ?? "" });

  const events = useMemo(() => workspace?.byLead.get(lead.id) ?? [], [workspace, lead.id]);
  if (!workspace) return null;

  const owner = state.members.find((member) => member.id === lead.ownerId);
  const scans = state.scans.filter((scan) => scan.leadId === lead.id).sort((a, b) => b.completedAt.localeCompare(a.completedAt));
  const notes = state.notes.filter((note) => note.leadId === lead.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const messages = (state.messages ?? []).filter((message) => message.leadId === lead.id).sort((a, b) => a.at.localeCompare(b.at));
  const visibleMessages = convoFilter === "all" ? messages : messages.filter((message) => message.channel === convoFilter);
  const tasks = sortTasks(state.tasks.filter((task) => task.leadId === lead.id));
  const openTasks = tasks.filter(isOpen);
  const closedTasks = tasks.filter((task) => !isOpen(task)).sort((a, b) => (b.completedAt ?? b.updatedAt).localeCompare(a.completedAt ?? a.updatedAt));
  const suggestions = workspace.suggestions.filter((item) => item.leadId === lead.id);
  const memberById = new Map(state.members.map((member) => [member.id, member]));
  const recent30 = events.filter((event) => now - new Date(event.occurredAt).getTime() <= 30 * 86_400_000);
  const reports = events.filter((event) => event.kind === "report");
  const logins = events.filter((event) => event.kind === "login");
  const sources = [...new Set(events.map((event) => event.source))];
  const relationship = salesRelationshipIntel(state, { leadId: lead.id });
  const filterKinds = ACTIVITY_GROUPS.find((group) => group.key === activityFilter)?.kinds ?? [];
  const timeline = filterKinds.length ? events.filter((event) => filterKinds.includes(event.kind)) : events;
  const grouped = timeline.reduce<{ day: string; items: typeof timeline }[]>((acc, event) => {
    const day = toDateKey(new Date(event.occurredAt));
    const last = acc[acc.length - 1];
    if (last && last.day === day) last.items.push(event);
    else acc.push({ day, items: [event] });
    return acc;
  }, []);

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: "overview", label: "Overview" },
    { key: "activity", label: "Activity", count: events.length },
    { key: "conversations", label: "Conversations", count: messages.length },
    { key: "scans", label: "Scans & reports", count: scans.length + reports.length },
    { key: "tasks", label: "Tasks", count: openTasks.length },
    { key: "notes", label: "Notes", count: notes.length },
  ];

  const saveDetails = (event: FormEvent) => {
    event.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(details.email.trim())) {
      toast("Enter a valid email address", "error");
      return;
    }
    const clash = state.leads.find((item) => item.id !== lead.id && item.email.toLowerCase() === details.email.trim().toLowerCase());
    if (clash) {
      toast(`That email already belongs to ${clash.name}`, "error");
      return;
    }
    crm.updateLead(lead.id, { email: details.email.trim().toLowerCase(), phone: details.phone.trim() || null, company: details.company.trim() || null, role: details.role.trim() || null, nextAction: details.nextAction.trim() || null });
    setEditing(false);
    toast("Lead details saved");
  };

  const addNote = (event: FormEvent) => {
    event.preventDefault();
    if (noteDraft.trim().length < 2) return;
    crm.addNote(lead.id, noteDraft);
    setNoteDraft("");
    toast("Note added");
  };

  const newTask = () => openTaskForm({ initial: { title: `Follow up with ${lead.name}`, leadId: lead.id, ownerId: lead.ownerId ?? "me", due: addDays(1) } });

  return (
    <div className="page">
      <Link href="/sales/leads" className="breadcrumb">
        <Icon name="arrowLeft" size={14} /> Leads
      </Link>

      <section className={`card ${styles.header}`}>
        <div className={styles.identity}>
          <span className="avatar avatar-lg">{initials(lead.name)}</span>
          <div className={styles.identityText}>
            <div className={styles.nameRow}>
              <h1>{lead.name}</h1>
              <LeadStatusChip status={lead.status} />
              {suggestions.length > 0 && (
                <span className="chip chip-ai">
                  <Icon name="sparkles" size={11} /> {plural(suggestions.length, "suggestion")}
                </span>
              )}
            </div>
            <p className={styles.role}>
              {lead.role ? `${lead.role} · ` : ""}
              {lead.company ?? "No company on record"}
            </p>
            <p className={styles.contact}>
              <a href={`mailto:${lead.email}`} onClick={(event) => { event.preventDefault(); setCompose("email"); }}>
                <Icon name="mail" size={13} /> {lead.email}
              </a>
              {lead.phone && (
                <a href={`tel:${lead.phone.replace(/\s/g, "")}`}>
                  <Icon name="phone" size={13} /> {lead.phone}
                </a>
              )}
              <span>
                <Icon name="globe" size={13} /> {lead.source}
              </span>
            </p>
          </div>
        </div>
        <div className={styles.controls}>
          <label className={styles.control}>
            <span>Status</span>
            <select className="select" value={lead.status} onChange={(event) => setPending({ field: "status", value: event.target.value })}>
              {LEAD_STATUSES.map((status) => <option key={status}>{status}</option>)}
            </select>
          </label>
          <label className={styles.control}>
            <span>Owner</span>
            <select className="select" value={lead.ownerId ?? ""} onChange={(event) => setPending({ field: "owner", value: event.target.value })}>
              <option value="">Unassigned</option>
              {state.members.map((member) => <option key={member.id} value={member.id}>{member.id === "me" ? `${member.name} (you)` : member.name}</option>)}
            </select>
          </label>
        </div>
        <div className={styles.actions}>
          <Button icon="plus" onClick={newTask}>Create task</Button>
          <Button variant="secondary" icon="phone" onClick={() => setLogOpen(true)}>Log interaction</Button>
          <Button variant="secondary" icon="mail" onClick={() => setCompose("email")}>Email</Button>
          <Button variant="secondary" icon="whatsapp" onClick={() => setCompose("whatsapp")}>WhatsApp</Button>
          {lead.status !== "Converted" && (state.tessiant?.accounts.length ?? 0) > 0 && (
            <Button
              variant="secondary"
              onClick={() => {
                const accountId = lead.accountId ?? state.tessiant!.accounts[0].id;
                const result = crm.convertLead(lead.id, {
                  accountId,
                  opportunityName: `${lead.company ?? lead.name} · ${lead.serviceInterest ?? "engagement"}`,
                  opportunityType: (lead.serviceInterest as "augmentation" | "advisory" | "consultancy" | "project team" | "mixed") || "augmentation",
                  amount: 120000,
                  services: lead.serviceInterest ? [lead.serviceInterest] : ["Staff augmentation"],
                });
                if (!result.ok) {
                  toast(result.error, "error");
                  return;
                }
                toast("Lead converted to contact + opportunity", "success");
                router.push(`/sales/accounts/${accountId}`);
              }}
            >
              Convert to opportunity
            </Button>
          )}
          {lead.convertedOpportunityId && (
            <Link href="/sales/pipeline">
              <Button variant="ghost">Open opportunities</Button>
            </Link>
          )}
          <Button variant="soft" icon="sparkles" onClick={() => askQiko(`Show me everything we know about ${lead.name}`, lead.id)}>Ask Qiko about {lead.name.split(" ")[0]}</Button>
        </div>
      </section>

      <div className={styles.layout}>
        <div className={styles.main}>
          <nav className={styles.tabs} aria-label="Lead sections">
            {tabs.map((item) => (
              <button type="button" key={item.key} aria-pressed={tab === item.key} onClick={() => setTab(item.key)}>
                {item.label}
                {item.count !== undefined && <span>{item.count}</span>}
              </button>
            ))}
          </nav>

          {tab === "overview" && (
            <div className={styles.stack}>
              <section className="card">
                <div className="card-body">
                  <RelationshipIntelligence intel={relationship} variant="page" />
                </div>
              </section>
              <section className="card">
                <div className="card-head">
                  <div>
                    <h2>How {lead.name.split(" ")[0]} is engaging</h2>
                  </div>
                </div>
                <div className="card-body">
                  <dl className={styles.stats}>
                    <div><dt>Activity · 30 days</dt><dd>{recent30.length}</dd></div>
                    <div><dt>Free scans</dt><dd>{scans.length}</dd></div>
                    <div><dt>Reports opened</dt><dd>{reports.length}</dd></div>
                    <div><dt>Logins</dt><dd>{logins.length}</dd></div>
                    <div><dt>Last activity</dt><dd>{lead.lastActivity ? timeAgo(lead.lastActivity.occurredAt, now || undefined) : "—"}</dd></div>
                    <div><dt>Open tasks</dt><dd>{openTasks.length}</dd></div>
                  </dl>
                </div>
              </section>

              <section className="card">
                <div className="card-head">
                  <div>
                    <h2>Email and WhatsApp</h2>
                  </div>
                  <div className={styles.convoActions}>
                    <Button size="small" variant="secondary" icon="mail" onClick={() => setCompose("email")}>Email</Button>
                    <Button size="small" variant="secondary" icon="whatsapp" onClick={() => setCompose("whatsapp")}>WhatsApp</Button>
                  </div>
                </div>
                <div className="card-body">
                  {messages.length === 0 ? (
                    <EmptyState icon="message" title="No messages yet">Send an email or WhatsApp and the thread stays on this lead.</EmptyState>
                  ) : (
                    <>
                      <MessageThread messages={messages.slice(-4)} now={now} />
                      {messages.length > 4 && (
                        <button type="button" className={`link-button ${styles.threadMore}`} onClick={() => setTab("conversations")}>
                          All {messages.length} messages <Icon name="arrowRight" size={13} />
                        </button>
                      )}
                    </>
                  )}
                </div>
              </section>

              <section className="card">
                <div className="card-head">
                  <div>
                    <h2>{suggestions.length ? "Qiko recommends" : openTasks.length ? "Planned follow-ups" : "Next step"}</h2>
                  </div>
                  <Button size="small" variant="secondary" icon="plus" onClick={newTask}>Task</Button>
                </div>
                <div className={`card-body ${styles.stack}`}>
                  {suggestions.map((suggestion) => <SuggestionCard key={suggestion.id} suggestion={suggestion} lead={lead} showLead={false} defaultOpen />)}
                  {openTasks.map((task) => <TaskCard key={task.id} task={task} owner={task.ownerId ? memberById.get(task.ownerId) : null} showLead={false} />)}
                  {!suggestions.length && !openTasks.length && <EmptyState icon="checkCircle" title={lead.nextActionLabel} actions={<Button size="small" icon="plus" onClick={newTask}>Plan a follow-up</Button>}>No open tasks or suggestions for this lead.</EmptyState>}
                </div>
              </section>

              <section className="card">
                <div className="card-head">
                  <div>
                    <h2>Recent activity</h2>
                  </div>
                  <button type="button" className="link-button" onClick={() => setTab("activity")}>
                    Full history <Icon name="arrowRight" size={13} />
                  </button>
                </div>
                <div className="card-body">
                  <Timeline groups={grouped.slice(0, 2)} now={now} />
                </div>
              </section>
            </div>
          )}

          {tab === "activity" && (
            <section className="card">
              <div className="card-head">
                <div>
                  <h2>{plural(timeline.length, "event")}</h2>
                </div>
                <div className="segmented" role="group" aria-label="Filter activity">
                  {ACTIVITY_GROUPS.map((group) => (
                    <button type="button" key={group.key} aria-pressed={activityFilter === group.key} onClick={() => setActivityFilter(group.key)}>
                      {group.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="card-body">
                {timeline.length ? <Timeline groups={grouped} now={now} /> : <EmptyState title="No events of this type" />}
              </div>
            </section>
          )}

          {tab === "conversations" && (
            <section className="card">
              <div className="card-head">
                <div>
                  <h2>{plural(visibleMessages.length, "message")}</h2>
                </div>
                <div className={styles.convoActions}>
                  <Button size="small" variant="secondary" icon="mail" onClick={() => setCompose("email")}>Email</Button>
                  <Button size="small" variant="secondary" icon="whatsapp" onClick={() => setCompose("whatsapp")}>WhatsApp</Button>
                </div>
              </div>
              <div className="card-body">
                <div className="segmented" role="group" aria-label="Filter conversation">
                  {(["all", "email", "whatsapp"] as const).map((value) => (
                    <button type="button" key={value} aria-pressed={convoFilter === value} onClick={() => setConvoFilter(value)}>
                      {value === "all" ? "All" : value === "email" ? "Email" : "WhatsApp"}
                      <span className="count">{value === "all" ? messages.length : messages.filter((message) => message.channel === value).length}</span>
                    </button>
                  ))}
                </div>
                {visibleMessages.length === 0 ? (
                  <EmptyState icon={convoFilter === "whatsapp" ? "whatsapp" : "mail"} title={convoFilter === "all" ? "No messages yet" : `No ${convoFilter === "email" ? "email" : "WhatsApp"} messages`}>
                    New messages are saved here and opened in your email or WhatsApp app.
                  </EmptyState>
                ) : (
                  <MessageThread messages={visibleMessages} now={now} />
                )}
              </div>
            </section>
          )}

          {tab === "scans" && (
            <div className={styles.stack}>
              {scans.length === 0 && reports.length === 0 && <EmptyState icon="scan" title="No scans or reports yet">When {lead.name.split(" ")[0]} completes a free scan on Qiko Signal it will appear here.</EmptyState>}
              {scans.map((scan) => (
                <article key={scan.id} className={`card ${styles.scan}`}>
                  <div className={styles.scanScore} data-tone={scan.score < 50 ? "low" : scan.score < 70 ? "mid" : "high"}>
                    <b>{scan.score}</b>
                    <small>/100</small>
                  </div>
                  <div className={styles.scanBody}>
                    <p className="kicker">Free scan · {formatDate(scan.completedAt, true)}</p>
                    <h3>{scan.website}</h3>
                    <ul>
                      {scan.findings.map((finding) => <li key={finding}>{finding}</li>)}
                    </ul>
                    <div className={styles.scanFoot}>
                      <span className="tag"><Icon name="file" size={11} />&nbsp;{scan.reportName}</span>
                      <Button size="small" variant="secondary" icon="plus" onClick={() => openTaskForm({ evidence: [{ label: `Scan of ${scan.website}: ${scan.score}/100`, detail: scan.findings.join("; "), at: scan.completedAt, source: "Qiko Signal", kind: "fact" }], initial: { title: `Walk ${lead.name} through the ${scan.website} scan`, description: `Key findings: ${scan.findings.join("; ")}`, leadId: lead.id, priority: scan.score < 60 ? "high" : "medium", ownerId: lead.ownerId ?? "me", due: addDays(1) } })}>
                        Follow up on scan
                      </Button>
                    </div>
                  </div>
                </article>
              ))}
              {reports.length > 0 && (
                <section className="card">
                  <div className="card-head"><div><h2>Associated reports</h2></div></div>
                  <div className="card-body"><Timeline groups={[{ day: "reports", items: reports }]} now={now} hideDay /></div>
                </section>
              )}
            </div>
          )}

          {tab === "tasks" && (
            <section className="card">
              <div className="card-head">
                <div>
                  <h2>{plural(openTasks.length, "open task")}</h2>
                </div>
                <Button size="small" icon="plus" onClick={newTask}>New task</Button>
              </div>
              <div className={`card-body ${styles.stack}`}>
                {openTasks.length === 0 && <EmptyState icon="tasks" title="No open tasks" actions={<Button size="small" icon="plus" onClick={newTask}>Create task</Button>} />}
                {openTasks.map((task) => <TaskCard key={task.id} task={task} owner={task.ownerId ? memberById.get(task.ownerId) : null} showLead={false} />)}
                {closedTasks.length > 0 && <p className={`kicker ${styles.subhead}`}>Completed & dismissed</p>}
                {closedTasks.map((task) => <TaskCard key={task.id} task={task} owner={task.ownerId ? memberById.get(task.ownerId) : null} showLead={false} />)}
              </div>
            </section>
          )}

          {tab === "notes" && (
            <section className="card">
              <div className="card-head">
                <div>
                  <h2>Team notes</h2>
                </div>
              </div>
              <div className={`card-body ${styles.stack}`}>
                <form onSubmit={addNote} className={styles.noteForm}>
                  <textarea className="textarea" rows={3} value={noteDraft} onChange={(event) => setNoteDraft(event.target.value)} placeholder={`Add a note about ${lead.name.split(" ")[0]}…`} aria-label="New note" />
                  <Button type="submit" size="small" icon="plus" disabled={noteDraft.trim().length < 2}>Add note</Button>
                </form>
                {notes.length === 0 && <EmptyState icon="note" title="No notes yet">Capture context from calls and meetings so the whole team has it.</EmptyState>}
                {notes.map((note) => (
                  <article key={note.id} className={styles.note}>
                    <div className={styles.noteHead}>
                      <span className="avatar avatar-sm">{initials(memberById.get(note.authorId)?.name)}</span>
                      <b>{note.authorId === "me" ? "You" : memberById.get(note.authorId)?.name ?? "Former member"}</b>
                      <small title={formatDateTime(note.createdAt)}>{timeAgo(note.createdAt, now || undefined)}</small>
                      <Button size="small" variant="ghost" icon="trash" aria-label="Delete note" onClick={() => setDeleteNote(note.id)} />
                    </div>
                    <p>{note.body}</p>
                  </article>
                ))}
              </div>
            </section>
          )}
        </div>

        <aside className={styles.side}>
          <section className="card">
            <div className="card-head">
              <div>
                <h2>Details</h2>
              </div>
              {!editing && <Button size="small" variant="ghost" icon="edit" onClick={() => setEditing(true)}>Edit</Button>}
            </div>
            <div className="card-body">
              {editing ? (
                <form className="form-grid" onSubmit={saveDetails}>
                  <label className="field"><span>Email</span><input className="input" type="email" value={details.email} onChange={(event) => setDetails({ ...details, email: event.target.value })} /></label>
                  <label className="field"><span>Phone</span><input className="input" value={details.phone} onChange={(event) => setDetails({ ...details, phone: event.target.value })} /></label>
                  <label className="field"><span>Company</span><input className="input" value={details.company} onChange={(event) => setDetails({ ...details, company: event.target.value })} /></label>
                  <label className="field"><span>Job title</span><input className="input" value={details.role} onChange={(event) => setDetails({ ...details, role: event.target.value })} /></label>
                  <label className="field"><span>Next action override</span><input className="input" value={details.nextAction} onChange={(event) => setDetails({ ...details, nextAction: event.target.value })} placeholder="Leave empty to use tasks & suggestions" /></label>
                  <div className={styles.formActions}>
                    <Button variant="secondary" size="small" onClick={() => { setEditing(false); setDetails({ email: lead.email, phone: lead.phone ?? "", company: lead.company ?? "", role: lead.role ?? "", nextAction: lead.nextAction ?? "" }); }}>Cancel</Button>
                    <Button type="submit" size="small" icon="check">Save</Button>
                  </div>
                </form>
              ) : (
                <dl className={styles.details}>
                  <div><dt>Email</dt><dd>{lead.email}</dd></div>
                  <div><dt>Phone</dt><dd>{lead.phone ?? "—"}</dd></div>
                  <div><dt>Company</dt><dd>{lead.company ?? "—"}</dd></div>
                  <div><dt>Job title</dt><dd>{lead.role ?? "—"}</dd></div>
                  <div><dt>Owner</dt><dd>{owner?.name ?? "Unassigned"}</dd></div>
                  <div><dt>Next action</dt><dd>{lead.nextActionLabel}</dd></div>
                </dl>
              )}
            </div>
          </section>

          <section className="card">
            <div className="card-head">
              <div>
                <h2>Where this lead came from</h2>
              </div>
            </div>
            <div className="card-body">
              <dl className={styles.details}>
                <div><dt>Original source</dt><dd>{lead.source}</dd></div>
                <div><dt>First seen</dt><dd>{formatDate(lead.createdAt, true)}</dd></div>
                <div><dt>Systems with activity</dt><dd>{sources.join(", ") || "—"}</dd></div>
              </dl>
              <p className={styles.dedupe}>
                <Icon name="checkCircle" size={13} /> {plural(events.length, "activity", "activities")} from {plural(sources.length, "system")} merged into one record by email ({lead.email}).
              </p>
            </div>
          </section>
        </aside>
      </div>

      {logOpen && <LogInteractionModal leadId={lead.id} leadName={lead.name} onClose={() => setLogOpen(false)} />}
      {compose && (
        <ComposeMessageModal
          channel={compose}
          leadId={lead.id}
          leadName={lead.name}
          address={compose === "email" ? lead.email : lead.phone ?? ""}
          onClose={() => setCompose(null)}
          onSent={() => { setTab("conversations"); setConvoFilter(compose); }}
        />
      )}
      {pending && (
        <ConfirmDialog
          title={`Update ${pending.field}?`}
          description={
            pending.field === "status" ? (
              <>Change {lead.name}&apos;s status from <b>{lead.status}</b> to <b>{pending.value}</b>.</>
            ) : (
              <>Reassign {lead.name} from <b>{owner?.name ?? "Unassigned"}</b> to <b>{pending.value ? memberById.get(pending.value)?.name : "Unassigned"}</b>.</>
            )
          }
          confirmLabel="Yes, update"
          onCancel={() => setPending(null)}
          onConfirm={() => {
            if (pending.field === "status") crm.updateLead(lead.id, { status: pending.value as LeadStatus });
            else crm.updateLead(lead.id, { ownerId: pending.value || null });
            toast(pending.field === "status" ? `Status updated to ${pending.value}` : "Owner updated");
            setPending(null);
          }}
        />
      )}
      {deleteNote && (
        <ConfirmDialog
          tone="danger"
          title="Delete this note?"
          description="This can't be undone."
          confirmLabel="Delete note"
          onCancel={() => setDeleteNote(null)}
          onConfirm={() => {
            crm.deleteNote(deleteNote);
            setDeleteNote(null);
            toast("Note deleted", "info");
          }}
        />
      )}
    </div>
  );
}

function MessageThread({ messages, now }: { messages: CrmState["messages"]; now: number }) {
  return (
    <div className={styles.thread}>
      {messages.map((message) => (
        <article key={message.id} className={`${styles.bubble} ${message.direction === "out" ? styles.bubbleOut : styles.bubbleIn}`}>
          <b>{message.channel === "email" ? message.subject || "Email" : "WhatsApp"}</b>
          <p>{message.body}</p>
          <small>
            {message.actor} · {message.channel === "email" ? "Email" : "WhatsApp"} · <span title={formatDateTime(message.at)}>{timeAgo(message.at, now || undefined)}</span>
          </small>
        </article>
      ))}
    </div>
  );
}

function Timeline({ groups, now, hideDay = false }: { groups: { day: string; items: LeadView["lastActivity"][] }[]; now: number; hideDay?: boolean }) {
  return (
    <div className={styles.timeline}>
      {groups.map((group) => (
        <div key={group.day}>
          {!hideDay && <p className={styles.day}>{formatDate(group.day, true)}</p>}
          <ol>
            {group.items.map((event) =>
              event ? (
                <li key={event.id}>
                  <span className={`${styles.timelineIcon} ${styles[`kind_${event.kind}`] ?? ""}`}>
                    <Icon name={KIND_ICON[event.kind]} size={13} />
                  </span>
                  <div>
                    <b>{event.title}</b>
                    {event.detail && <p>{event.detail}</p>}
                    <small>
                      {event.source}
                      {event.actor ? ` · ${event.actor}` : ""} · <span title={formatDateTime(event.occurredAt)}>{timeAgo(event.occurredAt, now || undefined)}</span>
                    </small>
                  </div>
                </li>
              ) : null,
            )}
          </ol>
        </div>
      ))}
    </div>
  );
}
