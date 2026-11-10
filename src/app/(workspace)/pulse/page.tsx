"use client";

import Link from "next/link";
import { useMemo } from "react";
import Button from "@/components/ui/Button";
import { EmptyState, SkeletonRows, useNow, useWorkspaceData } from "@/components/ui/bits";
import AskPulseChat from "@/components/pulse/AskPulseChat";
import InsightCard from "@/components/pulse/InsightCard";
import PulseSubnav from "@/components/pulse/PulseSubnav";
import { getPulseSnapshot } from "@/lib/pulse-adapter";
import { TESSIANT_KNOWLEDGE_BLOCKS, KNOWLEDGE_BLOCK_INITIALS } from "@/lib/tessiant-knowledge";
import { activeAssignments, placementsThisMonth } from "@/lib/tessiant-insights";
import { generateTessiantInsights, networkMix, placementFunnel } from "@/lib/tessiant-pulse-rules";
import styles from "./pulse.module.css";

export default function PulseCockpitPage() {
  const { state } = useWorkspaceData();
  const now = useNow();

  const insights = useMemo(() => (state ? generateTessiantInsights(state, now || Date.now()) : []), [state, now]);
  const pendingAll = insights.filter((item) => item.reviewStatus === "pending");
  const pending = pendingAll.slice(0, 3);
  const mix = useMemo(() => (state ? networkMix(state) : null), [state]);
  const funnel = useMemo(() => (state ? placementFunnel(state) : null), [state]);
  const snapshot = useMemo(() => (state ? getPulseSnapshot(state) : null), [state]);
  const activeCount = state ? activeAssignments(state).length : 0;
  const monthPlacements = state ? placementsThisMonth(state, now ? new Date(now) : new Date()).length : 0;
  const deployed = state ? new Set(activeAssignments(state).map((item) => item.associateId)).size : 0;

  if (!state || !state.tessiant || !mix || !funnel || !snapshot) {
    return (
      <div className="page">
        <SkeletonRows rows={5} height={90} />
      </div>
    );
  }

  const maxSector = Math.max(1, ...Object.values(mix.bySector));
  const maxStage = Math.max(1, ...funnel.stages.map((row) => row.count));
  const utilisation = mix.verifiedAvailable + deployed > 0 ? Math.round((deployed / (mix.verifiedAvailable + deployed)) * 100) : 0;

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <div className={styles.context}>
            <span className="chip chip-ai">Qiko Pulse</span>
          </div>
          <h1>Pulse</h1>
          <p className="subtitle">Insights, decisions and recommended actions across Tessiant.</p>
        </div>
        <div className="page-actions">
          <AskPulseChat state={state} realised={snapshot.financials.realised} />
          <Link href="/pulse/insights">
            <Button icon="sparkles">All insights</Button>
          </Link>
        </div>
      </header>

      <PulseSubnav />

      <section className={styles.kpis} aria-label="Pulse KPIs">
        <Link href="/staffing/associates" className={styles.kpi}>
          <span>Total Associate Network</span>
          <b className="tabular">{mix.networkTotal}</b>
          <small>Illustrative network total · sample {mix.sampleSize}</small>
        </Link>
        <Link href="/staffing/associates?view=available_now" className={styles.kpi}>
          <span>Verified Available Capacity</span>
          <b className="tabular">{mix.verifiedAvailable}</b>
          <small>Workspace sample · verified + available</small>
        </Link>
        <Link href="/staffing/requirements?view=open" className={styles.kpi}>
          <span>Open Client Requirements</span>
          <b className="tabular">{snapshot.requirements.open}</b>
          <small>Active workspace records</small>
        </Link>
        <Link href="/staffing/placements?view=active" className={styles.kpi}>
          <span>Active Assignments</span>
          <b className="tabular">{activeCount}</b>
          <small>Confirmed live deployments</small>
        </Link>
        <Link href="/staffing/placements" className={styles.kpi}>
          <span>Placements This Month</span>
          <b className="tabular">{monthPlacements}</b>
          <small>From placement dates in CRM</small>
        </Link>
        <Link href="/pulse/insights" className={styles.kpi}>
          <span>Insights Awaiting Review</span>
          <b className="tabular">{pendingAll.length}</b>
          <small>Pending Tessiant signals</small>
        </Link>
        <Link href="/pulse/value" className={styles.kpi}>
          <span>Value Generated</span>
          <b className="tabular">£{snapshot.financials.realised.toLocaleString("en-GB")}</b>
          <small>Realised only · not pipeline or agreed</small>
        </Link>
        <div className={styles.kpi}>
          <span>Assignment Utilisation</span>
          <b className="tabular">{utilisation}%</b>
          <small>
            Deployed {deployed} · verified available {mix.verifiedAvailable}
          </small>
        </div>
      </section>

      <section className={styles.split}>
        <article className="card">
          <div className="card-head">
            <div>
              <h2>Decisions waiting on you</h2>
              <p className="card-sub">Priority Tessiant signals — review, then accept into To-Dos.</p>
            </div>
            <Link href="/pulse/insights" className="text-link">
              View all ({pendingAll.length})
            </Link>
          </div>
          <div className="card-body">
            {pending.length === 0 ? (
              <EmptyState title="No pending insights" icon="checkCircle">
                Reset demo data in Settings if you want to replay the review loop.
              </EmptyState>
            ) : (
              pending.map((insight) => <InsightCard key={insight.id} insight={insight} compact />)
            )}
          </div>
        </article>

        <div>
          <article className="card">
            <div className="card-head">
              <div>
                <h2>Knowledge blocks</h2>
                <p className="card-sub">Tessiant intelligence modules.</p>
              </div>
              <Link href="/pulse/knowledge" className="text-link">
                Browse
              </Link>
            </div>
            <div className="card-body">
              <ul className={styles.knowledgeList}>
                {TESSIANT_KNOWLEDGE_BLOCKS.map((block) => (
                  <li key={block.id}>
                    <Link href={`/pulse/knowledge/${block.id}`} className={styles.knowledgeHero} style={{ textDecoration: "none", color: "inherit" }}>
                      <span className={styles.knowledgeInitials}>{KNOWLEDGE_BLOCK_INITIALS[block.id] ?? "QP"}</span>
                      <span>
                        <b>{block.title}</b>
                        <span className="muted" style={{ display: "block", marginTop: 2 }}>
                          {block.purpose}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </article>
          <div style={{ marginTop: 14 }}>
            <AskPulseChat state={state} realised={snapshot.financials.realised} embedded />
          </div>
        </div>
      </section>

      <section className={styles.charts}>
        <article className="card">
          <div className="card-head">
            <div>
              <h2>Network composition</h2>
              <p className="card-sub">
                Sample of {mix.sampleSize} associates by role and sector — not the illustrative {mix.networkTotal} total.
              </p>
            </div>
          </div>
          <div className="card-body">
            {Object.entries(mix.byRole).map(([role, count]) => (
              <div key={role} className={styles.barRow}>
                <span>{role}</span>
                <div className={styles.barTrack}>
                  <div className={styles.barFill} style={{ width: `${(count / mix.sampleSize) * 100}%` }} />
                </div>
                <span className="tabular">{count}</span>
              </div>
            ))}
            <h3 className={styles.chartSectionLabel}>Skills &amp; sector coverage</h3>
            {Object.entries(mix.bySector)
              .sort((a, b) => b[1] - a[1])
              .slice(0, 6)
              .map(([sector, count]) => (
                <div key={sector} className={styles.barRow}>
                  <span>{sector}</span>
                  <div className={styles.barTrack}>
                    <div className={styles.barFill} style={{ width: `${(count / maxSector) * 100}%` }} />
                  </div>
                  <span className="tabular">{count}</span>
                </div>
              ))}
          </div>
        </article>

        <article className="card">
          <div className="card-head">
            <div>
              <h2>Placement performance</h2>
              <p className="card-sub">
                Current stage mix for {funnel.denominator} requirements — no fabricated time series.
              </p>
            </div>
          </div>
          <div className="card-body">
            {funnel.stages.map((row) => (
              <div key={row.stage} className={styles.barRow}>
                <span>{row.stage}</span>
                <div className={styles.barTrack}>
                  <div className={styles.barFill} style={{ width: `${(row.count / maxStage) * 100}%` }} />
                </div>
                <span className="tabular">{row.count}</span>
              </div>
            ))}
            <h3 className={styles.chartSectionLabel}>Commercial posture</h3>
            <div className={styles.valueGrid}>
              <div className={styles.valueCard} data-kind="pipeline">
                <h3>Pipeline potential</h3>
                <b className="tabular">£{snapshot.financials.pipeline.toLocaleString("en-GB")}</b>
              </div>
              <div className={styles.valueCard} data-kind="agreed">
                <h3>Agreed</h3>
                <b className="tabular">£{snapshot.financials.agreed.toLocaleString("en-GB")}</b>
              </div>
              <div className={styles.valueCard} data-kind="realised">
                <h3>Realised</h3>
                <b className="tabular">£{snapshot.financials.realised.toLocaleString("en-GB")}</b>
              </div>
            </div>
          </div>
        </article>
      </section>
    </div>
  );
}
