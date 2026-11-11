"use client";

import { useMemo } from "react";
import InsightCard from "@/components/pulse/InsightCard";
import KnowledgeFlow from "@/components/pulse/KnowledgeFlow";
import PulseLiveChart from "@/components/pulse/PulseLiveChart";
import { EmptyState } from "@/components/ui/bits";
import { networkIntelligenceView } from "@/lib/network-intelligence";
import type { KnowledgeBlockDefinition, TessiantInsight } from "@/lib/tessiant-pulse-types";
import type { CrmState } from "@/lib/types";
import styles from "@/app/(workspace)/pulse/pulse.module.css";

const PULSE_INDIGO = "#4f46e5";
const PULSE_LILAC = "#818cf8";

export default function NetworkIntelligenceDashboard({
  state,
  insights,
  block,
}: {
  state: CrmState;
  insights: TessiantInsight[];
  block: KnowledgeBlockDefinition;
}) {
  const view = useMemo(() => networkIntelligenceView(state), [state]);
  const findings = useMemo(() => {
    const pending = insights.filter((item) => item.reviewStatus === "pending");
    const rest = insights.filter((item) => item.reviewStatus !== "pending");
    return [...pending, ...rest].slice(0, 3);
  }, [insights]);

  return (
    <div className={styles.networkDash}>
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

      <section className={styles.charts} aria-label="Network visualisations">
        <article className={`card ${styles.pulseCard}`}>
          <div className="card-head">
            <div>
              <h2>Skills in the sample</h2>
              <p className="card-sub">Distribution across {view.sampleSize} seeded profiles — not the {view.networkTotal} illustrative total.</p>
            </div>
          </div>
          <div className="card-body">
            {view.skillSeries.length ? (
              <PulseLiveChart kind="bar" series={view.skillSeries} color={PULSE_INDIGO} />
            ) : (
              <EmptyState title="No skills recorded on the sample" icon="sparkles" />
            )}
          </div>
        </article>
        <article className={`card ${styles.pulseCard}`}>
          <div className="card-head">
            <div>
              <h2>Demand vs verified available</h2>
              <p className="card-sub">Open must-have skills against verified available associates in sample.</p>
            </div>
          </div>
          <div className="card-body">
            {view.demandSeries.length ? (
              <>
                <PulseLiveChart
                  kind="bar"
                  series={view.demandSeries}
                  compare={view.capacitySeries}
                  color={PULSE_INDIGO}
                  compareColor={PULSE_LILAC}
                />
                <div className={styles.chartLegend}>
                  <span>
                    <i style={{ background: PULSE_INDIGO }} /> Open demand
                  </span>
                  <span>
                    <i style={{ background: PULSE_LILAC }} /> Verified available
                  </span>
                </div>
              </>
            ) : (
              <EmptyState title="No open skill demand in sample" icon="sparkles" />
            )}
          </div>
        </article>
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
              <InsightCard
                key={insight.id}
                insight={insight}
                compact
                reviewOnClick
              />
            ))
          )}
        </div>
      </section>

      <details className={styles.advanced}>
        <summary>Details / configuration</summary>
        <div className={styles.advancedBody}>
          <KnowledgeFlow blockTitle={block.title} />
          <div className={styles.advancedGrid} style={{ marginTop: 16 }}>
            <div>
              <h3 className={styles.sectionLabel}>Data sources</h3>
              <ul className={styles.plainList}>
                {block.dataSources.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className={styles.sectionLabel}>Required fields</h3>
              <ul className={styles.plainList}>
                {block.requiredFields.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className={styles.sectionLabel}>Business rules</h3>
              <ul className={styles.plainList}>
                {block.businessRules.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className={styles.sectionLabel}>Signal definitions</h3>
              <div className={styles.actions}>
                {block.signalDefinitions.map((item) => (
                  <span key={item} className="chip">
                    {item}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </details>
    </div>
  );
}
