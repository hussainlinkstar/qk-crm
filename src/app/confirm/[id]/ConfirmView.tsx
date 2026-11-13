"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import { useCrm } from "@/lib/crm-store";
import { defaultNextAvailable, lastAvailabilityConfirmation, recordAvailabilityConfirmation } from "@/lib/availability-confidence";
import { formatDate } from "@/lib/format";
import Icon from "@/components/ui/Icon";
import styles from "./confirm.module.css";

/**
 * What the associate sees when they open the one-tap confirm link. Demo: it writes to the same
 * local store as the workspace, so the team's view updates the moment the associate answers.
 */
export default function ConfirmView() {
  const params = useParams<{ id: string }>();
  const state = useCrm();
  const [done, setDone] = useState<string | null>(null);
  const [date, setDate] = useState(defaultNextAvailable());
  const [pickDate, setPickDate] = useState(false);
  const associate = state?.tessiant?.associates.find((item) => item.id === params.id) ?? null;

  if (!state) return <main className={styles.page} />;
  if (!associate) {
    return (
      <main className={styles.page}>
        <section className={styles.card}>
          <h1>This link has expired</h1>
          <p>Ask your Tessiant contact for a fresh one.</p>
        </section>
      </main>
    );
  }

  const first = associate.name.split(" ")[0];
  const last = lastAvailabilityConfirmation(associate);

  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <div className={styles.brand}>
          <span className={styles.mark}>T</span>
          <span>Tessiant · Talent Network</span>
        </div>
        {done ? (
          <div className={styles.done}>
            <span className={styles.tick}>
              <Icon name="check" size={28} strokeWidth={2.6} />
            </span>
            <h1>Thanks, {first}.</h1>
            <p>{done}</p>
            <small>Your Tessiant contact sees this straight away. You can close this page.</small>
          </div>
        ) : (
          <>
            <h1>Hi {first}, are you still available?</h1>
            <p>
              Our record says <b>{associate.availability}</b>
              {associate.nextAvailableDate ? ` from ${formatDate(associate.nextAvailableDate)}` : ""}
              {last ? `, last confirmed ${formatDate(last)}` : ""}. One tap keeps you in the running for the next brief.
            </p>
            <div className={styles.actions}>
              <button
                type="button"
                className={styles.primary}
                onClick={() => {
                  recordAvailabilityConfirmation(associate.id, "available", null, "link");
                  setDone("You are marked available now.");
                }}
              >
                <Icon name="check" size={16} strokeWidth={2.6} /> Yes, available now
              </button>
              {pickDate ? (
                <div className={styles.dateRow}>
                  <input type="date" value={date} onChange={(event) => setDate(event.target.value)} aria-label="Available from" />
                  <button
                    type="button"
                    className={styles.secondary}
                    onClick={() => {
                      recordAvailabilityConfirmation(associate.id, "limited", date, "link");
                      setDone(`You are marked available from ${formatDate(date)}.`);
                    }}
                  >
                    Save date
                  </button>
                </div>
              ) : (
                <button type="button" className={styles.secondary} onClick={() => setPickDate(true)}>
                  <Icon name="calendar" size={16} /> Available from a date
                </button>
              )}
              <button
                type="button"
                className={styles.ghost}
                onClick={() => {
                  recordAvailabilityConfirmation(associate.id, "unavailable", null, "link");
                  setDone("You are marked unavailable for now. We will check back in a few weeks.");
                }}
              >
                Not available for now
              </button>
            </div>
            <small className={styles.foot}>In production this is a signed, single-use link sent by email or WhatsApp.</small>
          </>
        )}
      </section>
    </main>
  );
}
