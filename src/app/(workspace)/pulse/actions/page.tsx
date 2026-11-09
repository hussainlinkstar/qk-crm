"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import Button from "@/components/ui/Button";
import { EmptyState, PriorityChip, SkeletonRows, TaskStatusChip, useWorkspaceData } from "@/components/ui/bits";
import { useWorkspace } from "@/components/shell/WorkspaceContext";
import { crm } from "@/lib/crm-store";
import { formatDate } from "@/lib/format";
import { generateTessiantInsights } from "@/lib/tessiant-pulse-rules";
import styles from "../pulse.module.css";

function insightIdFromTask(description: string) {
  const match = description.match(/\[pulse-insight:([^\]]+)\]/);
  return match?.[1] ?? null;
}

export default function PulseActionsPage() {
  const { state } = useWorkspaceData();
  const { toast, openTask } = useWorkspace();
  const [summary, setSummary] = useState<Record<string, string>>({});

  const pulseTasks = useMemo(() => {
    if (!state) return [];
    return state.tasks.filter((task) => task.description.includes("[pulse-insight:"));
  }, [state]);

  const insights = useMemo(() => (state ? generateTessiantInsights(state) : []), [state]);

  if (!state) {
    return (
      <div className="page">
        <SkeletonRows rows={4} height={70} />
      </div>
    );
  }

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <div className={styles.context}>
            <span className="chip chip-ai">Qiko Pulse</span>
            <span className="chip">To-do / actions</span>
          </div>
          <h1>Accepted insight actions</h1>
          <p className="subtitle">Accept creates a CRM task linked to insightId. Completing records an outcome without inventing revenue.</p>
        </div>
        <div className="page-actions">
          <Link href="/sales/actions">
            <Button variant="secondary" icon="tasks">
              Full action workspace
            </Button>
          </Link>
        </div>
      </header>

      <div className={styles.note}>
        Completing an action can attribute estimated time saved and optional pipeline potential. Realised revenue only when you explicitly record a confirmed placement-backed amount — and the same insight cannot double-count.
      </div>

      <section className="card">
        <div className="card-body">
          {pulseTasks.length === 0 ? (
            <EmptyState title="No Pulse tasks yet" icon="tasks">
              Accept an insight from the cockpit or Insights page to create one.
            </EmptyState>
          ) : (
            <div>
              {pulseTasks.map((task) => {
                const insightId = insightIdFromTask(task.description);
                const insight = insights.find((item) => item.id === insightId);
                const outcome = state.tessiant?.pulse?.outcomes.find((item) => item.insightId === insightId);
                return (
                  <article key={task.id} className={styles.insight}>
                    <div className={styles.insightHead}>
                      <PriorityChip priority={task.priority} />
                      <TaskStatusChip status={task.status} />
                      {insight && <span className="chip">{insight.ruleId}</span>}
                    </div>
                    <b>{task.title}</b>
                    <p className="muted">{task.description}</p>
                    <p className="muted">
                      Due {task.due ? formatDate(task.due) : "—"} · owner {state.members.find((m) => m.id === task.ownerId)?.name ?? "—"}
                    </p>
                    <div className={styles.actions}>
                      <Button size="small" variant="secondary" onClick={() => openTask(task.id)}>
                        Open task
                      </Button>
                      {task.status !== "completed" && (
                        <Button
                          size="small"
                          icon="check"
                          onClick={() => {
                            const text = summary[task.id]?.trim() || "DEMO action completed from Pulse";
                            crm.recordPulseOutcome({
                              insightId: insightId ?? `orphan_${task.id}`,
                              taskId: task.id,
                              status: "completed",
                              summary: text,
                              realisedRevenue: null,
                              pipelinePotential: insight?.ruleId === "possible_cross_sell" ? 2500 : null,
                              estimatedTimeSavedHours: 1.5,
                              qualitativeBenefit: "Resource manager follow-up completed in demo",
                              sourceEntityIds: insight?.evidence.map((e) => e.entityId) ?? [],
                            });
                            toast("Outcome recorded — value categories kept separate");
                          }}
                        >
                          Complete + record outcome
                        </Button>
                      )}
                      <input
                        className="input"
                        style={{ minWidth: 220 }}
                        placeholder="Outcome summary"
                        value={summary[task.id] ?? ""}
                        onChange={(e) => setSummary({ ...summary, [task.id]: e.target.value })}
                        aria-label={`Outcome summary for ${task.title}`}
                      />
                    </div>
                    {outcome && (
                      <p className="muted">
                        Outcome {outcome.status}: {outcome.summary}
                        {outcome.value.pipelinePotential != null ? ` · pipeline £${outcome.value.pipelinePotential}` : ""}
                        {outcome.value.estimatedTimeSavedHours != null ? ` · ~${outcome.value.estimatedTimeSavedHours}h saved (estimate)` : ""}
                      </p>
                    )}
                    {insight && (
                      <Link href="/pulse/insights" className="text-link">
                        View insight
                      </Link>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
