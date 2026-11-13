"use client";

import { useMemo } from "react";
import IconTile from "@/components/ui/IconTile";
import DealJourney from "@/components/journey/DealJourney";
import { dealJourneys } from "@/lib/deal-journey";
import type { CrmState } from "@/lib/types";
import { plural } from "@/lib/format";
import styles from "./DealJourney.module.css";

/** The chains currently moving between Sales and Staffing, for the two overview pages. */
export default function JourneysInFlight({ state, limit = 3, title = "From deal to delivery" }: { state: CrmState; limit?: number; title?: string }) {
  const journeys = useMemo(() => dealJourneys(state).filter((item) => item.inFlight), [state]);
  if (journeys.length === 0) return null;
  return (
    <section className={styles.flight} aria-labelledby="journeys-title">
      <div className={styles.flightHead}>
        <IconTile name="layers" tone="qiko" size="lg" />
        <div>
          <p className="kicker kicker-qiko">Qiko Core × Staffing</p>
          <h2 id="journeys-title">{title}</h2>
          <p>
            {plural(journeys.length, "chain")} in flight. A won deal raises a requirement; a placement closes the loop. Each node opens its record.
          </p>
        </div>
      </div>
      <div className={styles.flightList}>
        {journeys.slice(0, limit).map((journey) => (
          <div key={journey.key} className={styles.flightItem}>
            <div className={styles.flightItemHead}>
              <b>{journey.accountName}</b>
              {journey.next ? <span>{journey.next.label}</span> : null}
            </div>
            <DealJourney journey={journey} compact />
          </div>
        ))}
      </div>
    </section>
  );
}
