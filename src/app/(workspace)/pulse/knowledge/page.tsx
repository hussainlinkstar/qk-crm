"use client";

import Link from "next/link";
import { useMemo } from "react";
import { SkeletonRows, useNow, useWorkspaceData } from "@/components/ui/bits";
import PulseSubnav from "@/components/pulse/PulseSubnav";
import { formatDate } from "@/lib/format";
import { getPulseSnapshot } from "@/lib/pulse-adapter";
import {
  getKnowledgeBlockLiveMetrics,
  KNOWLEDGE_BLOCK_INITIALS,
  summarizeBlockInsights,
  TESSIANT_KNOWLEDGE_BLOCKS,
} from "@/lib/tessiant-knowledge";
import { generateTessiantInsights, networkMix, placementFunnel } from "@/lib/tessiant-pulse-rules";
import styles from "../pulse.module.css";

export default function PulseKnowledgePage() {
  const { state } = useWorkspaceData();
  const now = useNow();

  const insights = useMemo(() => (state ? generateTessiantInsights(state, now || Date.now()) : []), [state, now]);
  const mix = useMemo(() => (state ? networkMix(state) : null), [state]);
  const funnel = useMemo(() => (state ? placementFunnel(state) : null), [state]);
  const snapshot = useMemo(() => (state ? getPulseSnapshot(state) : null), [state]);

  if (!state) {
    return (
      <div className="page">
        <SkeletonRows rows={4} height={110} />
      </div>
    );
  }

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <div className={styles.context}>
            <span className="chip chip-ai">Qiko Pulse</span>
            <span className="chip">Knowledge</span>
          </div>
          <h1>Knowledge</h1>
          <p className="subtitle">Each block is a Tessiant intelligence module with live metrics, insights and outcomes.</p>
        </div>
      </header>

      <PulseSubnav />

      <section className={styles.knowledgeGrid}>
        {TESSIANT_KNOWLEDGE_BLOCKS.map((block) => {
          const blockInsights = insights.filter((item) => item.knowledgeBlockId === block.id);
          const counts = summarizeBlockInsights(blockInsights);
          const metrics = getKnowledgeBlockLiveMetrics(block.id, { mix, funnel, snapshot, state }).slice(0, 3);
          const recent = blockInsights.filter((item) => item.reviewStatus === "pending").slice(0, 2);

          return (
            <Link key={block.id} href={`/pulse/knowledge/${block.id}`} className={styles.knowledgeCard} data-priority={block.priority}>
              <div className={styles.knowledgeCardTop}>
                <span className={styles.knowledgeInitials}>{KNOWLEDGE_BLOCK_INITIALS[block.id] ?? "QP"}</span>
                <span className="muted">{formatDate(block.updatedAt, true)}</span>
              </div>
              <h2>{block.title}</h2>
              <p className={styles.knowledgePurpose}>{block.purpose}</p>

              <div className={styles.knowledgeMetricStrip} aria-label={`${block.title} key metrics`}>
                {metrics.map((metric) => (
                  <div key={metric.label} className={styles.knowledgeMetric}>
                    <span>{metric.label}</span>
                    <b className="tabular">{metric.value}</b>
                    {metric.hint ? <small>{metric.hint}</small> : null}
                  </div>
                ))}
              </div>

              <div className={styles.knowledgeCardFoot}>
                <span>
                  <b className="tabular">{counts.pending}</b> pending · <b className="tabular">{counts.total}</b> insights
                </span>
                <span className="muted">{block.priority}</span>
              </div>
              {recent.length ? (
                <p className="muted" style={{ marginTop: 10, fontSize: 12.5 }}>
                  Recent: {recent.map((item) => item.title).join(" · ")}
                </p>
              ) : null}
            </Link>
          );
        })}
      </section>
    </div>
  );
}
