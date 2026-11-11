"use client";

import Link from "next/link";
import { useMemo, useState, type FormEvent } from "react";
import { crm } from "@/lib/crm-store";
import { isOpen, sortTasks } from "@/lib/insights";
import { buildTessiantHomePriorities } from "@/lib/home-tessiant";
import { firstName, greeting } from "@/lib/format";
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

  const openTasks = sortTasks(state.tasks.filter(isOpen)).slice(0, 5);

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

      <section className={styles.panel}>
        <div className={styles.panelHead}>
          <div>
            <h2>My work</h2>
            <p className={styles.metaLine}>Open checklist — full board is My Tasks</p>
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
                      <span>{task.due ? `Due ${task.due}` : "No due date"}</span>
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
            All tasks <Icon name="arrowRight" size={13} />
          </Link>
        </div>
      </section>
    </div>
  );
}
