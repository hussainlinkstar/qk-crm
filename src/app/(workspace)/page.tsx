"use client";

import Link from "next/link";
import { useMemo, useState, type FormEvent } from "react";
import { SUGGESTED_QUESTIONS } from "@/lib/copilot";
import { crm } from "@/lib/crm-store";
import { isOpen, sortTasks, taskCounts } from "@/lib/insights";
import {
  buildTessiantHomeActivity,
  buildTessiantHomePriorities,
  buildTessiantWhatChanged,
  homeBusinessSnapshot,
} from "@/lib/home-tessiant";
import { addDays, firstName, greeting, timeAgo } from "@/lib/format";
import Button from "@/components/ui/Button";
import Icon, { type IconName } from "@/components/ui/Icon";
import { EmptyState, PriorityChip, SkeletonRows, useNow, useWorkspaceData } from "@/components/ui/bits";
import { useWorkspace } from "@/components/shell/WorkspaceContext";
import styles from "./home.module.css";

function activityIcon(href: string, title: string): IconName {
  if (href.startsWith("/sales")) return "sales";
  if (href.includes("/placements")) return "calendar";
  if (href.includes("/associates")) return "users";
  if (href.includes("/requirements")) return "flag";
  if (/interview|meeting/i.test(title)) return "calendar";
  if (/task/i.test(title)) return "tasks";
  return "pulse";
}

export default function HomePage() {
  const { state, workspace } = useWorkspaceData();
  const { session, askQiko, openTaskForm, openTask, toast } = useWorkspace();
  const [question, setQuestion] = useState("");
  const [expandedActivity, setExpandedActivity] = useState<string | null>(null);
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
  const openTasks = sortTasks(state.tasks.filter(isOpen)).slice(0, 4);
  const totalTracked = Math.max(1, counts.pending + counts.in_progress + counts.completed);
  const donePct = Math.round((counts.completed / totalTracked) * 100);
  const priorityHrefs = new Set(priorities.map((item) => item.href));
  const feed = [
    ...changes.map((item) => ({
      id: item.id,
      title: item.title,
      detail: item.detail,
      href: item.href,
      at: null as string | null,
    })),
    ...activity
      .filter((item) => !priorityHrefs.has(item.href))
      .map((item) => ({
        id: item.id,
        title: item.title,
        detail: item.detail,
        href: item.href,
        at: item.at,
      })),
  ].slice(0, 6);

  const ask = (event: FormEvent) => {
    event.preventDefault();
    if (!question.trim()) return;
    askQiko(question.trim());
    setQuestion("");
  };

  return (
    <div className={`page ${styles.home}`}>
      <header className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className={styles.kicker}>Qiko Core</p>
          <h1>
            {greeting(new Date(now))}, {firstName(session.name)}
          </h1>
        </div>
        <span className={styles.date}>
          <Icon name="calendar" size={13} />
          {new Date(now).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}
        </span>
      </header>

      <section className={styles.copilot} aria-label="Ask Qiko">
        <form onSubmit={ask} className={styles.askBox}>
          <span className={styles.askOrb}>
            <Icon name="sparkles" size={15} />
          </span>
          <input
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="Ask about requirements, availability, assignments or sales…"
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

      <section className="metric-grid metric-grid-4" aria-label="Business snapshot">
        {snapshot.map((metric) => (
          <Link key={metric.key} href={metric.href} className="metric-card">
            <span className="metric-label">{metric.label}</span>
            <b key={metric.value} className="tabular kpi-value">
              {metric.value}
            </b>
          </Link>
        ))}
      </section>

      <section>
        <div className={styles.sectionHead}>
          <h2>Your priorities</h2>
          <Link href="/tasks" className="link-button">
            All tasks <Icon name="arrowRight" size={13} />
          </Link>
        </div>
        {priorities.length === 0 ? (
          <EmptyState
            icon="checkCircle"
            title="You're clear"
            actions={
              <Button variant="secondary" icon="plus" onClick={() => openTaskForm()}>
                New task
              </Button>
            }
          >
            No urgent sales or staffing actions right now.
          </EmptyState>
        ) : (
          <div className={styles.priorityStack}>
            {priorities.map((item, index) => (
              <Link key={item.id} href={item.href} className={styles.priorityCard} style={{ animationDelay: `${index * 45}ms` }}>
                <span className={styles.priorityTop}>
                  <PriorityChip priority={item.priority} />
                  <span className={styles.priorityAction}>
                    {item.actionLabel} <Icon name="arrowRight" size={13} />
                  </span>
                </span>
                <span className={styles.priorityTitle}>{item.title}</span>
                <span className={styles.prioritySummary}>{item.summary}</span>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className={styles.workGrid}>
        <article className={styles.panel}>
          <div className={styles.panelHead}>
            <div>
              <h2>My work</h2>
              <p className={styles.metaLine}>
                {counts.pending + counts.in_progress} open · {counts.completed} done
              </p>
            </div>
            <Button size="small" variant="secondary" icon="plus" onClick={() => openTaskForm()}>
              New
            </Button>
          </div>

          <div className={styles.progressTrack} aria-hidden="true">
            <i style={{ width: `${donePct}%` }} />
          </div>

          {openTasks.length === 0 ? (
            <EmptyState icon="tasks" title="Nothing open" />
          ) : (
            <ul className={styles.workList}>
              {openTasks.map((task) => {
                const lead = task.leadId ? workspace.leadById.get(task.leadId) : null;
                return (
                  <li key={task.id} className={styles.workItem}>
                    <button
                      type="button"
                      className={styles.workCheck}
                      aria-label={`Complete ${task.title}`}
                      onClick={() => {
                        crm.setTaskStatus(task.id, "completed");
                        toast("Task completed");
                      }}
                    />
                    <button type="button" className={styles.workMain} onClick={() => openTask(task.id)}>
                      <b>{task.title}</b>
                      <small>
                        <PriorityChip priority={task.priority} />
                        <span>{task.due ? `Due ${task.due}` : "No due date"}</span>
                        {lead ? <span>· {lead.name}</span> : null}
                      </small>
                    </button>
                    <div className={styles.workActions}>
                      <button
                        type="button"
                        className={styles.ghostAction}
                        onClick={() => {
                          crm.updateTask(task.id, { due: addDays(1) });
                          toast("Rescheduled to tomorrow");
                        }}
                      >
                        +1d
                      </button>
                      {lead ? (
                        <Link href={`/sales/leads/${lead.id}`} className={styles.ghostAction} onClick={(event) => event.stopPropagation()}>
                          Lead
                        </Link>
                      ) : (
                        <button type="button" className={styles.ghostAction} onClick={() => openTask(task.id)}>
                          Open
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </article>

        <aside className={styles.jumpPanel}>
          <div className={styles.panelHead}>
            <h2>Jump back in</h2>
          </div>
          <div className={styles.jumpList}>
            {(
              [
                ["/sales", "sales", "Sales", `${state.leads.length} leads`],
                [
                  "/staffing",
                  "users",
                  "Staffing",
                  state.tessiant
                    ? `${state.tessiant.requirements.filter((r) => !r.archived && r.outcome === "active" && r.stage !== "Placed").length} open reqs`
                    : "Talent & assignments",
                ],
                ["/pulse", "pulse", "Qiko Pulse", "Insights & actions"],
              ] as const
            ).map(([href, icon, label, detail]) => (
              <Link key={href} href={href} className={styles.jumpCard}>
                <span className={styles.jumpIcon}>
                  <Icon name={icon} size={16} />
                </span>
                <span>
                  <b>{label}</b>
                  <small>{detail}</small>
                </span>
                <Icon name="chevronRight" size={14} />
              </Link>
            ))}
          </div>
        </aside>
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHead}>
          <h2>Business activity</h2>
          <Link href="/staffing" className="link-button">
            Desk <Icon name="arrowRight" size={13} />
          </Link>
        </div>
        {feed.length === 0 ? (
          <EmptyState icon="info" title="No recent activity" />
        ) : (
          <ul className={styles.activityFeed}>
            {feed.map((item) => {
              const open = expandedActivity === item.id;
              return (
                <li key={item.id} className={styles.activityItem} data-open={open ? "true" : undefined}>
                  <button
                    type="button"
                    className={styles.activityToggle}
                    aria-expanded={open}
                    onClick={() => setExpandedActivity(open ? null : item.id)}
                  >
                    <span className={styles.activityIcon}>
                      <Icon name={activityIcon(item.href, item.title)} size={14} />
                    </span>
                    <span className={styles.activityCopy}>
                      <b>{item.title}</b>
                      <small className={open ? undefined : styles.clamp}>
                        {item.detail}
                        {item.at ? ` · ${timeAgo(item.at, now)}` : ""}
                      </small>
                    </span>
                    <Icon name="chevronRight" size={14} />
                  </button>
                  {open && (
                    <div className={styles.activityExpand}>
                      <Link href={item.href} className="link-button">
                        Open record <Icon name="arrowRight" size={13} />
                      </Link>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
