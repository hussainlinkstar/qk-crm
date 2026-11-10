"use client";

import Link from "next/link";
import { useMemo } from "react";
import { EmptyState, SkeletonRows, useNow, useWorkspaceData } from "@/components/ui/bits";
import PulseSubnav from "@/components/pulse/PulseSubnav";
import { getPulseSnapshot } from "@/lib/pulse-adapter";
import { formatDateTime } from "@/lib/format";
import { generateTessiantInsights } from "@/lib/tessiant-pulse-rules";
import styles from "../pulse.module.css";

function money(value: number | null | undefined) {
  if (value == null) return "—";
  return `£${value.toLocaleString("en-GB")}`;
}

export default function PulseValuePage() {
  const { state } = useWorkspaceData();
  const now = useNow();
  const insights = useMemo(() => (state ? generateTessiantInsights(state, now || Date.now()) : []), [state, now]);

  if (!state?.tessiant) {
    return (
      <div className="page">
        <SkeletonRows rows={3} height={90} />
      </div>
    );
  }

  const snapshot = getPulseSnapshot(state);
  const outcomes = state.tessiant.pulse?.outcomes ?? [];
  const attributed = state.tessiant.pulse?.attributedSourceKeys ?? [];
  const reviews = Object.values(state.tessiant.pulse?.reviews ?? {});
  const accepted = reviews.filter((item) => item.decision === "accepted").length;
  const completedOutcomes = outcomes.filter((item) => item.status === "completed");
  const pendingValue = outcomes.filter((item) => item.status === "pending");
  const pulseTasks = state.tasks.filter((task) => task.description.includes("[pulse-insight:"));
  const actionsWithOutcomes = pulseTasks.filter((task) => {
    const match = task.description.match(/\[pulse-insight:([^\]]+)\]/);
    return match ? outcomes.some((outcome) => outcome.insightId === match[1]) : false;
  }).length;

  const realisedFromOutcomes = outcomes.reduce((sum, item) => sum + (item.value.realisedRevenue ?? 0), 0);
  const pipelineFromOutcomes = outcomes.reduce((sum, item) => sum + (item.value.pipelinePotential ?? 0), 0);
  const hoursSaved = outcomes.reduce((sum, item) => sum + (item.value.estimatedTimeSavedHours ?? 0), 0);
  const directSavings = outcomes.reduce((sum, item) => sum + (item.value.directCostSavings ?? 0), 0);

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <div className={styles.context}>
            <span className="chip chip-ai">Qiko Pulse</span>
            <span className="chip">Value</span>
          </div>
          <h1>Value</h1>
          <p className="subtitle">Measurable outcomes from completed Pulse actions — categories stay separate.</p>
        </div>
      </header>

      <PulseSubnav />

      <section className={styles.kpis} aria-label="Value summary">
        <div className={styles.kpi}>
          <span>Completed recommendations</span>
          <b className="tabular">{accepted}</b>
          <small>Accepted insights in Tessiant Pulse</small>
        </div>
        <div className={styles.kpi}>
          <span>Actions with outcomes</span>
          <b className="tabular">{actionsWithOutcomes}</b>
          <small>To-dos with recorded outcome rows</small>
        </div>
        <div className={styles.kpi}>
          <span>Verified incremental revenue</span>
          <b className="tabular">{money(realisedFromOutcomes || null)}</b>
          <small>From Pulse outcomes only</small>
        </div>
        <div className={styles.kpi}>
          <span>Estimated savings</span>
          <b className="tabular">{hoursSaved.toFixed(1)}h</b>
          <small>Direct cost {money(directSavings || null)}</small>
        </div>
        <div className={styles.kpi}>
          <span>Pending value confirmation</span>
          <b className="tabular">{pendingValue.length}</b>
          <small>Outcomes waiting for measured value</small>
        </div>
        <div className={styles.kpi}>
          <span>Open insights</span>
          <b className="tabular">{insights.filter((item) => item.reviewStatus === "pending").length}</b>
          <small>Still awaiting accept / reject</small>
        </div>
      </section>

      <section className={styles.valueGrid} aria-label="Value categories">
        <div className={styles.valueCard} data-kind="pipeline">
          <h3>Pipeline potential</h3>
          <b className="tabular">{money(pipelineFromOutcomes)}</b>
          <p className="muted">Unclosed opportunity value from Pulse outcomes — not revenue.</p>
          <p className="muted">CRM quoted day-rate context: {money(snapshot.financials.pipeline)}</p>
        </div>
        <div className={styles.valueCard} data-kind="agreed">
          <h3>Agreed commercial value</h3>
          <b className="tabular">{money(snapshot.financials.agreed)}</b>
          <p className="muted">CRM assignments agreed but not realised. Not labelled as Pulse revenue.</p>
        </div>
        <div className={styles.valueCard} data-kind="realised">
          <h3>Realised revenue</h3>
          <b className="tabular">{money(realisedFromOutcomes)}</b>
          <p className="muted">Confirmed amounts recorded on Pulse outcomes only.</p>
          <p className="muted">CRM placement day-rate context: {money(snapshot.financials.realised)}</p>
        </div>
        <div className={styles.valueCard} data-kind="savings">
          <h3>Estimated savings</h3>
          <b className="tabular">{hoursSaved.toFixed(1)}h</b>
          <p className="muted">Time saved from completed actions.</p>
          <p className="muted">Direct cost savings recorded: {money(directSavings || null)}</p>
        </div>
      </section>

      <p className={styles.note}>
        Attribution keys prevent double counting ({attributed.length} stored). Pipeline potential and agreed commercial
        value are never labelled as revenue generated by Pulse.
      </p>

      <section className="card">
        <div className="card-head">
          <div>
            <h2>Outcome ledger</h2>
            <p className="card-sub">Insight → action → attributed categories.</p>
          </div>
          <Link href="/pulse/actions" className="text-link">
            To-dos
          </Link>
        </div>
        <div className="card-body">
          {outcomes.length === 0 ? (
            <EmptyState title="No outcomes recorded yet" icon="flag">
              Accept an insight, complete the to-do, then return here.
            </EmptyState>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Status</th>
                    <th>Summary</th>
                    <th>Pipeline potential</th>
                    <th>Realised</th>
                    <th>Time saved</th>
                    <th>Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {outcomes.map((outcome) => {
                    const insight = insights.find((item) => item.id === outcome.insightId);
                    return (
                      <tr key={outcome.id}>
                        <td>
                          <span className="chip">{outcome.status}</span>
                        </td>
                        <td>
                          <div>{outcome.summary}</div>
                          <div className="muted">{insight?.title ?? "Pulse recommendation"}</div>
                          {outcome.value.qualitativeBenefit ? <div className="muted">{outcome.value.qualitativeBenefit}</div> : null}
                        </td>
                        <td className="tabular">{money(outcome.value.pipelinePotential)}</td>
                        <td className="tabular">{money(outcome.value.realisedRevenue)}</td>
                        <td className="tabular">
                          {outcome.value.estimatedTimeSavedHours != null ? `${outcome.value.estimatedTimeSavedHours}h` : "—"}
                        </td>
                        <td className="muted">{formatDateTime(outcome.updatedAt)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {completedOutcomes.length === 0 && pendingValue.length > 0 ? (
            <p className={styles.note} style={{ marginTop: 12 }}>
              Some outcomes are pending value confirmation before realised figures are attributed.
            </p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
