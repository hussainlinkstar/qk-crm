"use client";

import { useMemo } from "react";
import BarList from "@/components/ui/BarList";
import InsightSignals, { type InsightSignalItem } from "@/components/sales/InsightSignals";
import { useWorkspace } from "@/components/shell/WorkspaceContext";
import { activityIntelligence, activityMix } from "@/lib/activity-intelligence";
import type { Workspace } from "@/lib/insights";
import type { CrmState } from "@/lib/types";
import { plural } from "@/lib/format";
import styles from "@/app/(workspace)/sales/sales.module.css";

/** Header block for the Sales activities page: what needs doing, and what the log says this week. */
export default function SalesActivityIntelligence({ state, workspace }: { state: CrmState; workspace: Workspace }) {
  const { openTask } = useWorkspace();
  const signals = useMemo(() => activityIntelligence(state, workspace), [state, workspace]);
  const week = useMemo(() => activityMix(state, 7), [state]);
  const month = useMemo(() => activityMix(state, 30), [state]);
  const year = useMemo(() => activityMix(state, 365), [state]);
  const mix = week.length ? week : month.length ? month : year;
  const window = week.length ? "7 days" : month.length ? "30 days" : "12 months";
  const logged = mix.reduce((sum, row) => sum + row.count, 0);

  const items: InsightSignalItem[] = signals.map((signal) => ({
    id: signal.id,
    kind: signal.kind,
    title: signal.title,
    detail: signal.detail,
    actionLabel: signal.actionLabel,
    href: signal.href,
    onClick: signal.taskId ? () => openTask(signal.taskId as string) : undefined,
  }));

  return (
    <div className={styles.intelGrid}>
      <InsightSignals
        title="Activity intelligence"
        summary="What the follow-up book says right now. Each signal opens the task or record it came from."
        items={items}
        initial={4}
        emptyTitle="Nothing overdue, nothing unowned, no active lead gone quiet."
      />
      <section className="card">
        <div className="card-head">
          <div>
            <h2>Logged {window === "7 days" ? "this week" : window === "30 days" ? "this month" : "this year"}</h2>
            <p className="card-sub">
              {plural(logged, "interaction")} recorded in the last {window}. Logged, not sent.
            </p>
          </div>
        </div>
        <div className="card-body">
          {mix.length === 0 ? (
            <p className="muted">No sales interactions logged yet. Log a call or meeting from a lead or account.</p>
          ) : (
            <BarList
              label={`Interactions by type, last ${window}`}
              rows={mix.map((row) => ({ key: row.type, label: row.label, value: row.count, tone: "brand" as const }))}
            />
          )}
        </div>
      </section>
    </div>
  );
}
