"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { SkeletonRows, useWorkspaceData } from "@/components/ui/bits";
import { useWorkspace } from "@/components/shell/WorkspaceContext";
import AskPulseChat from "@/components/pulse/AskPulseChat";
import PulseShell from "@/components/pulse/PulseShell";
import PulseSubnav from "@/components/pulse/PulseSubnav";
import { crm } from "@/lib/crm-store";
import { formatDate } from "@/lib/format";
import { getPulseSnapshot } from "@/lib/pulse-adapter";
import { insightIdFromTask } from "@/lib/pulse-journey";
import { generateTessiantInsights } from "@/lib/tessiant-pulse-rules";
import type { Task, TaskStatus } from "@/lib/types";
import styles from "../pulse.module.css";

const LANES: Array<{
  id: "backlog" | "doing" | "done";
  status: TaskStatus;
  title: string;
  color: string;
  hint: string;
  emptyTitle: string;
  emptyHint: string;
}> = [
  {
    id: "backlog",
    status: "pending",
    title: "Backlog",
    color: "#94a3b8",
    hint: "Accepted, not started",
    emptyTitle: "Nothing waiting",
    emptyHint: "Accept an insight on Pulse, or add a task.",
  },
  {
    id: "doing",
    status: "in_progress",
    title: "In progress",
    color: "#4f46e5",
    hint: "Someone is on it",
    emptyTitle: "Nobody is on it",
    emptyHint: "Start a backlog card to begin.",
  },
  {
    id: "done",
    status: "completed",
    title: "Done",
    color: "#10b981",
    hint: "Measured from completion",
    emptyTitle: "Nothing measured yet",
    emptyHint: "Complete a card and Value starts here.",
  },
];

function isPulseTask(task: Task) {
  return task.description.includes("[pulse-insight:") || task.description.includes("[pulse-board]");
}

export default function PulseActionsPage() {
  const { state } = useWorkspaceData();
  const { toast, openTask } = useWorkspace();
  const [draft, setDraft] = useState("");
  const [measuringId, setMeasuringId] = useState<string | null>(null);
  const [result, setResult] = useState("");

  const snapshot = useMemo(() => (state ? getPulseSnapshot(state) : null), [state]);
  const insights = useMemo(() => (state ? generateTessiantInsights(state) : []), [state]);
  const pulseTasks = useMemo(() => {
    if (!state) return [];
    return state.tasks.filter((task) => isPulseTask(task) && task.status !== "dismissed");
  }, [state]);

  if (!state || !snapshot) {
    return (
      <PulseShell>
        <div className={styles.pulsePageExact}>
          <SkeletonRows rows={4} height={90} />
        </div>
      </PulseShell>
    );
  }

  const addTask = () => {
    const title = draft.trim();
    if (!title) return;
    crm.createTask({
      title,
      description: "[pulse-board]\nAdded from the Pulse to-do board.",
      priority: "medium",
      due: null,
      ownerId: "me",
      leadId: null,
      status: "pending",
    });
    setDraft("");
    toast("Added to backlog");
  };

  const start = (taskId: string) => {
    crm.setTaskStatus(taskId, "in_progress");
    toast("Moved to in progress");
  };

  const saveMeasurement = (task: Task) => {
    const text = result.trim();
    if (!text) {
      toast("Record what you did before completing", "info");
      return;
    }
    const insightId = insightIdFromTask(task.description);
    const insight = insights.find((item) => item.id === insightId);
    if (insightId) {
      crm.recordPulseOutcome({
        insightId,
        taskId: task.id,
        status: "completed",
        summary: text,
        realisedRevenue: null,
        pipelinePotential: null,
        estimatedTimeSavedHours: null,
        qualitativeBenefit: null,
        sourceEntityIds: insight?.evidence.map((entry) => entry.entityId) ?? [],
      });
      toast("Operational result recorded — commercial value not assumed");
    } else {
      crm.updateTask(task.id, {
        status: "completed",
        description: `${task.description}\nResult: ${text}`,
      });
      toast("Task completed");
    }
    setMeasuringId(null);
    setResult("");
  };

  return (
    <PulseShell>
      <div className={styles.pulsePageExact} data-view="todo">
        <header className={styles.pulseHeadExact}>
          <div className={styles.pulseHeadCopyExact}>
            <h1>To-do</h1>
            <p>Add a task, move it to done, and the measured outcome is written back as a confirmed learning.</p>
          </div>
          <div className={styles.pulseHeadToolsExact}>
            <AskPulseChat state={state} realised={snapshot.financials.realised} />
          </div>
        </header>

        <PulseSubnav />

        <form
          className={`${styles.cardExact} ${styles.todoComposer}`}
          onSubmit={(event) => {
            event.preventDefault();
            addTask();
          }}
        >
          <label htmlFor="pulse-todo-title">New task</label>
          <input
            id="pulse-todo-title"
            className="input"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="What should be done?"
          />
          <button type="submit" className={styles.btnPulsePrimary} disabled={!draft.trim()}>
            Add to backlog
          </button>
        </form>

        <div className={styles.kanban}>
          {LANES.map((lane) => {
            const items = pulseTasks.filter((task) => task.status === lane.status);
            return (
              <section key={lane.id} className={styles.kanbanCol} aria-label={lane.title}>
                <div className={styles.kanbanHead}>
                  <div>
                    <p className={styles.kanbanKicker}>{lane.title}</p>
                    <p className={styles.kanbanHint}>{lane.hint}</p>
                  </div>
                  <span className={styles.kanbanCount}>{items.length}</span>
                </div>
                <div className={styles.kanbanBody}>
                  {items.length === 0 ? (
                    <div className={styles.kanbanEmpty}>
                      <b>{lane.emptyTitle}</b>
                      <span>{lane.emptyHint}</span>
                    </div>
                  ) : (
                    items.map((task) => {
                      const insightId = insightIdFromTask(task.description);
                      const insight = insights.find((item) => item.id === insightId);
                      const outcome = state.tessiant?.pulse?.outcomes.find((item) => item.insightId === insightId);
                      const owner = state.members.find((member) => member.id === task.ownerId)?.name ?? "You";
                      const when = task.status === "completed" ? task.completedAt ?? task.due : task.due;
                      const measuring = measuringId === task.id && lane.id !== "done";
                      return (
                        <article key={task.id} className={styles.kanbanCard}>
                          <p className={styles.kanbanId}>
                            <i className={styles.kanbanDot} style={{ background: lane.color }} />
                            Action
                          </p>
                          <button type="button" className={styles.kanbanTitle} onClick={() => openTask(task.id)}>
                            {task.title}
                          </button>
                          {insight || outcome?.summary ? (
                            <div className={styles.kanbanChips}>
                              {insight ? <span className={styles.kanbanChip}>{insight.title}</span> : null}
                              {outcome?.summary ? (
                                <span className={`${styles.kanbanChip} ${styles.kanbanChipResult}`}>{outcome.summary}</span>
                              ) : null}
                            </div>
                          ) : null}
                          <div className={styles.kanbanFoot}>
                            <span className={styles.kanbanAvatar} title={owner}>
                              {owner.slice(0, 1).toUpperCase()}
                            </span>
                            {when ? <span className={styles.kanbanDate}>{formatDate(when)}</span> : null}
                            {lane.id === "backlog" ? (
                              <button type="button" className={styles.kanbanGo} onClick={() => start(task.id)}>
                                Start
                              </button>
                            ) : null}
                            {lane.id === "doing" ? (
                              <button
                                type="button"
                                className={styles.kanbanGo}
                                onClick={() => {
                                  setMeasuringId(measuring ? null : task.id);
                                  setResult("");
                                }}
                              >
                                Complete
                              </button>
                            ) : null}
                            {lane.id === "done" ? (
                              <Link href="/pulse/value" className={styles.kanbanGo}>
                                Open Value
                              </Link>
                            ) : null}
                          </div>
                          {measuring ? (
                            <div className={styles.todoMeasure}>
                              <p>What changed after this was done?</p>
                              <input
                                className="input"
                                value={result}
                                onChange={(event) => setResult(event.target.value)}
                                placeholder="Measured result"
                                aria-label={`Measured result for ${task.title}`}
                              />
                              <p style={{ fontWeight: 500, color: "#64748b" }}>
                                Saving records the operational result. It does not assume pipeline or revenue.
                              </p>
                              <div className={styles.todoMeasureActions}>
                                <button type="button" className={styles.btnPulsePrimary} style={{ flex: 1 }} onClick={() => saveMeasurement(task)}>
                                  Save measurement
                                </button>
                                <button
                                  type="button"
                                  className={styles.btnPulseSecondary}
                                  onClick={() => {
                                    setMeasuringId(null);
                                    setResult("");
                                  }}
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : null}
                        </article>
                      );
                    })
                  )}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </PulseShell>
  );
}
