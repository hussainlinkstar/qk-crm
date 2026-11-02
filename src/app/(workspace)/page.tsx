"use client";

import Link from "next/link";
import { useMemo, useState, type FormEvent } from "react";
import { SUGGESTED_QUESTIONS } from "@/lib/copilot";
import { crm } from "@/lib/crm-store";
import { buildPriorities, isOpen, sortTasks, taskCounts, type PriorityGroup } from "@/lib/insights";
import { firstName, greeting, initials, plural, timeAgo, todayKey } from "@/lib/format";
import Button from "@/components/ui/Button";
import Icon, { type IconName } from "@/components/ui/Icon";
import { KIND_ICON } from "@/components/ui/kind-icons";
import { Drawer } from "@/components/ui/Overlay";
import { EmptyState, PriorityChip, SkeletonRows, useNow, useWorkspaceData } from "@/components/ui/bits";
import SuggestionCard from "@/components/tasks/SuggestionCard";
import TaskCard from "@/components/tasks/TaskCard";
import { useWorkspace } from "@/components/shell/WorkspaceContext";
import styles from "./home.module.css";

export default function HomePage() {
  const { state, workspace } = useWorkspaceData();
  const { session, askQiko, openTaskForm } = useWorkspace();
  const [question, setQuestion] = useState("");
  const [openGroup, setOpenGroup] = useState<PriorityGroup["id"] | null>(null);
  const now = useNow();

  const priorities = useMemo(() => (workspace ? buildPriorities(workspace) : []), [workspace]);

  if (!state || !workspace) {
    return (
      <div className="page">
        <SkeletonRows rows={5} height={90} />
      </div>
    );
  }

  const counts = taskCounts(state.tasks);
  const totalTasks = counts.pending + counts.in_progress + counts.completed;
  const nextTasks = sortTasks(state.tasks.filter(isOpen)).slice(0, 4);
  const memberById = new Map(state.members.map((member) => [member.id, member]));
  const group = priorities.find((item) => item.id === openGroup);
  const recent = state.events.slice(0, 8);
  const week = (iso: string) => now - new Date(iso).getTime() <= 7 * 86_400_000;
  const salesAttention = workspace.suggestions.length + counts.overdue;

  const changes: { icon: IconName; tone: string; title: string; detail: string; href: string }[] = [];
  const newLeads = state.leads.filter((lead) => week(lead.createdAt));
  if (newLeads.length) changes.push({ icon: "userPlus", tone: "brand", title: `${plural(newLeads.length, "new lead")} this week`, detail: `${newLeads.filter((lead) => lead.source === "Qiko Signal").length} from Qiko Signal · ${newLeads.filter((lead) => lead.source === "Website").length} from the website`, href: "/sales/leads?sort=newest" });
  const recentScans = state.scans.filter((scan) => now - new Date(scan.completedAt).getTime() <= 3 * 86_400_000);
  if (recentScans.length) changes.push({ icon: "scan", tone: "sky", title: `${plural(recentScans.length, "free scan")} completed in 72h`, detail: `${recentScans.filter((scan) => scan.score < 60).length} scored below 60/100 — likely opportunities`, href: "/sales/leads?activity=scan" });
  const won = state.events.filter((event) => event.kind === "status_change" && event.title.endsWith("Won") && week(event.occurredAt));
  if (won.length) changes.push({ icon: "flag", tone: "green", title: `${plural(won.length, "deal")} won this week`, detail: won.map((event) => workspace.leadById.get(event.leadId)?.company ?? "").filter(Boolean).join(", "), href: "/sales/leads?status=Won" });
  if (counts.overdue) changes.push({ icon: "clock", tone: "red", title: `${plural(counts.overdue, "task")} overdue`, detail: "Clear these first to keep follow-ups on track", href: "/sales/actions?view=overdue" });

  const ask = (event: FormEvent) => {
    event.preventDefault();
    if (!question.trim()) return;
    askQiko(question.trim());
    setQuestion("");
  };

  return (
    <div className="page">
      <section className={styles.hero}>
        <div>
          <h1>
            {greeting(new Date(now))}, {firstName(session.name)}.
          </h1>
          <p className={styles.heroSub}>What can I help you with today?</p>
        </div>
        <span className={styles.date}>
          <Icon name="calendar" size={13} />
          {new Date(now).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
        </span>
      </section>

      <section className={styles.copilot}>
        <form onSubmit={ask} className={styles.askBox}>
          <span className={styles.askOrb}>
            <Icon name="sparkles" size={16} />
          </span>
          <input value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Ask Qiko anything about your business…" aria-label="Ask Qiko anything about your business" />
          <Button type="submit" size="small" iconRight="arrowRight" disabled={!question.trim()}>
            Ask
          </Button>
        </form>
        <div className={styles.prompts}>
          {SUGGESTED_QUESTIONS.slice(0, 4).map((item) => (
            <button type="button" key={item} onClick={() => askQiko(item)}>
              {item}
            </button>
          ))}
        </div>
      </section>

      <section>
        <div className={styles.sectionHead}>
          <div>
            <h2>Your top priorities</h2>
          </div>
          <Link href="/sales/actions" className="link-button">
            Open action workspace <Icon name="arrowRight" size={13} />
          </Link>
        </div>
        {priorities.length === 0 ? (
          <EmptyState icon="checkCircle" title="You're all caught up" actions={<Button variant="secondary" icon="plus" onClick={() => openTaskForm()}>Create a task</Button>}>
            No suggested follow-ups or overdue tasks right now. New sign-ups, scans and enquiries will appear here automatically.
          </EmptyState>
        ) : (
          <div className={styles.priorityGrid}>
            {priorities.map((item, index) => {
              const leadIds = [...new Set([...item.suggestions.map((suggestion) => suggestion.leadId), ...item.tasks.map((task) => task.leadId).filter((id): id is string => Boolean(id))])];
              return (
                <button type="button" key={item.id} className={styles.priority} onClick={() => setOpenGroup(item.id)} style={{ animationDelay: `${index * 70}ms` }}>
                  <span className={styles.priorityTop}>
                    <span className={styles.priorityNum}>{index + 1}</span>
                    <PriorityChip priority={item.priority} />
                  </span>
                  <span className={styles.priorityTitle}>{item.title}</span>
                  <span className={styles.prioritySummary}>{item.summary}</span>
                  <span className={styles.priorityFoot}>
                    <span className={styles.faces}>
                      {leadIds.slice(0, 4).map((id) => (
                        <span key={id} className="avatar avatar-sm" title={workspace.leadById.get(id)?.name}>
                          {initials(workspace.leadById.get(id)?.name)}
                        </span>
                      ))}
                      {leadIds.length > 4 && <span className={styles.more}>+{leadIds.length - 4}</span>}
                    </span>
                    <span className={styles.open}>
                      Review <Icon name="arrowRight" size={13} />
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </section>

      <section className={styles.twoCol}>
        <article className="card">
          <div className="card-head">
            <div>
              <h2>Tasks at a glance</h2>
            </div>
            <Button size="small" variant="secondary" icon="plus" onClick={() => openTaskForm()}>
              New task
            </Button>
          </div>
          <div className="card-body">
            <div className={styles.statusRow}>
              {([
                ["pending", "Pending", counts.pending],
                ["in_progress", "In progress", counts.in_progress],
                ["completed", "Completed", counts.completed],
              ] as const).map(([key, label, value]) => (
                <Link key={key} href={`/sales/actions?view=${key}`} className={styles.statusTile}>
                  <span className={`${styles.statusDot} ${styles[key]}`} />
                  <span>{label}</span>
                  <b className="tabular">{value}</b>
                </Link>
              ))}
            </div>
            <div className={styles.progress} aria-label={`${counts.completed} of ${totalTasks} tasks completed`}>
              <i className={styles.pending} style={{ width: `${(counts.pending / Math.max(1, totalTasks)) * 100}%` }} />
              <i className={styles.in_progress} style={{ width: `${(counts.in_progress / Math.max(1, totalTasks)) * 100}%` }} />
              <i className={styles.completed} style={{ width: `${(counts.completed / Math.max(1, totalTasks)) * 100}%` }} />
            </div>
            <p className={styles.progressNote}>
              {Math.round((counts.completed / Math.max(1, totalTasks)) * 100)}% complete{counts.overdue ? ` · ${counts.overdue} overdue` : ""}
            </p>
            <div className={styles.taskList}>
              {nextTasks.length ? (
                nextTasks.map((task) => <TaskCard key={task.id} task={task} owner={task.ownerId ? memberById.get(task.ownerId) : null} leadName={task.leadId ? workspace.leadById.get(task.leadId)?.name : null} />)
              ) : (
                <EmptyState icon="tasks" title="No open tasks">Accept a suggestion or create a task to get started.</EmptyState>
              )}
            </div>
          </div>
        </article>

        <article className="card">
          <div className="card-head">
            <div>
              <h2>Jump back in</h2>
            </div>
          </div>
          <div className={`card-body ${styles.workspaces}`}>
            <Link href="/sales" className={`${styles.workspace} ${styles.workspaceActive}`}>
              <span className={styles.workspaceIcon}>
                <Icon name="sales" size={18} />
              </span>
              <span className={styles.workspaceText}>
                <b>Sales</b>
                <small>
                  {state.leads.length} leads · {salesAttention} {salesAttention === 1 ? "item needs" : "items need"} attention
                </small>
              </span>
              <span className="chip chip-completed">Active</span>
              <Icon name="chevronRight" size={16} />
            </Link>
            {([
              ["Marketing", "megaphone", "Campaigns, acquisition channels and engagement"],
              ["Finance Ops", "wallet", "Revenue, payments and invoices"],
              ["Qiko Pulse", "pulse", "Proactive insights and recommendations"],
            ] as const).map(([label, icon, detail]) => (
              <div key={label} className={`${styles.workspace} ${styles.workspaceSoon}`} aria-disabled="true">
                <span className={styles.workspaceIcon}>
                  <Icon name={icon} size={18} />
                </span>
                <span className={styles.workspaceText}>
                  <b>{label}</b>
                  <small>{detail}</small>
                </span>
                <span className="chip">Soon</span>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className={styles.twoCol}>
        <article className="card">
          <div className="card-head">
            <div>
              <h2>Recent business activity</h2>
            </div>
            <Link href="/sales/leads" className="link-button">
              View all activity <Icon name="arrowRight" size={13} />
            </Link>
          </div>
          <ol className={styles.feed}>
            {recent.map((event) => {
              const lead = workspace.leadById.get(event.leadId);
              return (
                <li key={event.id}>
                  <span className={`${styles.feedIcon} ${styles[`kind_${event.kind}`] ?? ""}`}>
                    <Icon name={KIND_ICON[event.kind]} size={14} />
                  </span>
                  <div>
                    <p>
                      {lead ? <Link href={`/sales/leads/${lead.id}`}>{lead.name}</Link> : "Unknown lead"} <span className="muted">— {event.title.charAt(0).toLowerCase() + event.title.slice(1)}</span>
                    </p>
                    <small>
                      {event.source} · {timeAgo(event.occurredAt, now)}
                    </small>
                  </div>
                </li>
              );
            })}
          </ol>
        </article>

        <article className="card">
          <div className="card-head">
            <div>
              <h2>What changed</h2>
            </div>
          </div>
          <div className={`card-body ${styles.changes}`}>
            {changes.length === 0 ? (
              <EmptyState icon="info" title="Nothing new">No notable changes this week.</EmptyState>
            ) : (
              changes.map((change) => (
                <Link key={change.title} href={change.href} className={styles.change}>
                  <span className={`${styles.changeIcon} ${styles[`tone_${change.tone}`]}`}>
                    <Icon name={change.icon} size={15} />
                  </span>
                  <span>
                    <b>{change.title}</b>
                    <small>{change.detail}</small>
                  </span>
                  <Icon name="chevronRight" size={15} />
                </Link>
              ))
            )}
          </div>
        </article>
      </section>

      {group && (
        <Drawer
          kicker={`Priority · ${group.suggestions.length + group.tasks.length} items`}
          title={group.title}
          onClose={() => setOpenGroup(null)}
          width={600}
          footer={
            <>
              <Button variant="secondary" onClick={() => setOpenGroup(null)}>Close</Button>
              <Button
                icon="checkCircle"
                onClick={() => {
                  group.suggestions.forEach((suggestion) => crm.completeSuggestion(suggestion));
                  group.tasks.forEach((task) => crm.setTaskStatus(task.id, "completed"));
                  setOpenGroup(null);
                }}
              >
                Mark all completed
              </Button>
            </>
          }
        >
          <p className={styles.drawerIntro}>{group.summary} Review the evidence for each item, then accept it as a task, mark it done, or dismiss it.</p>
          <div className={styles.drawerList}>
            {group.suggestions.map((suggestion) => (
              <SuggestionCard key={suggestion.id} suggestion={suggestion} lead={workspace.leadById.get(suggestion.leadId)} defaultOpen={group.suggestions.length <= 2} />
            ))}
            {group.tasks.map((task) => (
              <TaskCard key={task.id} task={task} owner={task.ownerId ? memberById.get(task.ownerId) : null} leadName={task.leadId ? workspace.leadById.get(task.leadId)?.name : null} />
            ))}
          </div>
          <p className={styles.drawerNote}>
            <Icon name="info" size={13} /> Due {todayKey() === group.suggestions[0]?.suggestedDue ? "today" : "soon"} · Suggestions are generated from recorded activity and refresh as data changes.
          </p>
        </Drawer>
      )}
    </div>
  );
}
