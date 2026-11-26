"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
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
import { firstName, formatDate, greeting, todayKey } from "@/lib/format";
import Button from "@/components/ui/Button";
import Icon from "@/components/ui/Icon";
import { type IconTone } from "@/components/ui/IconTile";
import type { IconName } from "@/components/ui/Icon";
import { EmptyState, PriorityChip, SkeletonRows, useNow, useWorkspaceData } from "@/components/ui/bits";
import { useWorkspace } from "@/components/shell/WorkspaceContext";
import FeedbackThumbs from "@/components/ui/FeedbackThumbs";
import QikoTrackRecord from "@/components/home/QikoTrackRecord";
import AutomationInbox from "@/components/home/AutomationInbox";
import { AskBar, Columns, DecisionBanner, FocusPanel, LinkList, OutcomeGrid, PageHero, PillLink, RankedList, WorkPanel } from "@/components/ui/workspace";
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
      <PageHero
        kicker={dateLabel}
        title={<>{greeting(new Date(clock))}, {firstName(session.name)}</>}
        lede={homeLede(state, priorities.length, clock)}
        action={
          <PillLink href="/brief" external>
            <Icon name="sun" size={14} />
            Today&apos;s brief
            <Icon name="external" size={12} />
          </PillLink>
        }
      />

      <AskBar
        tour="ask"
        placeholder="Ask Qiko about deals, talent, assignments or what to do next…"
        prompts={SUGGESTED_QUESTIONS.slice(0, 4)}
        onAsk={(question) => askQiko(question)}
      />

      {bestMove ? (
        <DecisionBanner
          tour="move"
          kicker="Qiko · Best next move"
          context={knowledgeBlockTitle(bestMove.knowledgeBlockId)}
          title={bestMove.recommendedAction.label}
          summary={bestMove.summary}
          facts={[
            { icon: "check", text: `${bestMove.evidence.length} linked ${bestMove.evidence.length === 1 ? "record" : "records"} as evidence` },
            { icon: "zap", text: `Outcome measured as ${expectedBenefit(bestMove).replace(/^[A-Z]/, (letter) => letter.toLowerCase())}` },
          ]}
          action={
            <Button variant="qiko" size="small" icon="check" onClick={acceptBestMove}>
              Accept as a task
            </Button>
          }
          link={{ href: "/pulse/insights", label: "Review evidence in Pulse", external: true }}
        />
      ) : null}

      <OutcomeGrid
        tiles={outcomes.map((tile) => ({
          key: tile.key,
          href: tile.href,
          label: tile.label,
          value: tile.value,
          numeric: tile.numeric,
          format: tile.format,
          sub: tile.sub,
          icon: TILE_ICON[tile.key]?.icon ?? "chart",
          iconTone: TILE_ICON[tile.key]?.tone ?? "brand",
          tone: tile.tone,
          series: tile.series,
          kind: tile.kind,
          seriesLabel: tile.seriesLabel,
        }))}
      />

      <Columns variant="three">
        <FocusPanel
          tour="focus"
          span={2}
          id="focus-title"
          title="What matters now"
          sub="Ranked across Sales, Staffing and Pulse. Each row opens the record with the next step ready."
          count={priorities.length}
          foot={
            <>
              <span>Ranked by priority, then by how soon it bites. Pulse and Qiko suggestions are included.</span>
              <Link href="/tasks" className="link-button">
                Everything on My Tasks <Icon name="arrowRight" size={13} />
              </Link>
            </>
          }
        >
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
            <RankedList
              items={priorities.map((item) => ({
                id: item.id,
                href: item.href,
                title: item.title,
                summary: item.summary,
                area: areaOf(item),
                priority: item.priority,
                actionLabel: item.actionLabel,
                icon: AREA_ICON[areaOf(item)].icon,
                iconTone: AREA_ICON[areaOf(item)].tone,
                meta: <PriorityChip priority={item.priority} />,
                aside: <FeedbackThumbs feedbackKey={`priority:${item.id}`} context="priority" compact />,
              }))}
            />
          )}
        </FocusPanel>

        <WorkPanel
          id="tasks-title"
          title="My tasks"
          className={styles.tasksPanel}
          action={
            <Button size="small" variant="ghost" icon="plus" onClick={() => openTaskForm()} aria-label="New task">
              New
            </Button>
          }
          foot={
            <Link href="/tasks" className="link-button">
              Open board <Icon name="arrowRight" size={13} />
            </Link>
          }
        >
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
        </WorkPanel>
      </Columns>

      <Columns variant="rail">
        <AutomationInbox state={state} now={clock} />
        <QikoTrackRecord state={state} now={clock} />
        <WorkPanel id="changes-title" title="What changed this week" className={styles.changesPanel}>
          {changes.length === 0 ? (
            <EmptyState icon="clock" title="Quiet week so far" />
          ) : (
            <LinkList items={changes.map((item) => ({ id: item.id, href: item.href, title: item.title, detail: item.detail }))} />
          )}
        </WorkPanel>
      </Columns>

    </div>
  );
}
