"use client";

import Link from "next/link";
import { useMemo } from "react";
import BarList from "@/components/ui/BarList";
import CountUp from "@/components/ui/CountUp";
import IconTile from "@/components/ui/IconTile";
import { networkMixStats } from "@/lib/network-mix";
import type { CrmState } from "@/lib/types";
import styles from "@/app/(workspace)/staffing/staffing.module.css";

/**
 * "Network mix": the shares the client asked to see, in her words, plus what the pool can deliver
 * against the offerings clients have asked for or bought. Sample-based and labelled as such.
 */
export default function NetworkMix({ state }: { state: CrmState }) {
  const mix = useMemo(() => networkMixStats(state), [state]);
  const maxOffering = Math.max(3, ...mix.offerings.map((row) => Math.max(row.associates, row.accountsInterested + row.accountsPurchased)));

  return (
    <section className={styles.mixSection} aria-labelledby="mix-title">
      <div className={styles.mixHead}>
        <div className={styles.recHeadCopy}>
          <IconTile name="users" tone="qiko" size="lg" />
          <div>
            <p className="kicker kicker-qiko">Qiko</p>
            <h2 id="mix-title">Network mix</h2>
            <p className="card-sub">
              What the network is made of and whether it matches what Tessiant sells. Sample of {mix.sampleSize} profiles; the full network is {mix.networkTotal}.
            </p>
          </div>
        </div>
        <Link href="/pulse/knowledge/network" target="_blank" rel="noopener" className="text-link">
          Open in Pulse
        </Link>
      </div>

      <div className={styles.mixShares}>
        {mix.shares.map((share) => (
          <article key={share.key} className={styles.mixShare} data-key={share.key}>
            <b className="tabular">
              <CountUp value={share.pct} format={(n) => `${Math.round(n)}%`} />
            </b>
            <span>{share.label}</span>
            <small>{share.note}</small>
          </article>
        ))}
      </div>

      <div className={styles.mixGrid}>
        <div className={styles.mixPanel}>
          <h3>Associates by sector</h3>
          <BarList
            label="Share of sampled associates per sector"
            max={Math.max(...mix.sectors.map((row) => row.count), 1)}
            rows={mix.sectors.slice(0, 6).map((row) => ({
              key: row.sector,
              label: row.sector,
              value: row.count,
              display: `${row.pct}%`,
              caption: `${row.count} associates`,
              href: `/staffing/associates?sector=${encodeURIComponent(row.sector)}`,
              tone: /public|government/i.test(row.sector) ? ("warning" as const) : ("brand" as const),
            }))}
          />
        </div>
        <div className={styles.mixPanel}>
          <h3>Pool vs offerings</h3>
          <BarList
            label="Associates who can deliver each offering, against accounts that asked for or bought it"
            max={maxOffering}
            rows={mix.offerings.slice(0, 6).map((row) => ({
              key: row.offering,
              label: row.offering,
              value: row.associates,
              display: `${row.associates} in pool`,
              caption: `${row.accountsInterested} interested · ${row.accountsPurchased} bought`,
              tone: row.associates === 0 && row.accountsInterested + row.accountsPurchased > 0 ? ("warning" as const) : ("qiko" as const),
            }))}
          />
        </div>
      </div>
    </section>
  );
}
