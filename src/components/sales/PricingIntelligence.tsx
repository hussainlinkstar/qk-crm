"use client";

import Link from "next/link";
import { useMemo } from "react";
import type { CrmState } from "@/lib/types";
import { pricingIntel } from "@/lib/pricing-intelligence";
import BarList from "@/components/ui/BarList";
import CountUp from "@/components/ui/CountUp";
import Icon from "@/components/ui/Icon";
import IconTile from "@/components/ui/IconTile";
import FeedbackThumbs from "@/components/ui/FeedbackThumbs";
import styles from "./PricingIntelligence.module.css";

/**
 * Pricing and margin intelligence on the Sales overview: margin per engagement from recorded terms,
 * win rate by day-rate band, and where scarcity supports a premium before the proposal goes out.
 */
export default function PricingIntelligence({ state }: { state: CrmState }) {
  const intel = useMemo(() => pricingIntel(state), [state]);
  if (intel.margins.length === 0 && intel.scarcity.length === 0) return null;
  const marginRows = intel.margins.slice(0, 5).map((item) => ({
    key: item.placement.id,
    label: (
      <>
        {item.associateName} <small className={styles.at}>· {item.accountName}</small>
      </>
    ),
    value: item.marginPct,
    display: `${item.marginPct}%`,
    caption: `£${item.clientRate.toLocaleString("en-GB")} billed · £${item.cost.toLocaleString("en-GB")} cost · £${item.marginPerDay.toLocaleString("en-GB")}/day${item.live ? "" : " · past"}`,
    href: `/staffing/placements/${item.placement.id}`,
    tone: (item.marginPct < 20 ? "warning" : item.live ? "brand" : "muted") as "warning" | "brand" | "muted",
  }));
  const bandMax = Math.max(1, ...intel.bands.map((band) => band.won + band.lost + band.open));

  return (
    <section className={`card ${styles.card}`} aria-labelledby="pricing-title">
      <div className={styles.head}>
        <div className={styles.headCopy}>
          <IconTile name="coins" tone="qiko" size="md" />
          <div>
            <p className="kicker kicker-qiko">Qiko · Pricing &amp; margin</p>
            <h2 id="pricing-title">{intel.headline}</h2>
            <p className={styles.sub}>Margins are recorded client rate less associate cost. Premiums are Qiko&apos;s inference from verified supply, not a quote.</p>
          </div>
        </div>
        <div className={styles.avg}>
          <b className="tabular">{intel.avgMarginPct === null ? "—" : <CountUp value={intel.avgMarginPct} format={(n) => `${Math.round(n)}%`} />}</b>
          <span>avg live margin</span>
        </div>
      </div>

      <div className={styles.grid}>
        <div className={styles.col}>
          <h3 className="kicker">Margin per engagement</h3>
          {marginRows.length === 0 ? <p className={styles.quiet}>No placement terms recorded.</p> : <BarList rows={marginRows} max={60} label="Margin per engagement" />}
          {intel.byOffering.length > 1 ? (
            <p className={styles.offerings}>
              By offering:{" "}
              {intel.byOffering.map((item, index) => (
                <span key={item.offering}>
                  {index > 0 ? " · " : ""}
                  {item.offering} <b className="tabular">{item.avgPct}%</b>
                </span>
              ))}
            </p>
          ) : null}
        </div>

        <div className={styles.col}>
          <h3 className="kicker">Win rate by day-rate band</h3>
          <ul className={styles.bands}>
            {intel.bands.map((band) => {
              const total = band.won + band.lost + band.open;
              return (
                <li key={band.band}>
                  <span className={styles.bandLabel}>
                    {band.band}
                    <b className="tabular">{band.winRate === null ? (total ? "open only" : "no deals") : `${band.winRate}%`}</b>
                  </span>
                  <span className={styles.bandBar} aria-label={`${band.won} won, ${band.lost} lost, ${band.open} open`}>
                    <i data-tone="won" style={{ width: `${(band.won / bandMax) * 100}%` }} />
                    <i data-tone="lost" style={{ width: `${(band.lost / bandMax) * 100}%` }} />
                    <i data-tone="open" style={{ width: `${(band.open / bandMax) * 100}%` }} />
                  </span>
                  <small>
                    {band.won} won · {band.lost} lost · {band.open} open
                  </small>
                </li>
              );
            })}
          </ul>
          <p className={styles.quiet}>Bands from the linked brief&apos;s top rate. {intel.bands.every((band) => band.lost === 0) ? "No losses recorded yet, so win rates read 100% where deals closed." : ""}</p>
        </div>

        <div className={styles.col}>
          <h3 className="kicker">Scarcity premium on open briefs</h3>
          {intel.scarcity.length === 0 ? (
            <p className={styles.quiet}>No open briefs.</p>
          ) : (
            <ul className={styles.scarcity}>
              {intel.scarcity.slice(0, 4).map((row) => (
                <li key={row.requirement.id} data-level={row.premiumPct >= 10 ? "high" : row.premiumPct > 0 ? "some" : "none"}>
                  <Link href={`/staffing/requirements/${row.requirement.id}`} className={styles.scarcityRow}>
                    <span className={styles.premium}>{row.premiumPct > 0 ? `+${row.premiumPct}%` : "hold"}</span>
                    <span className={styles.scarcityCopy}>
                      <b>{row.requirement.title}</b>
                      <small>
                        {row.accountName} · {row.band}
                      </small>
                      <em>{row.reason}</em>
                    </span>
                    <Icon name="chevronRight" size={14} />
                  </Link>
                  <FeedbackThumbs feedbackKey={`pricing:${row.requirement.id}`} context="signal" compact />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
