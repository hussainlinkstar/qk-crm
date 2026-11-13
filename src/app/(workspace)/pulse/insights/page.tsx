"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import Select from "@/components/ui/Select";
import { EmptyState, SkeletonRows, useNow, useWorkspaceData } from "@/components/ui/bits";
import AskPulseChat from "@/components/pulse/AskPulseChat";
import InsightCard from "@/components/pulse/InsightCard";
import PulseShell from "@/components/pulse/PulseShell";
import PulseSubnav from "@/components/pulse/PulseSubnav";
import { getPulseSnapshot } from "@/lib/pulse-adapter";
import { KNOWLEDGE_BLOCK_INITIALS, TESSIANT_KNOWLEDGE_BLOCKS } from "@/lib/tessiant-knowledge";
import { generateTessiantInsights } from "@/lib/tessiant-pulse-rules";
import type { InsightReviewStatus, KnowledgeBlockId, TessiantInsight } from "@/lib/tessiant-pulse-types";
import styles from "../pulse.module.css";

const BLOCK_LABEL: Record<string, string> = {
  network: "Network",
  augmentation: "Placement",
  commercial: "Commercial",
  capability: "Capability",
};

export default function PulseInsightsPage() {
  const { state } = useWorkspaceData();
  const now = useNow();
  const [block, setBlock] = useState<KnowledgeBlockId | "">("");
  const [status, setStatus] = useState<InsightReviewStatus | "">("pending");

  const allInsights = useMemo(() => (state ? generateTessiantInsights(state, now) : []), [state, now]);
  const snapshot = useMemo(() => (state ? getPulseSnapshot(state) : null), [state]);

  const insights = useMemo(() => {
    return allInsights.filter((item) => {
      if (block && item.knowledgeBlockId !== block) return false;
      if (status && item.reviewStatus !== status) return false;
      return true;
    });
  }, [allInsights, block, status]);

  const groups = useMemo(() => {
    const blocks = block ? TESSIANT_KNOWLEDGE_BLOCKS.filter((item) => item.id === block) : TESSIANT_KNOWLEDGE_BLOCKS;
    return blocks
      .map((item) => ({
        block: item,
        items: insights.filter((insight) => insight.knowledgeBlockId === item.id),
      }))
      .filter((group) => group.items.length > 0);
  }, [block, insights]);

  if (!state || !snapshot) {
    return (
      <PulseShell>
        <div className={styles.pulsePageExact}>
          <SkeletonRows rows={4} height={80} />
        </div>
      </PulseShell>
    );
  }

  return (
    <PulseShell>
      <div className={styles.pulsePageExact} data-view="insights">
        <header className={styles.pulseHeadExact}>
          <div className={styles.pulseHeadCopyExact}>
            <h1>Insight review</h1>
            <p>Priority Tessiant signals with recommended next steps. Open Review for evidence and rule detail.</p>
          </div>
          <div className={styles.pulseHeadToolsExact}>
            <AskPulseChat state={state} realised={snapshot.financials.realised} />
          </div>
        </header>

        <PulseSubnav />

        <section className={`${styles.cardExact} ${styles.insightsFilterCard}`}>
          <div className={styles.insightsFilters}>
            <Select
              className="input"
              value={block}
              onChange={(e) => setBlock(e.target.value as KnowledgeBlockId | "")}
              aria-label="Filter knowledge block"
            >
              <option value="">All blocks</option>
              {TESSIANT_KNOWLEDGE_BLOCKS.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title}
                </option>
              ))}
            </Select>
            <Select
              className="input"
              value={status}
              onChange={(e) => setStatus(e.target.value as InsightReviewStatus | "")}
              aria-label="Filter review status"
            >
              <option value="">All statuses</option>
              <option value="pending">Pending</option>
              <option value="accepted">Accepted</option>
              <option value="rejected">Rejected</option>
            </Select>
            <p className={styles.insightsCount}>
              {insights.length} insight{insights.length === 1 ? "" : "s"}
              {groups.length > 1 ? ` · ${groups.length} blocks` : ""}
            </p>
          </div>
        </section>

        {insights.length === 0 ? (
          <section className={styles.cardExact}>
            <div className={styles.kbCardBody}>
              <EmptyState title="No insights match filters" icon="sparkles">
                Clear a filter or open a knowledge block to see grounded Tessiant signals.
              </EmptyState>
            </div>
          </section>
        ) : (
          <div className={styles.insightsBlockStack} aria-label="Insights by knowledge block">
            {groups.map(({ block: kb, items }) => (
              <InsightBlockGroup key={kb.id} blockId={kb.id} title={kb.title} purpose={kb.purpose} items={items} />
            ))}
          </div>
        )}
      </div>
    </PulseShell>
  );
}

function InsightBlockGroup({
  blockId,
  title,
  purpose,
  items,
}: {
  blockId: KnowledgeBlockId;
  title: string;
  purpose: string;
  items: TessiantInsight[];
}) {
  return (
    <section className={`${styles.cardExact} ${styles.insightsBlock}`} aria-label={`${title} insights`}>
      <div className={styles.insightsBlockHead}>
        <span className={styles.knowledgeInitials}>{KNOWLEDGE_BLOCK_INITIALS[blockId] ?? "QP"}</span>
        <div className={styles.insightsBlockCopy}>
          <p className={styles.monoKickerExact}>{BLOCK_LABEL[blockId] ?? "Knowledge"} block</p>
          <div className={styles.insightsBlockTitleRow}>
            <h2>{title}</h2>
            <span className={styles.insightsBlockBadge}>
              {items.length} insight{items.length === 1 ? "" : "s"}
            </span>
          </div>
          <p>{purpose}</p>
        </div>
        <Link href={`/pulse/knowledge/${blockId}`} className={styles.mapLinkExact}>
          Open block
        </Link>
      </div>
      <div className={styles.insightsBlockBody}>
        {items.map((insight) => (
          <InsightCard key={insight.id} insight={insight} />
        ))}
      </div>
    </section>
  );
}
