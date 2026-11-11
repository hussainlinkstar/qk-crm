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
          const metric = getKnowledgeBlockLiveMetrics(block.id, { mix, funnel, snapshot, state })[0];
          const pending = blockInsights.find((item) => item.reviewStatus === "pending");

          return (
            <Link key={block.id} href={`/pulse/knowledge/${block.id}`} className={styles.knowledgeCard} data-priority={block.priority}>
              <div className={styles.knowledgeCardTop}>
                <span className={styles.knowledgeInitials}>{KNOWLEDGE_BLOCK_INITIALS[block.id] ?? "QP"}</span>
                <span className="chip tabular">{counts.pending} pending</span>
              </div>
              <h2>{block.title}</h2>
              <p className={styles.knowledgePurpose}>{block.purpose}</p>
              {metric ? (
                <p>
                  {metric.label}: <b className="tabular">{metric.value}</b>
                  {metric.hint ? <span className="muted"> · {metric.hint}</span> : null}
                </p>
              ) : null}
              {pending ? <p className={styles.knowledgePurpose}>{pending.summary}</p> : null}
              <div className={styles.knowledgeCardFoot}>
                <span>
                  <b className="tabular">{counts.total}</b> insights
                </span>
                <span className="muted">{formatDate(block.updatedAt, true)}</span>
              </div>
            </Link>
          );
        })}
      </section>
    </div>
  );
}
