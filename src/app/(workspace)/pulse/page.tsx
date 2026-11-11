"use client";

import Link from "next/link";
import { useMemo } from "react";
import { EmptyState, SkeletonRows, useNow, useWorkspaceData } from "@/components/ui/bits";
import InsightCard from "@/components/pulse/InsightCard";
import PulseLiveChart from "@/components/pulse/PulseLiveChart";
import PulseShell from "@/components/pulse/PulseShell";
import PulseSubnav from "@/components/pulse/PulseSubnav";
import { getPulseSnapshot } from "@/lib/pulse-adapter";
import { associateGrowthSeries, roleDistributionSeries } from "@/lib/pulse-overview-charts";
import {
  getKnowledgeBlockLiveMetrics,
  KNOWLEDGE_BLOCK_INITIALS,
  summarizeBlockInsights,
  TESSIANT_KNOWLEDGE_BLOCKS,
} from "@/lib/tessiant-knowledge";
import { generateTessiantInsights, networkMix, placementFunnel } from "@/lib/tessiant-pulse-rules";
import type { KnowledgeBlockId } from "@/lib/tessiant-pulse-types";
import styles from "./pulse.module.css";

function provingSeries(blockId: KnowledgeBlockId | undefined, state: NonNullable<ReturnType<typeof useWorkspaceData>["state"]>) {
  if (blockId === "augmentation" || blockId === "capability") return { kind: "bar" as const, series: roleDistributionSeries(state), color: "#4f46e5" };
  return { kind: "line" as const, series: associateGrowthSeries(state), color: "#4f46e5" };
}

export default function PulseCockpitPage() {
  const { state } = useWorkspaceData();
  const now = useNow();

  const insights = useMemo(() => (state ? generateTessiantInsights(state, now || Date.now()) : []), [state, now]);
  const pendingAll = useMemo(() => insights.filter((item) => item.reviewStatus === "pending"), [insights]);
  const mix = useMemo(() => (state ? networkMix(state) : null), [state]);
  const funnel = useMemo(() => (state ? placementFunnel(state) : null), [state]);
  const snapshot = useMemo(() => (state ? getPulseSnapshot(state) : null), [state]);
  const bestMove = pendingAll[0] ?? null;
  const chart = state ? provingSeries(bestMove?.knowledgeBlockId, state) : null;

  if (!state || !state.tessiant || !mix || !snapshot) {
    return (
      <PulseShell>
        <div className="page">
          <SkeletonRows rows={6} height={90} />
        </div>
      </PulseShell>
    );
  }

  return (
    <PulseShell>
      <div className={`page ${styles.pulsePage}`}>
        <header className="page-head">
          <div>
            <div className={styles.context}>
              <span className="chip chip-ai">Qiko Pulse</span>
            </div>
            <h1>Pulse</h1>
            <p className="subtitle">Best next move, then evidence. Accept creates work. Value measures it.</p>
          </div>
          <Link href="/pulse/value" className="text-link">
            Open Value
          </Link>
        </header>

        <PulseSubnav />

        <section className="card" aria-label="Today's best next move">
          <div className="card-head">
            <h2>Today&apos;s best next move</h2>
            <Link href="/pulse/insights" className="text-link">
              All insights
            </Link>
          </div>
          <div className="card-body">
            {bestMove ? (
              <InsightCard insight={bestMove} />
            ) : (
              <EmptyState title="No open decision" icon="checkCircle">
                All current Tessiant signals are reviewed.
              </EmptyState>
            )}
          </div>
        </section>

        {chart && bestMove ? (
          <section className="card" aria-label="Proving visual">
            <div className="card-head">
              <div>
                <h2>Why this move</h2>
                <p className="muted">{TESSIANT_KNOWLEDGE_BLOCKS.find((block) => block.id === bestMove.knowledgeBlockId)?.purpose}</p>
              </div>
            </div>
            <div className="card-body">
              <PulseLiveChart kind={chart.kind} series={chart.series} color={chart.color} />
            </div>
          </section>
        ) : null}

        <section>
          <div className="card-head" style={{ paddingLeft: 0 }}>
            <h2>Knowledge blocks</h2>
            <Link href="/pulse/knowledge" className="text-link">
              Open Knowledge
            </Link>
          </div>
          <div className={styles.knowledgeGrid}>
            {TESSIANT_KNOWLEDGE_BLOCKS.map((block) => {
              const blockInsights = insights.filter((item) => item.knowledgeBlockId === block.id);
              const counts = summarizeBlockInsights(blockInsights);
              const metric = getKnowledgeBlockLiveMetrics(block.id, { mix, funnel, snapshot, state })[0];
              const pending = blockInsights.find((item) => item.reviewStatus === "pending");
              return (
                <Link key={block.id} href={`/pulse/knowledge/${block.id}`} className={styles.knowledgeCard}>
                  <div className={styles.knowledgeCardTop}>
                    <span className={styles.knowledgeInitials}>{KNOWLEDGE_BLOCK_INITIALS[block.id] ?? "QP"}</span>
                    <span className="chip tabular">{counts.pending} pending</span>
                  </div>
                  <h2>{block.title}</h2>
                  <p className={styles.knowledgePurpose}>{block.purpose}</p>
                  {metric ? (
                    <p className="muted">
                      {metric.label}: <b className="tabular">{metric.value}</b>
                    </p>
                  ) : null}
                  {pending ? <p className={styles.knowledgePurpose}>{pending.title}</p> : null}
                </Link>
              );
            })}
          </div>
        </section>
      </div>
    </PulseShell>
  );
}
