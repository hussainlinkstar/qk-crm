"use client";

import { useMemo, useState } from "react";
import Select from "@/components/ui/Select";
import { EmptyState, SkeletonRows, useNow, useWorkspaceData } from "@/components/ui/bits";
import InsightCard from "@/components/pulse/InsightCard";
import PulseSubnav from "@/components/pulse/PulseSubnav";
import { TESSIANT_KNOWLEDGE_BLOCKS } from "@/lib/tessiant-knowledge";
import { generateTessiantInsights } from "@/lib/tessiant-pulse-rules";
import type { InsightReviewStatus, KnowledgeBlockId } from "@/lib/tessiant-pulse-types";
import styles from "../pulse.module.css";

export default function PulseInsightsPage() {
  const { state } = useWorkspaceData();
  const now = useNow();
  const [block, setBlock] = useState<KnowledgeBlockId | "">("");
  const [status, setStatus] = useState<InsightReviewStatus | "">("pending");

  const insights = useMemo(() => {
    if (!state) return [];
    return generateTessiantInsights(state, now || Date.now()).filter((item) => {
      if (block && item.knowledgeBlockId !== block) return false;
      if (status && item.reviewStatus !== status) return false;
      return true;
    });
  }, [state, now, block, status]);

  if (!state) {
    return (
      <div className="page">
        <SkeletonRows rows={4} height={80} />
      </div>
    );
  }

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <div className={styles.context}>
            <span className="chip chip-ai">Qiko Pulse</span>
            <span className="chip">Insights</span>
          </div>
          <h1>Insight review</h1>
          <p className="subtitle">Priority signals with recommended next steps. Open Review for evidence and rule detail.</p>
        </div>
      </header>

      <PulseSubnav />

      <section className="card">
        <div className="card-body">
          <div className={styles.actions}>
            <Select className="input" value={block} onChange={(e) => setBlock(e.target.value as KnowledgeBlockId | "")} aria-label="Filter knowledge block">
              <option value="">All blocks</option>
              {TESSIANT_KNOWLEDGE_BLOCKS.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title}
                </option>
              ))}
            </Select>
            <Select className="input" value={status} onChange={(e) => setStatus(e.target.value as InsightReviewStatus | "")} aria-label="Filter review status">
              <option value="">All statuses</option>
              <option value="pending">Pending</option>
              <option value="accepted">Accepted</option>
              <option value="rejected">Rejected</option>
            </Select>
          </div>
        </div>
      </section>

      <section className="card">
        <div className="card-head">
          <h2>
            {insights.length} insight{insights.length === 1 ? "" : "s"}
          </h2>
        </div>
        <div className="card-body">
          {insights.length === 0 ? (
            <EmptyState title="No insights match filters" icon="sparkles" />
          ) : (
            insights.map((insight) => <InsightCard key={insight.id} insight={insight} />)
          )}
        </div>
      </section>
    </div>
  );
}
