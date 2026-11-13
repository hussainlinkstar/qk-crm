"use client";

import Link from "next/link";
import Icon, { type IconName } from "@/components/ui/Icon";
import IconTile from "@/components/ui/IconTile";
import type { DealJourney as Journey, JourneyNode, JourneyStage } from "@/lib/deal-journey";
import styles from "./DealJourney.module.css";

const STEPS: Array<{ stage: Exclude<JourneyStage, "delivered">; label: string; icon: IconName; pick: (j: Journey) => JourneyNode | null; empty: string }> = [
  { stage: "deal", label: "Deal", icon: "sales", pick: (j) => j.deal, empty: "No linked opportunity" },
  { stage: "requirement", label: "Requirement", icon: "flag", pick: (j) => j.req, empty: "Not raised yet" },
  { stage: "placement", label: "Placement", icon: "briefcase", pick: (j) => j.place, empty: "Not placed yet" },
];

const ORDER: Record<JourneyStage, number> = { deal: 0, requirement: 1, placement: 2, delivered: 3 };

/**
 * "From deal to delivery": the chain that makes Qiko Core and the staffing product one flow.
 * Three nodes, the current one highlighted, the next move spelled out. `compact` is for panels and lists.
 */
export default function DealJourney({ journey, compact = false, onNavigate }: { journey: Journey; compact?: boolean; onNavigate?: () => void }) {
  const current = ORDER[journey.stage];
  return (
    <section className={`${styles.ribbon} ${compact ? styles.compact : ""}`} aria-label="From deal to delivery">
      {!compact ? (
        <div className={styles.head}>
          <div>
            <p className="kicker kicker-qiko">Qiko Core × Staffing</p>
            <h3>From deal to delivery · {journey.accountName}</h3>
          </div>
          {journey.next ? (
            <Link href={journey.next.href} className={styles.next} onClick={onNavigate}>
              {journey.next.label} <Icon name="arrowRight" size={13} />
            </Link>
          ) : (
            <span className={styles.done}>
              <Icon name="checkCircle" size={13} /> Delivered
            </span>
          )}
        </div>
      ) : null}
      <ol className={styles.track}>
        {STEPS.map((step, index) => {
          const node = step.pick(journey);
          const state = index < current ? "done" : index === current ? "current" : "todo";
          const body = (
            <>
              <IconTile name={step.icon} tone={state === "done" ? "success" : state === "current" ? "qiko" : "muted"} size="sm" />
              <span className={styles.copy}>
                <small>{step.label}</small>
                <b>{node ? node.title : step.empty}</b>
                <span>{node ? node.meta : index === current && journey.next ? journey.next.label : "—"}</span>
              </span>
            </>
          );
          return (
            <li key={step.stage} className={styles.node} data-state={state}>
              {node ? (
                <Link href={node.href} className={styles.hit} onClick={onNavigate}>
                  {body}
                </Link>
              ) : (
                <div className={`${styles.hit} ${styles.empty}`}>{body}</div>
              )}
            </li>
          );
        })}
      </ol>
      {compact && journey.next ? (
        <Link href={journey.next.href} className={styles.nextCompact} onClick={onNavigate}>
          {journey.next.label} <Icon name="arrowRight" size={12} />
        </Link>
      ) : null}
    </section>
  );
}
