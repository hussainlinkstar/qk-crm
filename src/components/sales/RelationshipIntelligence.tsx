"use client";

import Link from "next/link";
import { timeAgo } from "@/lib/format";
import type { SalesRelationshipIntel } from "@/lib/sales-relationship";
import styles from "./relationship.module.css";

export default function RelationshipIntelligence({
  intel,
  variant = "drawer",
}: {
  intel: SalesRelationshipIntel;
  variant?: "drawer" | "page";
}) {
  const tone =
    intel.strength === "Strong"
      ? styles.toneStrong
      : intel.strength === "Developing"
        ? styles.toneDeveloping
        : intel.strength === "Limited"
          ? styles.toneLimited
          : styles.toneUnknown;

  return (
    <section className={`${styles.block} ${variant === "page" ? styles.blockCard : ""}`} aria-label="Relationship intelligence">
      <div className={styles.head}>
        <h3>Relationship intelligence</h3>
        <span className={`chip ${tone}`}>{intel.strength}</span>
      </div>
      <p className={styles.why}>{intel.strengthWhy}</p>
      <dl className={styles.facts}>
        <div>
          <dt>Relationship owner</dt>
          <dd>{intel.ownerName}</dd>
        </div>
        <div>
          <dt>Known connections</dt>
          <dd>
            {intel.network.length === 0 ? (
              <span className={styles.muted}>None recorded in Tessiant’s associate/SIA network</span>
            ) : (
              <span className={styles.links}>
                {intel.network.map((item) => (
                  <Link key={item.id} href={item.href} className={styles.link}>
                    {item.name}
                    <small>{item.detail}</small>
                  </Link>
                ))}
              </span>
            )}
          </dd>
        </div>
        <div>
          <dt>Existing client relationships</dt>
          <dd>
            {intel.clients.length === 0 ? (
              <span className={styles.muted}>No linked account or contact</span>
            ) : (
              <span className={styles.links}>
                {intel.clients.map((item) => (
                  <Link key={item.id} href={item.href} className={styles.link}>
                    {item.name}
                    <small>{item.detail}</small>
                  </Link>
                ))}
              </span>
            )}
          </dd>
        </div>
        <div>
          <dt>Last meaningful interaction</dt>
          <dd>
            {intel.lastInteraction ? (
              <>
                {intel.lastInteraction.title}
                <span className={styles.muted}>
                  {" "}
                  · {timeAgo(intel.lastInteraction.at)} · {intel.lastInteraction.source}
                </span>
              </>
            ) : (
              <span className={styles.muted}>None recorded</span>
            )}
          </dd>
        </div>
        <div>
          <dt>Coverage</dt>
          <dd>{intel.coverageLabel}</dd>
        </div>
        <div>
          <dt>Suggested next action</dt>
          <dd>{intel.nextAction}</dd>
        </div>
      </dl>
      {intel.recommendation ? (
        <div className={styles.rec}>
          <div className={styles.recHead}>
            {intel.recommendation.demo ? <span className="chip">Demo example</span> : null}
            <span className="chip chip-dot">Recommendation</span>
          </div>
          <p>{intel.recommendation.text}</p>
          <p className={styles.recSource}>{intel.recommendation.source}</p>
          <span className={styles.links}>
            {intel.recommendation.links.map((item) => (
              <Link key={item.id} href={item.href} className={styles.link}>
                Open {item.name}
                <small>{item.detail}</small>
              </Link>
            ))}
          </span>
        </div>
      ) : null}
    </section>
  );
}
