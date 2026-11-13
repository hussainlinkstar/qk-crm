"use client";

import Link from "next/link";
import { useMemo } from "react";
import { SkeletonRows, useNow, useWorkspaceData } from "@/components/ui/bits";
import AskPulseChat from "@/components/pulse/AskPulseChat";
import PulseShell from "@/components/pulse/PulseShell";
import PulseSubnav from "@/components/pulse/PulseSubnav";
import { getPulseSnapshot } from "@/lib/pulse-adapter";
import {
  getKnowledgeBlockLiveMetrics,
  KNOWLEDGE_BLOCK_INITIALS,
  summarizeBlockInsights,
  TESSIANT_KNOWLEDGE_BLOCKS,
} from "@/lib/tessiant-knowledge";
import { generateTessiantInsights, networkMix, placementFunnel } from "@/lib/tessiant-pulse-rules";
import styles from "../pulse.module.css";

const BLOCK_LABEL: Record<string, string> = {
  network: "Network",
  augmentation: "Placement",
  commercial: "Commercial",
  capability: "Capability",
};

const CARD_METRIC_LABEL: Record<string, string> = {
  "Verified available": "Available",
  "Capacity vs demand": "Capacity",
  "Thin coverage": "Thin gaps",
  "Open requirements": "Open",
  "In sourcing": "Sourcing",
  "In interview": "Interview",
  Accounts: "Accounts",
  "Single-owner risk": "Single owner",
  "Pipeline potential": "Pipeline",
  "Sectors covered": "Sectors",
  "Open demand": "Demand",
  "Verified capacity": "Verified",
};

export default function PulseKnowledgePage() {
  const { state } = useWorkspaceData();
  const now = useNow();

  const insights = useMemo(() => (state ? generateTessiantInsights(state, now) : []), [state, now]);
  const mix = useMemo(() => (state ? networkMix(state) : null), [state]);
  const funnel = useMemo(() => (state ? placementFunnel(state) : null), [state]);
  const snapshot = useMemo(() => (state ? getPulseSnapshot(state) : null), [state]);

  if (!state || !snapshot) {
    return (
      <PulseShell>
        <div className={styles.pulsePageExact}>
          <SkeletonRows rows={4} height={110} />
        </div>
      </PulseShell>
    );
  }

  return (
    <PulseShell>
      <div className={styles.pulsePageExact} data-view="knowledge">
        <header className={styles.pulseHeadExact}>
          <div className={styles.pulseHeadCopyExact}>
            <h1>Knowledge</h1>
            <p>
              Each block is a structured record of confirmed learnings. A learning is written here when an action is
              completed and measured. Open a card for the worker behind the numbers.
            </p>
          </div>
          <div className={styles.pulseHeadToolsExact}>
            <AskPulseChat state={state} realised={snapshot.financials.realised} />
          </div>
        </header>

        <PulseSubnav />

        <section className={styles.knowledgeGrid} aria-label="Knowledge blocks">
          {TESSIANT_KNOWLEDGE_BLOCKS.map((block) => {
            const blockInsights = insights.filter((item) => item.knowledgeBlockId === block.id);
            const counts = summarizeBlockInsights(blockInsights);
            const metrics = getKnowledgeBlockLiveMetrics(block.id, { mix, funnel, snapshot, state }).slice(0, 3);

            return (
              <Link key={block.id} href={`/pulse/knowledge/${block.id}`} className={styles.knowledgeCard}>
                <div className={styles.knowledgeTileHead}>
                  <span className={styles.knowledgeInitials}>{KNOWLEDGE_BLOCK_INITIALS[block.id] ?? "QP"}</span>
                  <div className={styles.knowledgeTileCopy}>
                    <p className={styles.monoKickerExact}>{BLOCK_LABEL[block.id] ?? block.owner} block</p>
                    <h2>{block.title}</h2>
                    <p className={styles.knowledgePurpose}>{block.purpose}</p>
                  </div>
                </div>
                <div className={styles.knowledgeTileMetrics}>
                  {metrics.map((metric) => (
                    <div key={metric.label}>
                      <b className="tabular">{metric.value}</b>
                      <span>{CARD_METRIC_LABEL[metric.label] ?? metric.label}</span>
                    </div>
                  ))}
                </div>
                <p className={styles.knowledgeTileFoot}>
                  Worker · {block.owner} · {counts.pending} pending
                </p>
              </Link>
            );
          })}
        </section>
      </div>
    </PulseShell>
  );
}
