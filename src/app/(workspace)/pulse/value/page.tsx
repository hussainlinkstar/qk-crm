"use client";

import { useMemo, useState } from "react";
import Button from "@/components/ui/Button";
import { SkeletonRows, useNow, useWorkspaceData } from "@/components/ui/bits";
import { useWorkspace } from "@/components/shell/WorkspaceContext";
import AskPulseChat from "@/components/pulse/AskPulseChat";
import PulseShell from "@/components/pulse/PulseShell";
import PulseSubnav from "@/components/pulse/PulseSubnav";
import { crm } from "@/lib/crm-store";
import { getPulseSnapshot } from "@/lib/pulse-adapter";
import { formatDate, formatDateTime } from "@/lib/format";
import { insightIdFromTask, requirementHasConfirmedAssignment } from "@/lib/pulse-journey";
import { generateTessiantInsights } from "@/lib/tessiant-pulse-rules";
import { trackRecord } from "@/lib/qiko-track-record";
import CountUp from "@/components/ui/CountUp";
import type { PulseOutcome, PulseOutcomeStatus } from "@/lib/tessiant-pulse-types";
import type { CrmState } from "@/lib/types";
import styles from "../pulse.module.css";

const INITIAL_NOW = Date.now();

function money(value: number | null | undefined) {
  if (value == null) return "—";
  return `£${value.toLocaleString("en-GB")}`;
}

const STATUS_LABEL: Record<PulseOutcomeStatus, string> = {
  pending: "Pending",
  completed: "Completed",
  not_pursued: "Not pursued",
  unsuccessful: "Unsuccessful",
};

export default function PulseValuePage() {
  const { state } = useWorkspaceData();
  const { openTask } = useWorkspace();
  const now = useNow();
  const insights = useMemo(() => (state ? generateTessiantInsights(state, now) : []), [state, now]);

  if (!state?.tessiant) {
    return (
      <PulseShell>
        <div className={styles.pulsePageExact}>
          <SkeletonRows rows={3} height={90} />
        </div>
      </PulseShell>
    );
  }

  const snapshot = getPulseSnapshot(state);
  const outcomes = state.tessiant.pulse?.outcomes ?? [];
  const attributed = state.tessiant.pulse?.attributedSourceKeys ?? [];
  const completed = outcomes.filter((item) => item.status === "completed");
  const pendingOutcomes = outcomes.filter((item) => item.status === "pending");
  const closedOther = outcomes.filter((item) => item.status !== "completed" && item.status !== "pending");
  const outcomeInsightIds = new Set(outcomes.map((item) => item.insightId));
  const waitingTasks = state.tasks.filter((task) => {
    if (task.status !== "pending" && task.status !== "in_progress") return false;
    const insightId = insightIdFromTask(task.description);
    if (!insightId) return false;
    return !outcomeInsightIds.has(insightId);
  });

  const realisedFromOutcomes = outcomes.reduce((sum, item) => sum + (item.value.realisedRevenue ?? 0), 0);
  const pipelineFromOutcomes = outcomes.reduce((sum, item) => sum + (item.value.pipelinePotential ?? 0), 0);
  const hoursSaved = outcomes.reduce((sum, item) => sum + (item.value.estimatedTimeSavedHours ?? 0), 0);
  const record = trackRecord(state, now || INITIAL_NOW);
  const directSavings = outcomes.reduce((sum, item) => sum + (item.value.directCostSavings ?? 0), 0);
  const waitingCount = pendingOutcomes.length + waitingTasks.length;

  return (
    <PulseShell>
      <div className={styles.pulsePageExact} data-view="value">
        <header className={styles.pulseHeadExact}>
          <div className={styles.pulseHeadCopyExact}>
            <p className={styles.monoKickerExact} style={{ color: "#4f46e5", letterSpacing: "0.14em" }}>
              Value
            </p>
            <h1>What completed actions changed</h1>
            <p>
              Totals stay in separate categories. Pipeline is unclosed opportunity value, not revenue. Realised amounts
              appear only when a confirmed assignment exists.
            </p>
          </div>
          <div className={styles.pulseHeadToolsExact}>
            <AskPulseChat state={state} realised={snapshot.financials.realised} />
          </div>
        </header>

        <PulseSubnav />

        <section className={styles.valueKpis} aria-label="Pulse value totals">
          <article className={styles.valueKpi}>
            <span>Pipeline potential</span>
            <b className="tabular">{money(pipelineFromOutcomes)}</b>
            <span>Unclosed opportunity value from Pulse outcomes. Not revenue.</span>
          </article>
          <article className={styles.valueKpi}>
            <span>Realised revenue</span>
            <b className="tabular">{money(realisedFromOutcomes)}</b>
            <span>Confirmed amounts on Pulse outcomes only. SIA contribution is never booked here.</span>
          </article>
          <article className={styles.valueKpi}>
            <span>Time saved</span>
            <b className="tabular">{hoursSaved.toFixed(1)}h</b>
            <span>From completed actions. Direct cost savings recorded: {money(directSavings || null)}.</span>
          </article>
        </section>

        <section className={`${styles.valueKpis} ${styles.recordStrip}`} aria-label="Qiko's record">
          <article className={styles.valueKpi}>
            <span>Raised</span>
            <b className="tabular">
              <CountUp value={record.raised} />
            </b>
            <span>Signals and suggestions Qiko put in front of the team.</span>
          </article>
          <article className={styles.valueKpi}>
            <span>Acted on</span>
            <b className="tabular">
              <CountUp value={record.actedOn} />
            </b>
            <span>Tasks completed that started as a Qiko call.</span>
          </article>
          <article className={styles.valueKpi}>
            <span>Outcomes recorded</span>
            <b className="tabular">
              <CountUp value={record.outcomes} />
            </b>
            <span>Results written down after the work, not assumed.</span>
          </article>
          <article className={styles.valueKpi}>
            <span>Right-call rate</span>
            <b className="tabular">{record.accuracyPct === null ? "—" : <CountUp value={record.accuracyPct} format={(n) => `${Math.round(n)}%`} />}</b>
            <span>{record.feedbackTotal ? `${record.feedbackRight} right, ${record.feedbackPartly} partly of ${record.feedbackTotal} rated.` : "Rate a priority or signal in the workspace and the score starts here."}</span>
          </article>
        </section>

        <p className={styles.note}>
          Attribution keys prevent double counting ({attributed.length} stored). CRM agreed assignments{" "}
          {money(snapshot.financials.agreed)} are not Pulse revenue. Quoted day-rate context{" "}
          {money(snapshot.financials.pipeline)}.
        </p>

        <section className={styles.cardExact}>
          <div className={styles.valuePanelHead}>
            <h2>Pending</h2>
            <p>
              {waitingCount} accepted {waitingCount === 1 ? "item" : "items"} still waiting. Nothing here is realised
              revenue until it is completed and measured.
            </p>
          </div>
          {waitingCount === 0 ? (
            <p className={styles.valueEmpty}>Nothing is waiting. Accept an insight on Pulse and it lands here until it is measured.</p>
          ) : (
            <>
              {pendingOutcomes.map((outcome) => {
                const insight = insights.find((item) => item.id === outcome.insightId);
                return (
                  <OutcomeRow
                    key={outcome.id}
                    outcome={outcome}
                    insightTitle={insight?.title ?? "Pulse recommendation"}
                    state={state}
                    onOpen={outcome.taskId ? () => openTask(outcome.taskId!) : undefined}
                  />
                );
              })}
              {waitingTasks.map((task) => {
                const owner = state.members.find((member) => member.id === task.ownerId)?.name;
                return (
                  <div key={task.id} className={styles.valueRow}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <h3>{task.title}</h3>
                      <p>{task.status === "in_progress" ? "In progress" : "Not started"}</p>
                      <p className={styles.valueMeta}>
                        {task.status === "in_progress" ? "In progress" : "Not started"}
                        {task.due ? ` · due ${formatDate(task.due)}` : ""}
                        {owner ? ` · ${owner}` : ""}
                      </p>
                    </div>
                    <span className={styles.valueChip} data-status="pending">
                      Pending
                    </span>
                  </div>
                );
              })}
            </>
          )}
        </section>

        <section className={styles.cardExact}>
          <div className={styles.valuePanelHead}>
            <h2>Completed actions</h2>
            <p>Only measured outcomes appear here. Task completion stays separate from commercial figures.</p>
          </div>
          {completed.length === 0 && closedOther.length === 0 ? (
            <p className={styles.valueEmpty}>Complete an action on To-do to start a measurement.</p>
          ) : (
            [...completed, ...closedOther].map((outcome) => {
              const insight = insights.find((item) => item.id === outcome.insightId);
              return (
                <OutcomeRow
                  key={outcome.id}
                  outcome={outcome}
                  insightTitle={insight?.title ?? "Pulse recommendation"}
                  state={state}
                  showForm={outcome.status === "completed"}
                  onOpen={outcome.taskId ? () => openTask(outcome.taskId!) : undefined}
                />
              );
            })
          )}
        </section>
      </div>
    </PulseShell>
  );
}

function OutcomeRow({
  outcome,
  insightTitle,
  state,
  showForm = false,
  onOpen,
}: {
  outcome: PulseOutcome;
  insightTitle: string;
  state: CrmState;
  showForm?: boolean;
  onOpen?: () => void;
}) {
  const figures = [
    outcome.value.pipelinePotential != null ? `Pipeline ${money(outcome.value.pipelinePotential)}` : null,
    outcome.value.realisedRevenue != null ? `Realised ${money(outcome.value.realisedRevenue)}` : null,
    outcome.value.estimatedTimeSavedHours != null ? `${outcome.value.estimatedTimeSavedHours}h saved` : null,
  ].filter(Boolean);

  return (
    <div className={styles.valueRow}>
      <div style={{ minWidth: 0, flex: 1 }}>
        <h3>{insightTitle}</h3>
        <p>{outcome.summary}</p>
        {outcome.value.qualitativeBenefit ? <p>{outcome.value.qualitativeBenefit}</p> : null}
        <p className={styles.valueMeta}>
          Updated {formatDateTime(outcome.updatedAt)}
          {figures.length ? ` · ${figures.join(" · ")}` : ""}
        </p>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
        <span className={styles.valueChip} data-status={outcome.status}>
          {STATUS_LABEL[outcome.status]}
        </span>
        {onOpen ? (
          <button type="button" className={styles.kanbanGo} style={{ marginLeft: 0 }} onClick={onOpen}>
            Open
          </button>
        ) : null}
      </div>
      {showForm ? (
        <div className={styles.valueForm}>
          <ValueRecordForm state={state} outcome={outcome} />
        </div>
      ) : null}
    </div>
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
    return <p className={styles.valueMeta}>Value already attributed for this insight. Task completion stays separate from commercial figures.</p>;
  }

  return (
    <div className="form-grid" style={{ maxWidth: 720 }}>
      <p className="muted">Record measurable value only with supporting evidence. Pulse will not invent a placement or day-rate revenue.</p>
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
      {!canRealise ? <p className="muted">Realised revenue is unavailable — no confirmed assignment exists on the linked requirement.</p> : null}
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
            notes: notes.trim() || "Value recorded separately from task completion",
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
