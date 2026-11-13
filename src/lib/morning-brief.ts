// Morning brief: the same read of the workspace Home gives, as a page that stands on its own and
// as plain text for email or chat. Built from the same helpers; nothing is written here that the
// workspace would not say.

import type { CrmState } from "./types";
import { buildWorkspace } from "./insights";
import { buildTessiantHomePriorities, buildTessiantWhatChanged, homeOutcomes, type HomePriorityCard } from "./home-tessiant";
import { generateTessiantInsights } from "./tessiant-pulse-rules";
import { automationProposals, type AutomationProposal } from "./automations";
import { trackRecord } from "./qiko-track-record";
import { formatDate } from "./format";

export interface MorningBrief {
  date: string;
  numbers: Array<{ label: string; value: string; sub: string }>;
  bestMove: { title: string; summary: string } | null;
  priorities: HomePriorityCard[];
  proposals: AutomationProposal[];
  changes: Array<{ title: string; detail: string }>;
  record: { accuracyPct: number | null; actedOn: number; outcomes: number };
}

const PRIORITY_RANK = { high: 0, medium: 1, low: 2 } as const;

export function morningBrief(state: CrmState, now = Date.now()): MorningBrief {
  const workspace = buildWorkspace(state, now);
  const pending = state.tessiant ? generateTessiantInsights(state, now).filter((item) => item.reviewStatus === "pending") : [];
  const best = [...pending].sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority])[0] ?? null;
  const priorities = buildTessiantHomePriorities(state, workspace, now, { limit: 5, excludeInsightId: best?.id ?? null });
  const changes = buildTessiantWhatChanged(state, now, priorities).slice(0, 5).map((item) => ({ title: item.title, detail: item.detail }));
  const record = trackRecord(state, now);
  return {
    date: formatDate(new Date(now).toISOString(), true),
    numbers: homeOutcomes(state, now).slice(0, 4).map((tile) => ({ label: tile.label, value: tile.value, sub: tile.sub })),
    bestMove: best ? { title: best.title, summary: best.summary } : null,
    priorities,
    proposals: automationProposals(state, now),
    changes,
    record: { accuracyPct: record.accuracyPct, actedOn: record.actedOn, outcomes: record.outcomes },
  };
}

export function briefAsText(brief: MorningBrief, name: string): string {
  const lines: string[] = [];
  lines.push(`Qiko morning brief · ${brief.date}`);
  lines.push(`Good morning ${name}.`);
  lines.push("");
  lines.push("Numbers");
  for (const item of brief.numbers) lines.push(`- ${item.label}: ${item.value} (${item.sub})`);
  lines.push("");
  if (brief.bestMove) {
    lines.push("Best next move");
    lines.push(`- ${brief.bestMove.title}: ${brief.bestMove.summary}`);
    lines.push("");
  }
  lines.push("What matters today");
  brief.priorities.forEach((item, index) => lines.push(`${index + 1}. ${item.title} — ${item.summary} (${item.actionLabel})`));
  lines.push("");
  if (brief.proposals.length) {
    lines.push("Waiting for your OK");
    for (const item of brief.proposals) lines.push(`- ${item.title} (${item.rule.name})`);
    lines.push("");
  }
  if (brief.changes.length) {
    lines.push("What changed this week");
    for (const item of brief.changes) lines.push(`- ${item.title}: ${item.detail}`);
    lines.push("");
  }
  lines.push(`Qiko's record: ${brief.record.actedOn} actions taken from its calls, ${brief.record.outcomes} outcomes recorded${brief.record.accuracyPct !== null ? `, ${brief.record.accuracyPct}% rated right` : ""}.`);
  return lines.join("\n");
}
