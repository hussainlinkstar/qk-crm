// Qiko's own scorecard: what it raised, what the team acted on, what was recorded as an outcome,
// and how often the user said the call was right. All from stored decisions, tasks, outcomes and
// the feedback ledger; nothing modelled.

import type { CrmState } from "./types";
import { generateTessiantInsights } from "./tessiant-pulse-rules";
import { insightIdFromTask } from "./pulse-journey";

export interface TrackRecord {
  raised: number;
  accepted: number;
  actedOn: number;
  outcomes: number;
  valueAttributed: number;
  feedbackTotal: number;
  feedbackRight: number;
  feedbackPartly: number;
  accuracyPct: number | null;
  /** Outcomes recorded per week, oldest first, for a sparkline. */
  outcomeSeries: number[];
}

const WEEK = 7 * 86_400_000;

export function trackRecord(state: CrmState, now = Date.now()): TrackRecord {
  const decisions = Object.values(state.decisions ?? {});
  const insights = state.tessiant ? generateTessiantInsights(state, now) : [];
  const reviews = Object.values(state.tessiant?.pulse?.reviews ?? {});
  const outcomes = state.tessiant?.pulse?.outcomes ?? [];

  const raised = decisions.length + insights.length;
  const accepted = decisions.filter((item) => item.decision === "accepted" || item.decision === "done").length + reviews.filter((item) => item.decision === "accepted").length;
  const actedOn = state.tasks.filter(
    (task) => task.status === "completed" && (task.origin === "suggestion" || task.origin === "copilot" || Boolean(insightIdFromTask(task.description))),
  ).length;
  const recorded = outcomes.filter((item) => item.status === "completed");
  const valueAttributed = outcomes.reduce((sum, item) => sum + (item.value.realisedRevenue ?? 0) + (item.value.pipelinePotential ?? 0), 0);

  const feedback = Object.values(state.feedback ?? {});
  const feedbackRight = feedback.filter((item) => item.verdict === "right").length;
  const feedbackPartly = feedback.filter((item) => item.verdict === "partly").length;
  const accuracyPct = feedback.length ? Math.round(((feedbackRight + feedbackPartly * 0.5) / feedback.length) * 100) : null;

  const outcomeSeries: number[] = [];
  for (let offset = 7; offset >= 0; offset -= 1) {
    const start = now - (offset + 1) * WEEK;
    const end = now - offset * WEEK;
    outcomeSeries.push(outcomes.filter((item) => {
      const at = new Date(item.updatedAt || item.createdAt).getTime();
      return at > start && at <= end;
    }).length);
  }

  return { raised, accepted, actedOn, outcomes: recorded.length, valueAttributed, feedbackTotal: feedback.length, feedbackRight, feedbackPartly, accuracyPct, outcomeSeries };
}
