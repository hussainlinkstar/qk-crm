"use client";

import { useMemo } from "react";
import type { CrmState } from "@/lib/types";
import type { ClientRequirement } from "@/lib/tessiant-types";
import { pricingGuidance } from "@/lib/pricing-intelligence";
import IconTile from "@/components/ui/IconTile";
import Icon from "@/components/ui/Icon";
import styles from "./PricingGuidance.module.css";

/** Pricing guidance on a brief: the band against recorded sector rates, the scarcity case, and the margin it leaves. */
export default function PricingGuidance({ state, requirement }: { state: CrmState; requirement: ClientRequirement }) {
  const guidance = useMemo(() => pricingGuidance(state, requirement), [state, requirement]);
  if (!guidance) return null;
  const money = (value: number) => `£${value.toLocaleString("en-GB")}`;
  const unit = requirement.rateUnit;

  return (
    <section className={`card ${styles.card}`} aria-labelledby="pricing-guidance-title">
      <div className={styles.head}>
        <IconTile name="coins" tone="qiko" size="md" />
        <div>
          <p className="kicker kicker-qiko">Qiko · Pricing guidance</p>
          <h2 id="pricing-guidance-title">
            {guidance.scarcity && guidance.scarcity.premiumPct > 0 && requirement.rateMax
              ? `Scarcity supports ${money(guidance.suggested ?? requirement.rateMax)}/${unit}, ${guidance.scarcity.premiumPct}% over the band`
              : requirement.rateMax
                ? `Hold the band at ${money(requirement.rateMax)}/${unit}`
                : "No rate band recorded on this brief"}
          </h2>
        </div>
      </div>
      <dl className={styles.facts}>
        <div>
          <dt>Brief band</dt>
          <dd className="tabular">{requirement.rateMin && requirement.rateMax ? `${money(requirement.rateMin)}–${money(requirement.rateMax)}` : requirement.rateMax ? `up to ${money(requirement.rateMax)}` : "—"}</dd>
          <small>recorded</small>
        </div>
        <div>
          <dt>{requirement.sector} placements</dt>
          <dd className="tabular">{guidance.median ? `${money(guidance.median)} median` : "none recorded"}</dd>
          <small>{guidance.sectorSamples} on record</small>
        </div>
        <div>
          <dt>Typical candidate cost</dt>
          <dd className="tabular">{guidance.typicalCost ? `${money(guidance.typicalCost)}/${unit}` : "—"}</dd>
          <small>from shortlisted quotes</small>
        </div>
        <div data-kind="inference">
          <dt>Margin at suggested rate</dt>
          <dd className="tabular">{guidance.marginAtSuggested !== null ? `${guidance.marginAtSuggested}%` : "—"}</dd>
          <small>inference</small>
        </div>
      </dl>
      {guidance.scarcity ? (
        <p className={styles.reason}>
          <Icon name="sparkles" size={12} /> {guidance.scarcity.reason}. {guidance.scarcity.verified} verified available on the shortlist, {guidance.scarcity.benchByStart} with the skills free by the start date.
        </p>
      ) : null}
    </section>
  );
}
