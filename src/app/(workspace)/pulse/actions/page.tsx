"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import Button from "@/components/ui/Button";
import { EmptyState, PriorityChip, SkeletonRows, TaskStatusChip, useWorkspaceData } from "@/components/ui/bits";
import { useWorkspace } from "@/components/shell/WorkspaceContext";
import { crm } from "@/lib/crm-store";
import { formatDate } from "@/lib/format";
import PulseSubnav from "@/components/pulse/PulseSubnav";
import { insightIdFromTask, requirementIdFromTask } from "@/lib/pulse-journey";
import { generateTessiantInsights } from "@/lib/tessiant-pulse-rules";
import type { InsightEvidence, TessiantInsight } from "@/lib/tessiant-pulse-types";
import styles from "../pulse.module.css";

function entityLinks(insight: TessiantInsight | undefined, requirementId: string | null) {
  const links: { label: string; href: string }[] = [];
  const seen = new Set<string>();
  const push = (label: string, href: string) => {
    if (seen.has(href)) return;
    seen.add(href);
    links.push({ label, href });
  };

  if (requirementId) push("Requirement", `/staffing/requirements/${requirementId}`);

  const pick = (type: InsightEvidence["entityType"], label: string) => {
    const item = insight?.evidence.find((entry) => entry.entityType === type && entry.href);
    if (item?.href) push(label, item.href);
  };

  pick("requirement", "Requirement");
  pick("associate", "Associate");
  pick("placement", "Assignment");
  pick("account", "Account");
  pick("candidate", "Candidate");
  pick("lead", "Lead");
  pick("opportunity", "Opportunity");

  return links;
}

export default function PulseActionsPage() {
  const { state } = useWorkspaceData();
  const { toast, openTask } = useWorkspace();
  const [summary, setSummary] = useState<Record<string, string>>({});

  const pulseTasks = useMemo(() => {
    if (!state) return [];
    return state.tasks
      .filter((task) => task.description.includes("[pulse-insight:"))
      .slice()
      .sort((a, b) => {
        const rank: Record<string, number> = { pending: 0, in_progress: 1, completed: 2, dismissed: 3 };
        return (rank[a.status] ?? 9) - (rank[b.status] ?? 9) || (a.due ?? "").localeCompare(b.due ?? "");
      });
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
            <span className="chip">To-dos</span>
          </div>
          <h1>Pulse to-dos</h1>
          <p className="subtitle">Tasks created from accepted insights — complete the action, then record value separately if evidence exists.</p>
        </div>
        <div className="page-actions">
          <Link href="/pulse/insights">
            <Button variant="secondary" icon="sparkles">
              Insights
            </Button>
          </Link>
          <Link href="/sales/actions">
            <Button variant="secondary" icon="tasks">
              All actions
            </Button>
          </Link>
        </div>
      </header>

      <PulseSubnav />

      <section className="card">
        <div className="card-body">
          {pulseTasks.length === 0 ? (
            <EmptyState title="No Pulse tasks yet" icon="tasks">
              Accept an insight to create a linked to-do.
            </EmptyState>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Task</th>
                    <th>Related insight</th>
                    <th>Status</th>
                    <th>Owner</th>
                    <th>Due</th>
                    <th>Linked</th>
                    <th>Outcome</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pulseTasks.map((task) => {
                    const insightId = insightIdFromTask(task.description);
                    const insight = insights.find((item) => item.id === insightId);
                    const requirementId = requirementIdFromTask(task.description);
                    const links = entityLinks(insight, requirementId);
                    const outcome = state.tessiant?.pulse?.outcomes.find((item) => item.insightId === insightId);
                    const owner = state.members.find((m) => m.id === task.ownerId)?.name ?? "—";

                    return (
                      <tr key={task.id}>
                        <td>
                          <div className={styles.todoTitle}>
                            <PriorityChip priority={task.priority} />
                            <div>
                              <b>{task.title}</b>
                            </div>
                          </div>
                        </td>
                        <td>
                          {insight ? (
                            <Link href="/pulse/insights" className="text-link">
                              {insight.title}
                            </Link>
                          ) : (
                            <span className="muted">Linked Pulse insight</span>
                          )}
                        </td>
                        <td>
                          <TaskStatusChip status={task.status} />
                        </td>
                        <td>{owner}</td>
                        <td className="tabular">{task.due ? formatDate(task.due) : "—"}</td>
                        <td>
                          {links.length === 0 ? (
                            <span className="muted">—</span>
                          ) : (
                            <div className={styles.linkStack}>
                              {links.map((link) => (
                                <Link key={link.href} href={link.href} className="text-link">
                                  {link.label}
                                </Link>
                              ))}
                            </div>
                          )}
                        </td>
                        <td>
                          {outcome ? (
                            <span>
                              {outcome.summary}
                              {outcome.value.pipelinePotential != null
                                ? ` · pipeline £${outcome.value.pipelinePotential.toLocaleString("en-GB")}`
                                : ""}
                              {outcome.value.estimatedTimeSavedHours != null
                                ? ` · ~${outcome.value.estimatedTimeSavedHours}h`
                                : ""}
                            </span>
                          ) : (
                            <span className="muted">Pending confirmation</span>
                          )}
                        </td>
                        <td>
                          <div className={styles.actions}>
                            <Button size="small" variant="secondary" onClick={() => openTask(task.id)}>
                              Open
                            </Button>
                            <Link href="/tasks" className="text-link">
                              My Tasks
                            </Link>
                            {task.status !== "completed" && task.status !== "dismissed" && (
                              <Button
                                size="small"
                                icon="check"
                                onClick={() => {
                                  const text = summary[task.id]?.trim();
                                  if (!text) {
                                    toast("Record what you did before completing", "info");
                                    return;
                                  }
                                  crm.recordPulseOutcome({
                                    insightId: insightId ?? `orphan_${task.id}`,
                                    taskId: task.id,
                                    status: "completed",
                                    summary: text,
                                    realisedRevenue: null,
                                    pipelinePotential: null,
                                    estimatedTimeSavedHours: null,
                                    qualitativeBenefit: null,
                                    sourceEntityIds: insight?.evidence.map((e) => e.entityId) ?? [],
                                  });
                                  toast("Operational result recorded — commercial value not assumed");
                                }}
                              >
                                Complete
                              </Button>
                            )}
                            {outcome?.status === "completed" ? (
                              <Link href="/pulse/value" className="text-link">
                                Record value
                              </Link>
                            ) : null}
                          </div>
                          {task.status !== "completed" && (
                            <input
                              className="input"
                              style={{ marginTop: 8, minWidth: 180 }}
                              placeholder="Outcome summary"
                              value={summary[task.id] ?? ""}
                              onChange={(e) => setSummary({ ...summary, [task.id]: e.target.value })}
                              aria-label={`Outcome summary for ${task.title}`}
                            />
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
