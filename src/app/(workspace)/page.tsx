"use client";

import Link from "next/link";
import { useMemo, useState, type FormEvent } from "react";
import { crm } from "@/lib/crm-store";
import { isOpen, sortTasks } from "@/lib/insights";
import { buildTessiantHomeActivity, buildTessiantHomePriorities } from "@/lib/home-tessiant";
import { activeAssignments } from "@/lib/tessiant-insights";
import { firstName, formatDate, greeting, timeAgo } from "@/lib/format";
import Button from "@/components/ui/Button";
import Icon from "@/components/ui/Icon";
import { EmptyState, PriorityChip, SkeletonRows, useNow, useWorkspaceData } from "@/components/ui/bits";
import { useWorkspace } from "@/components/shell/WorkspaceContext";
import styles from "./home.module.css";

export default function HomePage() {
  const { state, workspace } = useWorkspaceData();
  const { session, askQiko, openTaskForm, openTask, toast } = useWorkspace();
  const [question, setQuestion] = useState("");
  const now = useNow();

  const priorities = useMemo(
    () => (state && workspace ? buildTessiantHomePriorities(state, workspace, now || Date.now()) : []),
    [state, workspace, now],
  );

  if (!state || !workspace) {
    return (
      <div className="page">
        <SkeletonRows rows={5} height={90} />
      </div>
    );
  }

  const openTasks = sortTasks(state.tasks.filter(isOpen)).slice(0, 4);
  const activity = buildTessiantHomeActivity(state).slice(0, 5);
  const openOpps = (state.opportunities ?? []).filter((item) => item.stage !== "Closed Won" && item.stage !== "Closed Lost").length;
  const placements = activeAssignments(state).length;
  const available =
    state.tessiant?.associates.filter((item) => item.status === "active" && item.availability === "available" && item.verifiedAt).length ?? 0;
  const pulse = [
    { label: "Opportunities", value: openOpps, href: "/sales/pipeline" },
    { label: "Active placements", value: placements, href: "/staffing/placements?view=active" },
    { label: "Available now", value: available, href: "/staffing/associates?view=available_now" },
    { label: "Priorities", value: priorities.length, href: "#attention" },
  ];

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
      </section>

      <section className={styles.pulseRow} aria-label="Business pulse">
        {pulse.map((item) => (
          <Link key={item.label} href={item.href} className={styles.pulseStat}>
            <span>{item.label}</span>
            <b className="tabular">{item.value}</b>
          </Link>
        ))}
      </section>

      <section id="attention">
        <div className={styles.sectionHead}>
          <h2>What needs attention?</h2>
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
            {priorities.map((item) => (
              <Link key={item.id} href={item.href} className={styles.priorityCard}>
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

      <div className={styles.desk}>
      <section className={styles.panel}>
        <div className={styles.panelHead}>
          <div>
            <h2>My tasks</h2>
          </div>
          <Button size="small" variant="secondary" icon="plus" onClick={() => openTaskForm()}>
            New
          </Button>
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
                      <span>{task.due ? `Due ${formatDate(task.due)}` : "No due date"}</span>
                      {lead ? <span>· {lead.name}</span> : null}
                    </small>
                  </button>
                  <div className={styles.workActions}>
                    <button type="button" className={styles.ghostAction} onClick={() => openTask(task.id)}>
                      Open
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <div className={styles.panelHead} style={{ marginTop: 12, paddingBottom: 0 }}>
          <Link href="/tasks" className="link-button">
            Open board <Icon name="arrowRight" size={13} />
          </Link>
        </div>
      </section>

      <section className={styles.panel} aria-label="Recent activity">
        <div className={styles.panelHead}>
          <h2>Recent activity</h2>
        </div>
        {activity.length === 0 ? (
          <EmptyState icon="clock" title="No recent activity" />
        ) : (
          <ul className={styles.timeline}>
            {activity.map((item) => (
              <li key={item.id}>
                <span className={styles.dot} aria-hidden="true" />
                <Link href={item.href}>
                  <b>{item.title}</b>
                  <span>
                    {item.detail} · {timeAgo(item.at)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
      </div>

      <p className={styles.disclosure}>This workspace uses fictional demonstration data.</p>
    </div>
  );
}
