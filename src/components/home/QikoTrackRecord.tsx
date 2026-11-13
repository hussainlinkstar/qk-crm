"use client";

import Link from "next/link";
import { useMemo } from "react";
import type { CrmState } from "@/lib/types";
import { trackRecord } from "@/lib/qiko-track-record";
import { compactMoney } from "@/lib/home-tessiant";
import CountUp from "@/components/ui/CountUp";
import Icon from "@/components/ui/Icon";
import IconTile from "@/components/ui/IconTile";
import Spark from "@/components/ui/Spark";
import styles from "./QikoTrackRecord.module.css";

/**
 * Qiko's own scorecard on Home: what it raised, what the team acted on, what was recorded, and how
 * often the user said the call was right. Every number is read back from stored decisions, tasks,
 * Pulse outcomes and the feedback ledger.
 */
export default function QikoTrackRecord({ state, now }: { state: CrmState; now: number }) {
  const record = useMemo(() => trackRecord(state, now), [state, now]);
  const wrong = record.feedbackTotal - record.feedbackRight - record.feedbackPartly;

  return (
    <section className={`card ${styles.panel}`} aria-labelledby="record-title" data-tour="record">
      <div className={styles.head}>
        <div>
          <span className="kicker-qiko">Qiko</span>
          <h2 id="record-title">Track record</h2>
        </div>
        <IconTile name="shield" tone="qiko" size="sm" />
      </div>

      <div className={styles.stats}>
        <Stat label="Raised" value={record.raised} hint="suggestions and Pulse insights" />
        <Stat label="Acted on" value={record.actedOn} hint="tasks completed from Qiko" />
        <Stat label="Outcomes" value={record.outcomes} hint="results recorded in Pulse" />
        <Stat label="Attributed" value={record.valueAttributed} format={compactMoney} hint="revenue and pipeline linked" />
      </div>

      <div className={styles.accuracy}>
        <div className={styles.accuracyHead}>
          <span>Right calls</span>
          <b className="tabular">{record.accuracyPct === null ? "—" : `${record.accuracyPct}%`}</b>
        </div>
        {record.feedbackTotal === 0 ? (
          <p className={styles.accuracyEmpty}>
            <Icon name="sparkles" size={13} /> Rate a priority or signal (✓ · ○ · ✕) and Qiko starts keeping score.
          </p>
        ) : (
          <>
            <div className={styles.bar} role="img" aria-label={`${record.feedbackRight} right, ${record.feedbackPartly} partly, ${wrong} wrong`}>
              <i data-tone="right" style={{ flex: record.feedbackRight }} />
              <i data-tone="partly" style={{ flex: record.feedbackPartly }} />
              <i data-tone="wrong" style={{ flex: wrong }} />
            </div>
            <div className={styles.legend}>
              <span data-tone="right">{record.feedbackRight} right</span>
              <span data-tone="partly">{record.feedbackPartly} partly</span>
              <span data-tone="wrong">{wrong} wrong</span>
            </div>
          </>
        )}
      </div>

      <div className={styles.foot}>
        <span className={styles.trend}>
          <Spark values={record.outcomeSeries} kind="bars" tone="qiko" width={72} height={22} label="Outcomes recorded per week, last 8 weeks" />
          <small>outcomes · 8 wks</small>
        </span>
        <Link href="/pulse/value" target="_blank" rel="noopener" className="link-button">
          Value ledger <Icon name="external" size={12} />
        </Link>
      </div>
    </section>
  );
}

function Stat({ label, value, hint, format }: { label: string; value: number; hint: string; format?: (n: number) => string }) {
  return (
    <div className={styles.stat} title={hint}>
      <b className={`tabular ${styles.statValue}`}>
        <CountUp value={value} format={format ?? ((n) => String(Math.round(n)))} />
      </b>
      <span className={styles.statLabel}>{label}</span>
    </div>
  );
}
