"use client";

import type { EngagementInsight } from "@/lib/commercial-intelligence";
import styles from "@/app/(workspace)/sales/sales.module.css";

export default function CommercialInsights({
  label,
  title,
  summary,
  insights,
  onOpen,
}: {
  label: string;
  title: string;
  summary: string;
  insights: EngagementInsight[];
  onOpen: (insight: EngagementInsight) => void;
}) {
  if (insights.length === 0) return null;

  return (
    <section className={styles.growthSection} aria-label={label}>
      <div className={styles.growthHead}>
        <div>
          <p className="kicker">Qiko</p>
          <h2>{title}</h2>
          <p className={styles.sourceSub}>{summary}</p>
        </div>
      </div>
      <div className={styles.growthGrid}>
        {insights.slice(0, 3).map((insight) => (
          <button key={insight.id} type="button" className={styles.growthCard} onClick={() => onOpen(insight)}>
            <span className={styles.growthKind}>Engagement ending</span>
            <p className={styles.growthDetected}>{insight.title}</p>
            <p className={styles.growthEvidence}>{insight.detail}</p>
          </button>
        ))}
      </div>
    </section>
  );
}
