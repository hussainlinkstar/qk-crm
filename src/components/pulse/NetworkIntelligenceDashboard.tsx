"use client";

import { useMemo } from "react";
import InsightCard from "@/components/pulse/InsightCard";
import BlockKnowledgeMap from "@/components/pulse/BlockKnowledgeMap";
import PulseLiveChart from "@/components/pulse/PulseLiveChart";
import { EmptyState } from "@/components/ui/bits";
import { networkIntelligenceView, networkKnowledgeBubbles } from "@/lib/network-intelligence";
import type { TessiantInsight } from "@/lib/tessiant-pulse-types";
import type { CrmState } from "@/lib/types";
import styles from "@/app/(workspace)/pulse/pulse.module.css";

const PULSE_SKY = "#0ea5e9";
const PULSE_INDIGO = "#4f46e5";
const PULSE_TEAL = "#0891b2";

export default function NetworkIntelligenceDashboard({
  state,
  insights,
}: {
  state: CrmState;
  insights: TessiantInsight[];
}) {
  const view = useMemo(() => networkIntelligenceView(state), [state]);
  const bubbles = useMemo(() => networkKnowledgeBubbles(state, insights), [state, insights]);
  const findings = useMemo(() => {
    const pending = insights.filter((item) => item.reviewStatus === "pending");
    const rest = insights.filter((item) => item.reviewStatus !== "pending");
    return [...pending, ...rest].slice(0, 3);
  }, [insights]);

  return (
    <div className={styles.networkDash}>
      <BlockKnowledgeMap blockTitle="Network Intelligence" bubbles={bubbles} insights={insights} />

      <p className={styles.networkBanner}>{view.sampleNote}</p>

      <section className={styles.kpis} aria-label="Network headline metrics">
        <div className={styles.kpi}>
          <span>Verified available associates</span>
          <b className="tabular">{view.verifiedAvailable}</b>
          <small>In the seeded sample of {view.sampleSize}</small>
        </div>
        <div className={styles.kpi}>
          <span>Available capacity against open demand</span>
          <b className="tabular">
            {view.verifiedAvailable}
            <span className={styles.kpiOver}> / {view.openDemandHeadcount}</span>
          </b>
          <small>Verified available vs open headcount in sample</small>
        </div>
        <div className={styles.kpi}>
          <span>Requirements with insufficient coverage</span>
          <b className="tabular">{view.thinCoverageCount}</b>
          <small>
            Of {view.openRequirementCount} open · fewer than 2 verified available matches
          </small>
        </div>
      </section>

      <section aria-label="Network analytics">
        <div className={styles.analyticsSectionHead}>
          <h3>Network analytics</h3>
          <p>Skills in the sample and open demand against verified available capacity.</p>
        </div>
        <div className={styles.chartsGridExact}>
          <article className={`${styles.cardExact} ${styles.pulseChartCardExact}`}>
            <div className={styles.pulseChartHeadExact}>
              <div>
                <h2 className={styles.pulseChartTitleExact}>Skills in the sample</h2>
                <p className={styles.pulseChartSubExact}>
                  Distribution across {view.sampleSize} seeded profiles — not the {view.networkTotal} illustrative total.
                </p>
              </div>
              <div className={styles.pulseChartSideExact}>
                <div className={styles.pulseChartTotalExact}>
                  <strong>{view.sampleSize}</strong>
                  <span>Sample profiles</span>
                </div>
              </div>
            </div>
            <div className={styles.pulseChartBodyExact}>
              {view.skillSeries.length ? (
                <PulseLiveChart kind="bar" series={view.skillSeries} color={PULSE_SKY} />
              ) : (
                <EmptyState title="No skills recorded on the sample" icon="sparkles" />
              )}
            </div>
          </article>
          <article className={`${styles.cardExact} ${styles.pulseChartCardExact}`}>
            <div className={styles.pulseChartHeadExact}>
              <div>
                <h2 className={styles.pulseChartTitleExact}>Demand vs verified available</h2>
                <p className={styles.pulseChartSubExact}>Open must-have skills against verified available associates in sample.</p>
              </div>
              <div className={styles.pulseChartSideExact}>
                <div className={styles.pulseChartTotalExact}>
                  <strong>
                    {view.verifiedAvailable}/{view.openDemandHeadcount}
                  </strong>
                  <span>Available vs demand</span>
                </div>
              </div>
            </div>
            <div className={styles.pulseChartBodyExact}>
              {view.demandSeries.length ? (
                <>
                  <PulseLiveChart
                    kind="bar"
                    series={view.demandSeries}
                    compare={view.capacitySeries}
                    color={PULSE_INDIGO}
                    compareColor={PULSE_TEAL}
                  />
                  <div className={styles.chartLegend} style={{ padding: "0 .9rem .35rem" }}>
                    <span>
                      <i style={{ background: PULSE_INDIGO }} /> Open demand
                    </span>
                    <span>
                      <i style={{ background: PULSE_TEAL }} /> Verified available
                    </span>
                  </div>
                </>
              ) : (
                <EmptyState title="No open skill demand in sample" icon="sparkles" />
              )}
            </div>
          </article>
        </div>
      </section>

      <section className={`card ${styles.pulseCard}`} aria-label="Key findings">
        <div className="card-head">
          <div>
            <h2>Key findings</h2>
            <p className="card-sub">Up to three live Pulse recommendations. Review opens the original insight.</p>
          </div>
        </div>
        <div className="card-body">
          {findings.length === 0 ? (
            <EmptyState title="No open network recommendations" icon="checkCircle">
              Missing inputs suppress rules rather than inventing numbers.
            </EmptyState>
          ) : (
            findings.map((insight) => (
              <InsightCard key={insight.id} insight={insight} compact reviewOnClick />
            ))
          )}
        </div>
      </section>
    </div>
  );
}
