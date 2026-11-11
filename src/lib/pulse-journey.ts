// Shared Pulse insight → task → outcome helpers. Deterministic IDs only.

import type { CrmState, Task } from "./types";
import { generateTessiantInsights } from "./tessiant-pulse-rules";
import type { TessiantInsight } from "./tessiant-pulse-types";

export function insightIdFromTask(description: string) {
  return description.match(/\[pulse-insight:([^\]]+)\]/)?.[1] ?? null;
}

export function requirementIdFromTask(description: string) {
  return description.match(/\[requirement:([^\]]+)\]/)?.[1] ?? null;
}

export function findTaskForInsight(state: CrmState, insightId: string): Task | undefined {
  return state.tasks.find(
    (task) =>
      task.description.includes(`[pulse-insight:${insightId}]`) && task.status !== "dismissed",
  );
}

export function requirementHasConfirmedAssignment(state: CrmState, requirementId: string | null) {
  if (!requirementId) return false;
  return (state.tessiant?.placements ?? []).some(
    (placement) =>
      placement.requirementId === requirementId &&
      placement.status !== "closed" &&
      (placement.status === "confirmed" || placement.status === "agreed"),
  );
}

/** Prefer the coverage-gap signal on a requirement so CRM and Pulse share one journey. */
export function contextualInsightForRecord(
  state: CrmState,
  scope: { leadId?: string | null; opportunityId?: string | null; accountId?: string | null; requirementId?: string | null },
  now = Date.now(),
): TessiantInsight | null {
  const insights = generateTessiantInsights(state, now);
  if (scope.requirementId) {
    const citing = insights.filter((item) =>
      item.evidence.some((row) => row.entityType === "requirement" && row.entityId === scope.requirementId),
    );
    const coverage =
      citing.find((item) => item.ruleId === "coverage_gap" && item.reviewStatus === "pending") ??
      citing.find((item) => item.ruleId === "coverage_gap");
    if (coverage) return coverage;
    return citing.find((item) => item.reviewStatus === "pending") ?? citing[0] ?? null;
  }
  const ids = new Set<string>();
  if (scope.leadId) ids.add(scope.leadId);
  if (scope.opportunityId) ids.add(scope.opportunityId);
  if (scope.accountId) ids.add(scope.accountId);
  const pending = insights.filter(
    (item) => item.reviewStatus === "pending" && item.evidence.some((row) => ids.has(row.entityId)),
  );
  return pending[0] ?? null;
}
