"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import Button from "@/components/ui/Button";
import { EmptyState, SkeletonRows, useNow, useWorkspaceData } from "@/components/ui/bits";
import { useWorkspace } from "@/components/shell/WorkspaceContext";
import PulseSubnav from "@/components/pulse/PulseSubnav";
import { crm } from "@/lib/crm-store";
import { getPulseSnapshot } from "@/lib/pulse-adapter";
import { formatDateTime } from "@/lib/format";
import { requirementHasConfirmedAssignment } from "@/lib/pulse-journey";
import { generateTessiantInsights } from "@/lib/tessiant-pulse-rules";
import type { PulseOutcome } from "@/lib/tessiant-pulse-types";
import type { CrmState } from "@/lib/types";
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

      <p className="muted">
        {accepted} accepted · {actionsWithOutcomes} with outcomes · {pendingValue.length} pending confirmation ·{" "}
        {insights.filter((item) => item.reviewStatus === "pending").length} still open
      </p>

      <section className={styles.valueGrid} aria-label="Attributed Pulse value">
        <div className={styles.valueCard} data-kind="realised">
          <h3>Attributed realised</h3>
          <b className="tabular">{money(realisedFromOutcomes)}</b>
          <p className="muted">Confirmed amounts on Pulse outcomes only. SIA contribution is never booked here.</p>
        </div>
        <div className={styles.valueCard} data-kind="pipeline">
          <h3>Attributed pipeline</h3>
          <b className="tabular">{money(pipelineFromOutcomes)}</b>
          <p className="muted">Unclosed opportunity value from accepted work — including advisory, labelled pipeline only.</p>
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
                      <FragmentRow
                        key={outcome.id}
                        outcome={outcome}
                        insightTitle={insight?.title ?? "Pulse recommendation"}
                        state={state}
                      />
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

function FragmentRow({
  outcome,
  insightTitle,
  state,
}: {
  outcome: PulseOutcome;
  insightTitle: string;
  state: CrmState;
}) {
  return (
    <>
      <tr>
        <td>
          <span className="chip">{outcome.status}</span>
        </td>
        <td>
          <div>{outcome.summary}</div>
          <div className="muted">{insightTitle}</div>
          {outcome.value.qualitativeBenefit ? <div className="muted">{outcome.value.qualitativeBenefit}</div> : null}
        </td>
        <td className="tabular">{money(outcome.value.pipelinePotential)}</td>
        <td className="tabular">{money(outcome.value.realisedRevenue)}</td>
        <td className="tabular">
          {outcome.value.estimatedTimeSavedHours != null ? `${outcome.value.estimatedTimeSavedHours}h` : "—"}
        </td>
        <td className="muted">{formatDateTime(outcome.updatedAt)}</td>
      </tr>
      {outcome.status === "completed" ? (
        <tr>
          <td colSpan={6}>
            <ValueRecordForm state={state} outcome={outcome} />
          </td>
        </tr>
      ) : null}
    </>
  );
}

function ValueRecordForm({ state, outcome }: { state: CrmState; outcome: PulseOutcome }) {
  const { toast } = useWorkspace();
  const [hours, setHours] = useState(outcome.value.estimatedTimeSavedHours?.toString() ?? "");
  const [pipeline, setPipeline] = useState(outcome.value.pipelinePotential?.toString() ?? "");
  const [benefit, setBenefit] = useState(outcome.value.qualitativeBenefit ?? "");
  const [notes, setNotes] = useState("");
  const reqId = outcome.value.sourceEntityIds.find((id) => id.startsWith("req_")) ?? null;
  const canRealise = requirementHasConfirmedAssignment(state, reqId);
  const alreadyValued =
    outcome.value.realisedRevenue != null ||
    outcome.value.pipelinePotential != null ||
    outcome.value.estimatedTimeSavedHours != null ||
    Boolean(outcome.value.qualitativeBenefit);

  if (alreadyValued) {
    return (
      <p className="muted">
        Value already attributed for this insight. Task completion stays separate from commercial figures.
      </p>
    );
  }

  return (
    <div className="form-grid" style={{ maxWidth: 720 }}>
      <p className="muted">
        Record measurable value only with supporting evidence. Pulse will not invent a placement or day-rate revenue.
      </p>
      <label className="field">
        <span>Qualitative benefit / evidence</span>
        <input className="input" value={benefit} onChange={(event) => setBenefit(event.target.value)} placeholder="What improved, and which records support it?" />
      </label>
      <div className="form-row">
        <label className="field">
          <span>Time saved (hours)</span>
          <input className="input" type="number" min={0} step={0.5} value={hours} onChange={(event) => setHours(event.target.value)} />
        </label>
        <label className="field">
          <span>Pipeline potential (£)</span>
          <input className="input" type="number" min={0} value={pipeline} onChange={(event) => setPipeline(event.target.value)} />
        </label>
      </div>
      {!canRealise ? (
        <p className="muted">Realised revenue is unavailable — no confirmed assignment exists on the linked requirement.</p>
      ) : null}
      <label className="field">
        <span>Attribution note</span>
        <input className="input" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Optional note stored with the outcome" />
      </label>
      <Button
        size="small"
        onClick={() => {
          if (!benefit.trim() && !hours && !pipeline) {
            toast("Add evidence or a measured figure before recording value", "info");
            return;
          }
          const ok = crm.recordPulseValue({
            insightId: outcome.insightId,
            estimatedTimeSavedHours: hours ? Number(hours) : null,
            pipelinePotential: pipeline ? Number(pipeline) : null,
            realisedRevenue: null,
            qualitativeBenefit: benefit.trim() || null,
            notes: notes.trim() || "DEMO — value recorded separately from task completion",
            sourceEntityIds: outcome.value.sourceEntityIds,
          });
          toast(ok ? "Value recorded against the Pulse outcome" : "Complete the action before recording value");
        }}
      >
        Record value
      </Button>
    </div>
  );
}
