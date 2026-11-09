"use client";

import Link from "next/link";
import { EmptyState, SkeletonRows, useWorkspaceData } from "@/components/ui/bits";
import { getPulseSnapshot } from "@/lib/pulse-adapter";
import { formatDateTime } from "@/lib/format";
import styles from "../pulse.module.css";

export default function PulseValuePage() {
  const { state } = useWorkspaceData();
  if (!state?.tessiant) {
    return (
      <div className="page">
        <SkeletonRows rows={3} height={90} />
      </div>
    );
  }

  const snapshot = getPulseSnapshot(state);
  const outcomes = state.tessiant.pulse?.outcomes ?? [];
  const realisedFromOutcomes = outcomes.reduce((sum, item) => sum + (item.value.realisedRevenue ?? 0), 0);
  const pipelineFromOutcomes = outcomes.reduce((sum, item) => sum + (item.value.pipelinePotential ?? 0), 0);
  const hoursSaved = outcomes.reduce((sum, item) => sum + (item.value.estimatedTimeSavedHours ?? 0), 0);

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <div className={styles.context}>
            <span className="chip chip-ai">Qiko Pulse</span>
            <span className="chip">Value</span>
          </div>
          <h1>Value & attribution</h1>
          <p className="subtitle">Outcomes connected to decisions. Realised, potential and estimated categories stay separate — no impressive invented totals.</p>
        </div>
      </header>

      <div className={styles.note}>
        CRM adapter day-rates (suggested / pipeline / agreed / realised) come from shared Tessiant commercial fields. Pulse outcome values only count when recorded against an accepted insight, and the same insight cannot double-count.
      </div>

      <section className={styles.valueGrid}>
        <div className={styles.valueCard} data-kind="realised">
          <h3>Realised</h3>
          <b className="tabular">£{realisedFromOutcomes.toLocaleString("en-GB")}</b>
          <p className="muted">From Pulse outcomes with confirmed revenue fields</p>
          <p className="muted">CRM confirmed placement day-rate context: £{snapshot.financials.realised.toLocaleString("en-GB")}</p>
        </div>
        <div className={styles.valueCard} data-kind="pipeline">
          <h3>Pipeline potential</h3>
          <b className="tabular">£{pipelineFromOutcomes.toLocaleString("en-GB")}</b>
          <p className="muted">Unclosed opportunity value from outcomes</p>
          <p className="muted">CRM quoted pipeline day-rate context: £{snapshot.financials.pipeline.toLocaleString("en-GB")}</p>
        </div>
        <div className={styles.valueCard}>
          <h3>Estimated time saved</h3>
          <b className="tabular">{hoursSaved.toFixed(1)}h</b>
          <p className="muted">Estimate with method noted on each outcome — not verified cash savings</p>
        </div>
      </section>

      <section className="card">
        <div className="card-head">
          <div>
            <h2>Outcome ledger</h2>
            <p className="card-sub">Each row links insight → task → attribution notes.</p>
          </div>
          <Link href="/pulse/actions" className="text-link">
            Actions
          </Link>
        </div>
        <div className="card-body">
          {outcomes.length === 0 ? (
            <EmptyState title="No outcomes recorded yet" icon="flag">
              Accept an insight, complete the task from Pulse Actions, then return here.
            </EmptyState>
          ) : (
            <ul style={{ margin: 0, paddingLeft: 16 }}>
              {outcomes.map((outcome) => (
                <li key={outcome.id} style={{ marginBottom: 12 }}>
                  <b>{outcome.status}</b> · {outcome.summary}
                  <div className="muted">
                    Insight {outcome.insightId}
                    {outcome.taskId ? ` · task ${outcome.taskId}` : ""} · {formatDateTime(outcome.updatedAt)}
                  </div>
                  <div className="muted">{outcome.value.notes}</div>
                  <div className="muted">
                    Realised £{outcome.value.realisedRevenue ?? "—"} · Pipeline £{outcome.value.pipelinePotential ?? "—"} · Time{" "}
                    {outcome.value.estimatedTimeSavedHours ?? "—"}h
                    {outcome.value.qualitativeBenefit ? ` · ${outcome.value.qualitativeBenefit}` : ""}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
