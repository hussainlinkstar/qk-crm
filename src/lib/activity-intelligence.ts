// Sales activity intelligence: what the follow-up book and the activity log say this week.
// Read-only over CRM state; feeds the Activities page header.

import type { CrmState, SalesActivityType, Task } from "./types";
import type { Workspace } from "./insights";
import { isOpen, sortTasks } from "./insights";
import { plural, todayKey } from "./format";

export interface ActivitySignal {
  id: string;
  kind: "Overdue" | "Unassigned" | "Gone quiet" | "Due today";
  title: string;
  detail: string;
  taskId?: string;
  href?: string;
  actionLabel: string;
}

export interface ActivityMixRow {
  type: SalesActivityType;
  label: string;
  count: number;
}

const TYPE_LABEL: Record<SalesActivityType, string> = {
  call: "Calls",
  meeting: "Meetings",
  email: "Emails",
  introduction: "Introductions",
  note: "Notes",
  follow_up: "Follow-ups",
  other: "Other",
};

const DAY = 86_400_000;

function isSalesTask(task: Task) {
  return Boolean(task.leadId || task.accountId || task.opportunityId || task.contactId);
}

/** Logged sales interactions in the last `days`, grouped by type. Logging is not sending. */
export function activityMix(state: CrmState, days = 7, now = Date.now()): ActivityMixRow[] {
  const counts = new Map<SalesActivityType, number>();
  for (const event of state.events ?? []) {
    if (!event.activityType) continue;
    if (now - new Date(event.occurredAt).getTime() > days * DAY) continue;
    counts.set(event.activityType, (counts.get(event.activityType) ?? 0) + 1);
  }
  return (Object.keys(TYPE_LABEL) as SalesActivityType[])
    .map((type) => ({ type, label: TYPE_LABEL[type], count: counts.get(type) ?? 0 }))
    .filter((row) => row.count > 0)
    .sort((a, b) => b.count - a.count);
}

export function activityIntelligence(state: CrmState, workspace: Workspace, now = Date.now()): ActivitySignal[] {
  const today = todayKey();
  const open = state.tasks.filter((task) => isOpen(task) && isSalesTask(task));
  const overdue = sortTasks(open.filter((task) => task.due !== null && task.due < today));
  const dueToday = sortTasks(open.filter((task) => task.due === today));
  const unassigned = open.filter((task) => !task.ownerId);
  const signals: ActivitySignal[] = [];

  if (overdue.length) {
    signals.push({
      id: "overdue",
      kind: "Overdue",
      title: `${plural(overdue.length, "follow-up")} past due`,
      detail: `Oldest: “${overdue[0].title}”. Clearing these first protects response time on live deals.`,
      taskId: overdue[0].id,
      actionLabel: "Open oldest",
    });
  }

  if (dueToday.length) {
    signals.push({
      id: "today",
      kind: "Due today",
      title: `${plural(dueToday.length, "activity", "activities")} due today`,
      detail: `Next up: “${dueToday[0].title}”.`,
      taskId: dueToday[0].id,
      actionLabel: "Start",
    });
  }

  // Working or qualified leads with no touch in 7+ days and no open task: the book is going cold.
  const quiet = workspace.leads.filter((lead) => {
    if (lead.status !== "Working" && lead.status !== "Qualified") return false;
    if (lead.openTasks.length > 0) return false;
    const last = lead.lastActivity?.occurredAt ?? lead.createdAt;
    return now - new Date(last).getTime() >= 7 * DAY;
  });
  if (quiet.length) {
    signals.push({
      id: "quiet",
      kind: "Gone quiet",
      title: `${plural(quiet.length, "active lead")} with no touch in 7 days`,
      detail: `${quiet
        .slice(0, 2)
        .map((lead) => lead.name)
        .join(", ")}${quiet.length > 2 ? ` and ${quiet.length - 2} more` : ""}. No open follow-up is planned.`,
      href: `/sales/leads/${quiet[0].id}`,
      actionLabel: "Re-engage",
    });
  }

  if (unassigned.length) {
    signals.push({
      id: "unassigned",
      kind: "Unassigned",
      title: `${plural(unassigned.length, "open activity", "open activities")} without an owner`,
      detail: "Unowned follow-ups are the ones that slip. Assign them so the board reflects who is accountable.",
      taskId: unassigned[0].id,
      actionLabel: "Assign",
    });
  }

  return signals;
}
