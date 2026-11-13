"use client";

import Link from "next/link";
import { useMemo, useState, type FormEvent } from "react";
import { crm } from "@/lib/crm-store";
import { isOpen, sortTasks } from "@/lib/insights";
import {
  buildTessiantHomePriorities,
  buildTessiantWhatChanged,
  homeLede,
  homeOutcomes,
  type HomePriorityCard,
} from "@/lib/home-tessiant";
import { generateTessiantInsights } from "@/lib/tessiant-pulse-rules";
import { expectedBenefit, knowledgeBlockTitle } from "@/lib/pulse-presentation";
import { SUGGESTED_QUESTIONS } from "@/lib/copilot";
import CountUp from "@/components/ui/CountUp";
import { firstName, formatDate, greeting, todayKey } from "@/lib/format";
import Button from "@/components/ui/Button";
import Icon from "@/components/ui/Icon";
import Spark from "@/components/ui/Spark";
import IconTile, { type IconTone } from "@/components/ui/IconTile";
import type { IconName } from "@/components/ui/Icon";
import { EmptyState, PriorityChip, SkeletonRows, useNow, useWorkspaceData } from "@/components/ui/bits";
import { useWorkspace } from "@/components/shell/WorkspaceContext";
import FeedbackThumbs from "@/components/ui/FeedbackThumbs";
import QikoTrackRecord from "@/components/home/QikoTrackRecord";
import AutomationInbox from "@/components/home/AutomationInbox";
import styles from "./home.module.css";

const PRIORITY_RANK = { high: 0, medium: 1, low: 2 } as const;
/** Server render and first client frame use this; `useNow` takes over once the clock subscribes. */
const INITIAL_NOW = Date.now();

function areaOf(card: HomePriorityCard): string {
  if (card.source === "pulse") return "Pulse";
  if (card.href.startsWith("/sales")) return "Sales";
  if (card.href.startsWith("/staffing")) return "Staffing";
  return "Tasks";
}

const AREA_ICON: Record<string, { icon: IconName; tone: IconTone }> = {
  Pulse: { icon: "pulse", tone: "qiko" },
  Sales: { icon: "sales", tone: "brand" },
  Staffing: { icon: "users", tone: "info" },
  Tasks: { icon: "tasks", tone: "warning" },
};

const TILE_ICON: Record<string, { icon: IconName; tone: IconTone }> = {
  pipeline: { icon: "trendUp", tone: "brand" },
  placements: { icon: "briefcase", tone: "success" },
  actions: { icon: "checkCircle", tone: "brand" },
  pulse: { icon: "sparkles", tone: "qiko" },
};

export default function HomePage() {
  const { state, workspace } = useWorkspaceData();
  const { session, askQiko, openTaskForm, openTask, toast } = useWorkspace();
  const [question, setQuestion] = useState("");
  const [completing, setCompleting] = useState<string | null>(null);
  const now = useNow();
  const clock = now || INITIAL_NOW;

  // The single highest-priority pending Pulse insight: the one decision Home asks for.
  const bestMove = useMemo(() => {
    if (!state?.tessiant) return null;
    const pending = generateTessiantInsights(state, clock).filter((item) => item.reviewStatus === "pending");
    return [...pending].sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority])[0] ?? null;
  }, [state, clock]);

  const priorities = useMemo(
    () =>
      state && workspace
        ? buildTessiantHomePriorities(state, workspace, clock, { limit: 5, excludeInsightId: bestMove?.id ?? null })
        : [],
    [state, workspace, clock, bestMove],
  );
  const outcomes = useMemo(() => (state ? homeOutcomes(state, clock) : []), [state, clock]);
  const changes = useMemo(() => (state ? buildTessiantWhatChanged(state, clock, priorities) : []), [state, clock, priorities]);

  if (!state || !workspace) {
    return (
      <div className="page">
        <SkeletonRows rows={5} height={90} />
      </div>
    );
  }

  const openTasks = sortTasks(state.tasks.filter((task) => isOpen(task) && (task.ownerId === "me" || task.ownerId === null))).slice(0, 5);
  const dateLabel = new Date(clock).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });

  const ask = (event: FormEvent) => {
    event.preventDefault();
    if (!question.trim()) return;
    askQiko(question.trim());
    setQuestion("");
  };

  const completeTask = (taskId: string) => {
    if (completing) return;
    setCompleting(taskId);
    window.setTimeout(() => {
      crm.setTaskStatus(taskId, "completed");
      toast("Task completed");
      setCompleting(null);
    }, 260);
  };

  const acceptBestMove = () => {
    if (!bestMove) return;
    const taskId = crm.acceptPulseInsight(bestMove);
    toast("Insight accepted — added to My Tasks");
    if (taskId) openTask(taskId);
  };

  return (
    <div className={`page ${styles.home}`}>
      <header className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className="kicker">{dateLabel}</p>
          <h1>
            {greeting(new Date(clock))}, {firstName(session.name)}
          </h1>
          <p className={styles.lede}>{homeLede(state, priorities.length, clock)}</p>
        </div>
        <Link href="/brief" target="_blank" rel="noopener" className={styles.briefLink}>
          <Icon name="sun" size={14} />
          Today&apos;s brief
          <Icon name="external" size={12} />
        </Link>
      </header>

      <section className={styles.askSection} aria-label="Ask Qiko" data-tour="ask">
        <form onSubmit={ask} className={styles.ask}>
          <span className={styles.askOrb}>
            <Icon name="sparkles" size={15} />
          </span>
          <input
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="Ask Qiko about deals, talent, assignments or what to do next…"
            aria-label="Ask Qiko"
          />
          <kbd className={styles.askKbd}>⌘K</kbd>
          <Button type="submit" variant="qiko" size="small" iconRight="arrowRight" disabled={!question.trim()}>
            Ask
          </Button>
        </form>
        <div className={styles.prompts}>
          <span className={styles.promptsLabel}>Try</span>
          {SUGGESTED_QUESTIONS.slice(0, 4).map((prompt) => (
            <button key={prompt} type="button" onClick={() => askQiko(prompt)}>
              {prompt}
            </button>
          ))}
        </div>
      </section>

      {bestMove ? (
        <section className={styles.move} aria-labelledby="move-title" data-tour="move">
          <div className={styles.moveLead}>
            <div className={styles.moveHead}>
              <IconTile name="pulse" tone="qiko" size="sm" />
              <p className="kicker kicker-qiko">Qiko · Best next move</p>
              <span className={styles.moveBlock}>{knowledgeBlockTitle(bestMove.knowledgeBlockId)}</span>
            </div>
            <h2 id="move-title">{bestMove.recommendedAction.label}</h2>
            <p className={styles.moveSummary}>{bestMove.summary}</p>
          </div>
          <div className={styles.moveSide}>
            <ul className={styles.moveFacts}>
              <li>
                <Icon name="check" size={12} strokeWidth={2.6} />
                {bestMove.evidence.length} linked {bestMove.evidence.length === 1 ? "record" : "records"} as evidence
              </li>
              <li>
                <Icon name="zap" size={12} />
                Outcome measured as {expectedBenefit(bestMove).replace(/^[A-Z]/, (letter) => letter.toLowerCase())}
              </li>
            </ul>
            <div className={styles.moveActions}>
              <Button variant="qiko" size="small" icon="check" onClick={acceptBestMove}>
                Accept as a task
              </Button>
              <Link href="/pulse/insights" target="_blank" rel="noopener" className={styles.moveLink}>
                Review evidence in Pulse <Icon name="external" size={12} />
              </Link>
            </div>
          </div>
        </section>
      ) : null}

      <section className={styles.outcomes} aria-label="Outcomes">
        {outcomes.map((tile) => (
          <Link key={tile.key} href={tile.href} className={styles.tile} data-tone={tile.tone}>
            <span className={styles.tileCopy}>
              <span className={styles.tileLabel}>{tile.label}</span>
              <b className={`tabular ${styles.tileValue}`}>
                {tile.numeric !== undefined ? <CountUp value={tile.numeric} format={tile.format ?? ((n) => String(Math.round(n)))} /> : tile.value}
              </b>
              <span className={styles.tileSub}>{tile.sub}</span>
            </span>
            <span className={styles.tileSide}>
              <IconTile name={TILE_ICON[tile.key]?.icon ?? "chart"} tone={TILE_ICON[tile.key]?.tone ?? "brand"} size="sm" />
              <Spark values={tile.series} kind={tile.kind} tone={tile.tone} width={64} height={26} label={tile.seriesLabel} />
            </span>
          </Link>
        ))}
      </section>

      <div className={styles.primaryRow}>
        <section className={`card ${styles.focus}`} aria-labelledby="focus-title" data-tour="focus">
          <div className={styles.focusHead}>
            <div>
              <h2 id="focus-title">What matters now</h2>
              <p className={styles.focusSub}>Ranked across Sales, Staffing and Pulse. Each row opens the record with the next step ready.</p>
            </div>
            {priorities.length > 0 ? <span className="tag tabular">{priorities.length}</span> : null}
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
            <ol className={styles.focusList}>
              {priorities.map((item, index) => (
                <li key={item.id}>
                  <Link href={item.href} className={styles.focusRow} data-priority={item.priority}>
                    <span className={styles.focusRank} aria-hidden="true">
                      <span className={styles.focusRankNumber}>{index + 1}</span>
                      <IconTile name={AREA_ICON[areaOf(item)].icon} tone={AREA_ICON[areaOf(item)].tone} size="sm" className={styles.focusRankIcon} />
                    </span>
                    <span className={styles.focusCopy}>
                      <span className={styles.focusTitle}>{item.title}</span>
                      <span className={styles.focusWhy}>{item.summary}</span>
                    </span>
                    <span className={styles.focusMeta}>
                      <span className={styles.focusArea} data-area={areaOf(item)}>
                        {areaOf(item)}
                      </span>
                      <PriorityChip priority={item.priority} />
                      <span className={styles.focusAction}>
                        {item.actionLabel} <Icon name="arrowRight" size={13} />
                      </span>
                    </span>
                  </Link>
                  <FeedbackThumbs feedbackKey={`priority:${item.id}`} context="priority" compact />
                </li>
              ))}
            </ol>
          )}
          <div className={styles.focusFoot}>
            <span>Ranked by priority, then by how soon it bites. Pulse and Qiko suggestions are included.</span>
            <Link href="/tasks" className="link-button">
              Everything on My Tasks <Icon name="arrowRight" size={13} />
            </Link>
          </div>
        </section>

        <section className={`card ${styles.panel} ${styles.tasksPanel}`} aria-labelledby="tasks-title">
          <div className={styles.panelHead}>
            <h2 id="tasks-title">My tasks</h2>
            <Button size="small" variant="ghost" icon="plus" onClick={() => openTaskForm()} aria-label="New task">
              New
            </Button>
          </div>
          {openTasks.length === 0 ? (
            <EmptyState icon="tasks" title="Nothing open" />
          ) : (
            <ul className={styles.taskList}>
              {openTasks.map((task) => {
                const lead = task.leadId ? workspace.leadById.get(task.leadId) : null;
                const overdue = Boolean(task.due && task.due < todayKey());
                return (
                  <li key={task.id} className={styles.taskRow} data-completing={completing === task.id ? "true" : undefined}>
                    <button
                      type="button"
                      className={styles.taskCheck}
                      aria-label={`Complete ${task.title}`}
                      onClick={() => completeTask(task.id)}
                    >
                      <Icon name="check" size={11} strokeWidth={3} />
                    </button>
                    <button type="button" className={styles.taskMain} onClick={() => openTask(task.id)}>
                      <b>{task.title}</b>
                      <small>
                        <span data-overdue={overdue ? "true" : undefined}>
                          {task.due ? (overdue ? `Overdue · ${formatDate(task.due)}` : `Due ${formatDate(task.due)}`) : "No due date"}
                        </span>
                        {lead ? <span>· {lead.name}</span> : null}
                      </small>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          <Link href="/tasks" className={`link-button ${styles.panelFoot}`}>
            Open board <Icon name="arrowRight" size={13} />
          </Link>
        </section>
      </div>

      <div className={styles.secondaryRow}>
        <AutomationInbox state={state} now={clock} />
        <QikoTrackRecord state={state} now={clock} />
        <section className={`card ${styles.panel} ${styles.changesPanel}`} aria-labelledby="changes-title">
          <div className={styles.panelHead}>
            <h2 id="changes-title">What changed this week</h2>
          </div>
          {changes.length === 0 ? (
            <EmptyState icon="clock" title="Quiet week so far" />
          ) : (
            <ul className={styles.changeList}>
              {changes.map((item) => (
                <li key={item.id}>
                  <Link href={item.href} className={styles.changeRow}>
                    <b>{item.title}</b>
                    <span>{item.detail}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

    </div>
  );
}
