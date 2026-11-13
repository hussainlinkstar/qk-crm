"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Button from "@/components/ui/Button";
import CountUp from "@/components/ui/CountUp";
import Icon from "@/components/ui/Icon";
import IconTile from "@/components/ui/IconTile";
import { useWorkspace } from "@/components/shell/WorkspaceContext";
import { crm } from "@/lib/crm-store";
import { sweepPlan } from "@/lib/sourcing-sweep";
import type { ClientRequirement } from "@/lib/tessiant-types";
import type { CrmState } from "@/lib/types";
import { plural } from "@/lib/format";
import { verifiedAvailableMatchCount } from "@/lib/tessiant-insights";
import styles from "@/app/(workspace)/staffing/staffing.module.css";

type Phase = "idle" | "running" | "done";

/**
 * The resource manager's manual trawl, run as one visible pass: internal CVs, first-degree network,
 * second-degree network, LinkedIn. Recorded sources use real sample counts; the outer two are
 * showcase figures and say so. On completion the matcher runs, so results land in Recommended matches.
 */
export default function SourcingSweep({ state, requirement, runKey = 0 }: { state: CrmState; requirement: ClientRequirement; runKey?: number }) {
  const { toast } = useWorkspace();
  const plan = useMemo(() => sweepPlan(state, requirement), [state, requirement]);
  const [phase, setPhase] = useState<Phase>("idle");
  // Snapshot of the shortlist before the sweep, so the result can be shown as before and after.
  const [before, setBefore] = useState<{ candidates: number; verified: number; sources: number } | null>(null);
  const [view, setView] = useState<"before" | "after">("after");
  const [activeStep, setActiveStep] = useState(-1);
  const timers = useRef<number[]>([]);
  const lastRunKey = useRef(runKey);

  const clearTimers = () => {
    for (const id of timers.current) window.clearTimeout(id);
    timers.current = [];
  };

  const run = () => {
    clearTimers();
    setBefore({
      candidates: (state.tessiant?.candidates ?? []).filter((item) => item.requirementId === requirement.id).length,
      verified: verifiedAvailableMatchCount(state, requirement.id),
      sources: 1,
    });
    setView("after");
    setPhase("running");
    setActiveStep(0);
    let at = 0;
    plan.steps.forEach((step, index) => {
      at += step.duration;
      const next = index + 1;
      timers.current.push(
        window.setTimeout(() => {
          if (next < plan.steps.length) {
            setActiveStep(next);
          } else {
            setActiveStep(plan.steps.length);
            setPhase("done");
            const added = crm.findMatches(requirement.id);
            toast(added > 0 ? `Sweep complete — ${plural(added, "new candidate")} suggested` : "Sweep complete — matches refreshed");
          }
        }, at),
      );
    });
  };

  // The header "Find Matches" button bumps runKey; run once per bump.
  useEffect(() => {
    if (runKey !== lastRunKey.current) {
      lastRunKey.current = runKey;
      run();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runKey]);

  useEffect(() => clearTimers, []);

  const stateFor = (index: number): "idle" | "running" | "done" => {
    if (phase === "idle") return "idle";
    if (index < activeStep) return "done";
    if (index === activeStep && phase === "running") return "running";
    return phase === "done" ? "done" : "idle";
  };

  return (
    <section className={styles.sweep} aria-labelledby="sweep-title" aria-live="polite" data-tour="sweep">
      <div className={styles.sweepHead}>
        <div className={styles.recHeadCopy}>
          <IconTile name="search" tone="qiko" size="lg" />
          <div>
            <p className="kicker kicker-qiko">Qiko · Sourcing sweep</p>
            <h2 id="sweep-title">Trawl the CVs, the network and LinkedIn in one pass</h2>
            <p>
              The step a resource manager does by hand. Qiko checks every source against the brief and lands the people worth a look in Recommended matches below.
            </p>
          </div>
        </div>
        <div className={styles.sweepTools}>
          {phase === "done" ? (
            <Button size="small" variant="secondary" icon="refresh" onClick={run}>
              Run again
            </Button>
          ) : (
            <Button size="small" variant="qiko" icon="zap" onClick={run} disabled={phase === "running"} loading={phase === "running"}>
              {phase === "running" ? "Sweeping…" : "Run sourcing sweep"}
            </Button>
          )}
        </div>
      </div>

      <ol className={styles.sweepSteps}>
        {plan.steps.map((step, index) => {
          const stepState = stateFor(index);
          return (
            <li key={step.key} className={styles.sweepStep} data-state={stepState} style={{ "--sweep-duration": `${step.duration}ms` } as React.CSSProperties}>
              <div className={styles.sweepStepTop}>
                <IconTile name={step.icon} tone={stepState === "done" ? "success" : step.tone} size="sm" />
                <b>{step.label}</b>
                <small>{step.basis === "demo" ? "estimate" : "recorded"}</small>
              </div>
              <div className={styles.sweepCount}>
                <b className="tabular">{stepState === "idle" ? "—" : <CountUp value={step.count} duration={step.duration} />}</b>
                <span>{step.detail.replace(/^\d+\s/, "")}</span>
              </div>
              <span className={styles.sweepTrack} aria-hidden="true">
                <span className={styles.sweepFill} />
              </span>
              <span className={styles.sweepStatus}>
                {stepState === "running" ? (
                  <>
                    <i className={styles.sweepPulse} /> Searching
                  </>
                ) : stepState === "done" ? (
                  <>
                    <Icon name="check" size={11} strokeWidth={2.6} /> Checked
                  </>
                ) : (
                  "Waiting"
                )}
              </span>
            </li>
          );
        })}
      </ol>

      {phase === "done" ? (
        <div className={styles.sweepResult}>
          <div className={styles.sweepResultCopy}>
            <b>
              {plan.profilesScanned.toLocaleString("en-GB")} profiles checked · {plural(plan.shortlistable, "strong or good match", "strong or good matches")} ·{" "}
              {plan.verifiedAvailable} available now
            </b>
            <span>Results are in Recommended matches below with reasons, gaps and availability explained. Second-degree and LinkedIn figures are estimates.</span>
          </div>
          {before ? (
            <div className={styles.sweepBeforeAfter} aria-label="Shortlist before and after the sweep">
              <div className="segmented" role="group" aria-label="Before or after">
                <button type="button" aria-pressed={view === "before"} onClick={() => setView("before")}>
                  Before
                </button>
                <button type="button" aria-pressed={view === "after"} onClick={() => setView("after")}>
                  After
                </button>
              </div>
              {(() => {
                const after = {
                  candidates: (state.tessiant?.candidates ?? []).filter((item) => item.requirementId === requirement.id).length,
                  verified: verifiedAvailableMatchCount(state, requirement.id),
                  sources: plan.steps.length,
                };
                const shown = view === "before" ? before : after;
                return (
                  <ul className={styles.sweepBeforeAfterNums} data-view={view}>
                    <li>
                      <b className="tabular">
                        <CountUp value={shown.candidates} duration={400} />
                      </b>
                      <small>on the shortlist</small>
                    </li>
                    <li>
                      <b className="tabular">
                        <CountUp value={shown.verified} duration={400} />
                      </b>
                      <small>verified available</small>
                    </li>
                    <li>
                      <b className="tabular">
                        <CountUp value={shown.sources} duration={400} />
                      </b>
                      <small>sources checked</small>
                    </li>
                    <li>
                      <b className="tabular">{view === "before" ? `${plan.manualHours}h` : `${plan.sweepSeconds}s`}</b>
                      <small>{view === "before" ? "by hand" : "with Qiko"}</small>
                    </li>
                  </ul>
                );
              })()}
            </div>
          ) : null}
          <div className={styles.sweepCompare} aria-label="Manual effort compared with the sweep">
            <div>
              <b>{plan.manualHours}h</b>
              <small>by hand</small>
            </div>
            <Icon name="arrowRight" size={16} />
            <div data-tone="win">
              <b>{plan.sweepSeconds}s</b>
              <small>with Qiko</small>
            </div>
          </div>
        </div>
      ) : (
        <p className={styles.sweepNote}>
          Internal CVs and the first-degree network use recorded profiles. Second-degree and LinkedIn counts are estimates until a search connector is attached.
        </p>
      )}
    </section>
  );
}
