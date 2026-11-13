"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import Icon from "@/components/ui/Icon";
import IconTile from "@/components/ui/IconTile";
import { signalVisual } from "@/components/ui/signal-icons";
import FeedbackThumbs from "@/components/ui/FeedbackThumbs";
import styles from "@/app/(workspace)/sales/sales.module.css";

export interface InsightSignalItem {
  id: string;
  kind: string;
  title: string;
  detail: string;
  /** Third line, usually the record or evidence the signal rests on. */
  evidence?: string;
  actionLabel: string;
  href?: string;
  onClick?: () => void;
  /** Shown as a small status once the user has acted. */
  status?: string;
}

/**
 * The "Qiko" insight section used across Sales pages: a kicker, a title, a short summary,
 * then signal cards. Shows `initial` cards and folds the rest behind "View all" so a page
 * never opens with a wall of nine cards.
 */
export default function InsightSignals({
  title,
  summary,
  items,
  initial = 3,
  aside,
  emptyTitle,
}: {
  title: string;
  summary: string;
  items: InsightSignalItem[];
  initial?: number;
  /** Optional content on the right of the header, e.g. a chart link. */
  aside?: ReactNode;
  /** When set, the section still renders with this line when there are no signals. */
  emptyTitle?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  if (items.length === 0 && !emptyTitle) return null;
  const visible = expanded ? items : items.slice(0, initial);
  const hidden = items.length - visible.length;

  return (
    <section className={styles.growthSection} aria-label={title}>
      <div className={styles.growthHead}>
        <div className={styles.growthHeadCopy}>
          <IconTile name="sparkles" tone="qiko" size="lg" />
          <div>
            <p className="kicker kicker-qiko">Qiko</p>
            <h2>{title}</h2>
            <p className={styles.sourceSub}>{summary}</p>
          </div>
        </div>
        <div className={styles.growthHeadTools}>
          {aside}
          {items.length > initial ? (
            <button type="button" className={styles.viewAll} onClick={() => setExpanded((value) => !value)} aria-expanded={expanded}>
              {expanded ? "Show fewer" : `View all ${items.length}`}
              <Icon name={expanded ? "chevronLeft" : "chevronRight"} size={13} />
            </button>
          ) : null}
        </div>
      </div>
      {items.length === 0 ? (
        <p className={styles.growthEmpty}>
          <Icon name="checkCircle" size={14} /> {emptyTitle}
        </p>
      ) : (
        <div
          className={styles.growthGrid}
          data-expanded={expanded ? "true" : undefined}
          data-cols={String(Math.min(Math.max(visible.length, 1), 3))}
        >
          {visible.map((item, index) => {
            const visual = signalVisual(item.kind);
            const body = (
              <>
                <span className={styles.growthCardTop}>
                  <IconTile name={visual.icon} tone={visual.tone} size="sm" />
                  <span className={styles.growthKind}>{item.kind}</span>
                </span>
                <p className={styles.growthDetected}>{item.title}</p>
                <p className={styles.growthRisk}>{item.detail}</p>
                {item.evidence ? <p className={styles.growthEvidence}>{item.evidence}</p> : null}
                <p className={styles.growthActionLine}>
                  {item.actionLabel} <Icon name="arrowRight" size={12} />
                </p>
                {item.status ? <span className={styles.growthStatus}>{item.status}</span> : null}
              </>
            );
            const style = { animationDelay: `${Math.min(index, 8) * 45}ms` };
            return (
              <div key={item.id} className={`${styles.growthCardWrap} row-hover`}>
                {item.href ? (
                  <Link href={item.href} className={styles.growthCard} style={style}>
                    {body}
                  </Link>
                ) : (
                  <button type="button" className={styles.growthCard} style={style} onClick={item.onClick}>
                    {body}
                  </button>
                )}
                <span className={styles.growthFeedback}>
                  <FeedbackThumbs feedbackKey={`signal:${item.id}`} context="signal" compact />
                </span>
              </div>
            );
          })}
        </div>
      )}
      {!expanded && hidden > 0 ? (
        <p className={styles.growthMore}>
          {hidden} more {hidden === 1 ? "signal" : "signals"} folded away.
        </p>
      ) : null}
    </section>
  );
}
