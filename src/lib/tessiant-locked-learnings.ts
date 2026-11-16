import { evidenceKindLabel, evidenceLabel } from "./pulse-presentation";
import type { CrmState } from "./types";
import type { PulseOutcome, TessiantInsight } from "./tessiant-pulse-types";

export type LockedLearningKind = "confirmed" | "accepted" | "rejected";

export type LockedLearningEvidence = {
  kind: string;
  label: string;
  href?: string;
  field?: string;
  observedValue?: string | number;
};

export type LockedLearning = {
  id: string;
  insightId: string;
  kind: LockedLearningKind;
  title: string;
  /** Evidence-based statement only — composed from insight + outcome, never invented metrics. */
  learning: string;
  action: string;
  ruleId: string;
  priority: TessiantInsight["priority"];
  confidence: TessiantInsight["confidence"];
  decidedAt: string;
  evidence: LockedLearningEvidence[];
  outcomeSummary?: string;
  valueNote?: string;
  taskId?: string;
  reviewReason?: string;
  outcomeStatus?: PulseOutcome["status"];
};

export type LockedLearningsBundle = {
  confirmed: LockedLearning[];
  acceptedOpen: LockedLearning[];
  rejected: LockedLearning[];
  awaiting: TessiantInsight[];
};

function outcomeFor(insight: TessiantInsight, state: CrmState): PulseOutcome | null {
  return state.tessiant?.pulse?.outcomes.find((item) => item.insightId === insight.id) ?? null;
}

function reviewAt(insight: TessiantInsight, state: CrmState): string {
  return state.tessiant?.pulse?.reviews?.[insight.id]?.at ?? insight.generatedAt;
}

function evidenceRows(state: CrmState, insight: TessiantInsight): LockedLearningEvidence[] {
  return insight.evidence.map((item) => ({
    kind: evidenceKindLabel(item),
    label: evidenceLabel(state, item),
    href: item.href,
    field: item.field,
    observedValue: item.observedValue,
  }));
}

function evidenceSentence(rows: LockedLearningEvidence[]): string {
  if (!rows.length) return "No linked CRM evidence was attached.";
  return rows
    .slice(0, 4)
    .map((row) => {
      const value =
        row.observedValue === undefined || row.observedValue === ""
          ? null
          : typeof row.observedValue === "number"
            ? String(row.observedValue)
            : String(row.observedValue);
      return value && row.field
        ? `${row.kind} ${row.label} (${row.field}: ${value})`
        : `${row.kind} ${row.label}`;
    })
    .join("; ");
}

function valueNote(outcome: PulseOutcome): string | undefined {
  const parts: string[] = [];
  if (outcome.value.qualitativeBenefit) parts.push(outcome.value.qualitativeBenefit);
  if (outcome.value.estimatedTimeSavedHours != null) {
    parts.push(`${outcome.value.estimatedTimeSavedHours}h estimated time saved`);
  }
  if (outcome.value.directCostSavings != null) {
    parts.push(`£${outcome.value.directCostSavings.toLocaleString("en-GB")} direct cost savings`);
  }
  if (outcome.value.pipelinePotential != null) {
    parts.push(`£${outcome.value.pipelinePotential.toLocaleString("en-GB")} pipeline potential (not realised)`);
  }
  if (outcome.value.realisedRevenue != null) {
    parts.push(`£${outcome.value.realisedRevenue.toLocaleString("en-GB")} realised revenue`);
  }
  return parts.length ? parts.join(" · ") : undefined;
}

/** Compose a locked learning from the insight evidence and any measured outcome — no invented facts. */
export function composeLockedLearning(
  state: CrmState,
  insight: TessiantInsight,
  kind: LockedLearningKind,
): LockedLearning {
  const outcome = outcomeFor(insight, state);
  const evidence = evidenceRows(state, insight);
  const evidenceText = evidenceSentence(evidence);
  const decidedAt = reviewAt(insight, state);

  let learning: string;
  if (kind === "confirmed" && outcome) {
    learning = [
      outcome.summary.trim(),
      `Signal: ${insight.summary.trim()}`,
      `Evidence used: ${evidenceText}.`,
      outcome.value.notes?.trim() ? `Record note: ${outcome.value.notes.trim()}` : null,
    ]
      .filter(Boolean)
      .join(" ");
  } else if (kind === "accepted") {
    learning = [
      `Accepted action: ${insight.recommendedAction.label}.`,
      `Signal: ${insight.summary.trim()}`,
      `Evidence on file: ${evidenceText}.`,
      outcome?.status === "pending" ? `Outcome still open: ${outcome.summary.trim()}` : "Outcome not recorded yet.",
    ].join(" ");
  } else {
    learning = [
      `Rejected${insight.reviewReason ? ` · ${insight.reviewReason}` : ""}.`,
      `Signal was: ${insight.summary.trim()}`,
      `Evidence reviewed: ${evidenceText}.`,
      "No commercial value was assumed from this rejection.",
    ].join(" ");
  }

  return {
    id: `learn_${insight.id}`,
    insightId: insight.id,
    kind,
    title: insight.title,
    learning,
    action: insight.recommendedAction.label,
    ruleId: insight.ruleId,
    priority: insight.priority,
    confidence: insight.confidence,
    decidedAt,
    evidence,
    outcomeSummary: outcome?.summary,
    valueNote: outcome ? valueNote(outcome) : undefined,
    taskId: insight.taskId ?? outcome?.taskId ?? undefined,
    reviewReason: insight.reviewReason,
    outcomeStatus: outcome?.status,
  };
}

/**
 * Locked learnings for one knowledge block.
 * Confirmed = accepted insight with a completed / unsuccessful / not_pursued outcome.
 * Accepted open = accepted without a terminal outcome.
 * Rejected = operator rejections with reason.
 * Awaiting = pending insights still unlocked (shown separately, never labelled locked).
 */
export function buildLockedLearnings(state: CrmState, insights: TessiantInsight[]): LockedLearningsBundle {
  const confirmed: LockedLearning[] = [];
  const acceptedOpen: LockedLearning[] = [];
  const rejected: LockedLearning[] = [];
  const awaiting: TessiantInsight[] = [];

  for (const insight of insights) {
    const outcome = outcomeFor(insight, state);
    if (insight.reviewStatus === "rejected") {
      rejected.push(composeLockedLearning(state, insight, "rejected"));
      continue;
    }
    if (insight.reviewStatus === "accepted" || Boolean(insight.taskId) || Boolean(outcome)) {
      const terminal =
        outcome &&
        (outcome.status === "completed" || outcome.status === "unsuccessful" || outcome.status === "not_pursued");
      if (terminal) confirmed.push(composeLockedLearning(state, insight, "confirmed"));
      else acceptedOpen.push(composeLockedLearning(state, insight, "accepted"));
      continue;
    }
    awaiting.push(insight);
  }

  const byDate = (a: LockedLearning, b: LockedLearning) => b.decidedAt.localeCompare(a.decidedAt);
  return {
    confirmed: confirmed.sort(byDate),
    acceptedOpen: acceptedOpen.sort(byDate),
    rejected: rejected.sort(byDate),
    awaiting,
  };
}
