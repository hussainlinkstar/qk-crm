"use client";

import { useState, type ReactNode } from "react";
import Icon from "./Icon";
import IconTile from "./IconTile";
import type { RecordInsightData } from "@/lib/record-insights";
import styles from "./RecordInsight.module.css";

/**
 * "Qiko on this record": the block every quick panel and record page opens with.
 * One verdict, the facts it rests on (labelled fact vs inference), the next step, an action, and
 * the provenance line underneath: how many facts, how many inferences, and what Qiko doesn't know.
 */
export default function RecordInsight({ subject, data, actions }: { subject: string; data: RecordInsightData; actions?: ReactNode }) {
  const [showUnknowns, setShowUnknowns] = useState(false);
  const facts = data.facts.filter((item) => item.kind === "fact").length;
  const inferences = data.facts.length - facts;
  const unknowns = data.unknowns ?? [];

  return (
    <section className={styles.block} data-tone={data.tone} aria-label={`Qiko on this ${subject}`}>
      <div className={styles.head}>
        <IconTile name={data.icon} tone={data.tone} size="md" />
        <div className={styles.copy}>
          <p className="kicker kicker-qiko">Qiko on this {subject}</p>
          <h3>{data.headline}</h3>
        </div>
      </div>
      {data.facts.length > 0 ? (
        <ul className={styles.facts}>
          {data.facts.map((fact, index) => (
            <li key={index} data-kind={fact.kind}>
              <Icon name={fact.kind === "fact" ? "check" : "sparkles"} size={11} strokeWidth={2.6} />
              <span>{fact.text}</span>
            </li>
          ))}
        </ul>
      ) : null}
      <p className={styles.next}>
        <span>Next</span>
        {data.next}
      </p>
      {actions ? <div className={styles.actions}>{actions}</div> : null}
      <div className={styles.provenance}>
        <span className={styles.provLine}>
          <i data-kind="fact" /> {facts} recorded fact{facts === 1 ? "" : "s"}
          <i data-kind="inference" /> {inferences} inference{inferences === 1 ? "" : "s"}
        </span>
        {unknowns.length > 0 ? (
          <button type="button" className={styles.unknownsToggle} onClick={() => setShowUnknowns((value) => !value)} aria-expanded={showUnknowns}>
            <Icon name="eyeOff" size={12} /> What Qiko doesn&apos;t know ({unknowns.length})
          </button>
        ) : (
          <span className={styles.complete}>
            <Icon name="check" size={11} strokeWidth={2.6} /> Record complete
          </span>
        )}
      </div>
      {showUnknowns && unknowns.length > 0 ? (
        <ul className={styles.unknowns}>
          {unknowns.map((item) => (
            <li key={item}>{item}</li>
          ))}
          <li className={styles.unknownsNote}>Add these and the verdict above gets sharper. Qiko never fills a gap with a guess.</li>
        </ul>
      ) : null}
    </section>
  );
}
