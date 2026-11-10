"use client";

import Link from "next/link";
import { useMemo, useState, type FormEvent } from "react";
import { SUGGESTED_QUESTIONS } from "@/lib/copilot";
import { isOpen, salesAttentionCount, sortTasks, taskCounts } from "@/lib/insights";
import {
  buildTessiantHomeActivity,
  buildTessiantHomePriorities,
  buildTessiantWhatChanged,
  homeBusinessSnapshot,
} from "@/lib/home-tessiant";
import { firstName, greeting, timeAgo } from "@/lib/format";
import Button from "@/components/ui/Button";
import Icon, { type IconName } from "@/components/ui/Icon";
import { EmptyState, PriorityChip, SkeletonRows, useNow, useWorkspaceData } from "@/components/ui/bits";
import TaskCard from "@/components/tasks/TaskCard";
import { useWorkspace } from "@/components/shell/WorkspaceContext";
import styles from "./home.module.css";

export default function HomePage() {
  const { state, workspace } = useWorkspaceData();
  const { session, askQiko, openTaskForm } = useWorkspace();
  const [question, setQuestion] = useState("");
  const now = useNow();

  const priorities = useMemo(
    () => (state && workspace ? buildTessiantHomePriorities(state, workspace, now || Date.now()) : []),
    [state, workspace, now],
  );
  const snapshot = useMemo(() => (state ? homeBusinessSnapshot(state) : []), [state]);
  const activity = useMemo(() => (state ? buildTessiantHomeActivity(state) : []), [state]);
  const changes = useMemo(
    () => (state ? buildTessiantWhatChanged(state, now || Date.now(), priorities) : []),
    [state, now, priorities],
  );

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
  const salesAttention = salesAttentionCount(workspace);

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
          <p className={styles.heroSub}>What needs attention across sales and staffing today?</p>
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
          <input
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="Ask Qiko about requirements, availability, assignments or sales…"
            aria-label="Ask Qiko"
          />
          <Button type="submit" size="small" iconRight="arrowRight" disabled={!question.trim()}>
            Ask
          </Button>
        </form>
        <div className={styles.prompts}>
          {SUGGESTED_QUESTIONS.map((item) => (
            <button type="button" key={item} onClick={() => askQiko(item)}>
              {item}
            </button>
          ))}
        </div>
      </section>

      <section className={styles.snapshotRow} aria-label="Business snapshot">
        {snapshot.map((metric) => (
          <Link key={metric.key} href={metric.href} className={styles.snapshotCard}>
            <span>{metric.label}</span>
            <b className="tabular">{metric.value}</b>
          </Link>
        ))}
      </section>

      <section>
        <div className={styles.sectionHead}>
          <div>
            <h2>Your top priorities</h2>
          </div>
          <Link href="/tasks" className="link-button">
            Open action workspace <Icon name="arrowRight" size={13} />
          </Link>
        </div>
        {priorities.length === 0 ? (
          <EmptyState icon="checkCircle" title="You're all caught up" actions={<Button variant="secondary" icon="plus" onClick={() => openTaskForm()}>Create a task</Button>}>
            No urgent staffing or sales follow-ups right now.
          </EmptyState>
        ) : (
          <div className={styles.priorityGrid}>
            {priorities.map((item, index) => (
              <Link key={item.id} href={item.href} className={styles.priority} style={{ animationDelay: `${index * 70}ms` }}>
                <span className={styles.priorityTop}>
                  <span className={styles.priorityNum}>{index + 1}</span>
                  <PriorityChip priority={item.priority} />
                  {item.source === "pulse" && <span className="chip chip-ai">Pulse</span>}
                </span>
                <span className={styles.priorityTitle}>{item.title}</span>
                <span className={styles.prioritySummary}>{item.summary}</span>
                <span className={styles.priorityFoot}>
                  <span className={styles.open}>
                    {item.actionLabel} <Icon name="arrowRight" size={13} />
                  </span>
                </span>
              </Link>
            ))}
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
              {(
                [
                  ["pending", "Pending", counts.pending],
                  ["in_progress", "In Progress", counts.in_progress],
                  ["completed", "Completed", counts.completed],
                  ["overdue", "Overdue", counts.overdue],
                ] as const
              ).map(([key, label, value]) => (
                <Link key={key} href={`/tasks?view=${key}`} className={styles.statusTile}>
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
            <div className={styles.taskList}>
              {nextTasks.length ? (
                nextTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    owner={task.ownerId ? memberById.get(task.ownerId) : null}
                    leadName={task.leadId ? workspace.leadById.get(task.leadId)?.name : null}
                  />
                ))
              ) : (
                <EmptyState icon="tasks" title="No open tasks">
                  Create a task or accept a Pulse recommendation.
                </EmptyState>
              )}
            </div>
          </div>
        </article>

        <article className="card">
          <div className="card-head">
            <h2>Jump back in</h2>
          </div>
          <div className={`card-body ${styles.workspaces}`}>
            <Link href="/sales" className={`${styles.workspace} ${styles.workspaceActive}`}>
              <span className={styles.workspaceIcon}>
                <Icon name="sales" size={18} />
              </span>
              <span className={styles.workspaceText}>
                <b>Sales</b>
                <small>
                  {state.leads.length} leads · {salesAttention} need attention
                </small>
              </span>
              <span className="chip chip-completed">Active</span>
              <Icon name="chevronRight" size={16} />
            </Link>
            <Link href="/staffing" className={`${styles.workspace} ${styles.workspaceActive}`}>
              <span className={styles.workspaceIcon}>
                <Icon name="users" size={18} />
              </span>
              <span className={styles.workspaceText}>
                <b>Staffing</b>
                <small>
                  {state.tessiant
                    ? `${state.tessiant.requirements.filter((r) => !r.archived && r.outcome === "active" && r.stage !== "Placed").length} open requirements`
                    : "Talent, requirements and assignments"}
                </small>
              </span>
              <span className="chip chip-completed">Active</span>
              <Icon name="chevronRight" size={16} />
            </Link>
            <Link href="/pulse" className={`${styles.workspace} ${styles.workspaceActive}`}>
              <span className={styles.workspaceIcon}>
                <Icon name="pulse" size={18} />
              </span>
              <span className={styles.workspaceText}>
                <b>Qiko Pulse</b>
                <small>Insights, actions and value</small>
              </span>
              <span className="chip chip-completed">Active</span>
              <Icon name="chevronRight" size={16} />
            </Link>
            {(
              [
                ["Marketing", "megaphone", "Campaigns and acquisition"],
                ["Finance Ops", "wallet", "Revenue and invoices"],
              ] as const
            ).map(([label, icon, detail]) => (
              <div key={label} className={`${styles.workspace} ${styles.workspaceSoon}`} aria-disabled="true">
                <span className={styles.workspaceIcon}>
                  <Icon name={icon as IconName} size={18} />
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
            <Link href="/staffing" className="link-button">
              Staffing desk <Icon name="arrowRight" size={13} />
            </Link>
          </div>
          {activity.length === 0 ? (
            <div className="card-body">
              <EmptyState icon="info" title="No recent activity" />
            </div>
          ) : (
            <ol className={styles.feed}>
              {activity.map((event) => (
                <li key={event.id}>
                  <span className={styles.feedIcon}>
                    <Icon name="tasks" size={14} />
                  </span>
                  <div>
                    <p>
                      <Link href={event.href}>{event.title}</Link>
                      {event.detail ? <span className="muted"> — {event.detail}</span> : null}
                    </p>
                    <small>{timeAgo(event.at, now)}</small>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </article>

        <article className="card">
          <div className="card-head">
            <h2>What changed</h2>
          </div>
          <div className={`card-body ${styles.changes}`}>
            {changes.length === 0 ? (
              <EmptyState icon="info" title="Nothing new">
                No notable Tessiant changes this week.
              </EmptyState>
            ) : (
              changes.map((change) => (
                <Link key={change.id} href={change.href} className={styles.change}>
                  <span className={`${styles.changeIcon} ${styles.tone_brand}`}>
                    <Icon name="flag" size={15} />
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
    </div>
  );
}
