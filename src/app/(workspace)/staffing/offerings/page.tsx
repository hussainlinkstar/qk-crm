"use client";

import { useMemo, useState } from "react";
import { offeringCatalogue } from "@/lib/offerings";
import { compactMoney } from "@/lib/home-tessiant";
import CountUp from "@/components/ui/CountUp";
import Icon, { type IconName } from "@/components/ui/Icon";
import IconTile, { type IconTone } from "@/components/ui/IconTile";
import { EmptyState, SkeletonRows, useWorkspaceData } from "@/components/ui/bits";
import OfferingQuickPanel, { OFFERING_HEALTH, offeringIcon } from "@/components/staffing/OfferingQuickPanel";
import directory from "@/components/ui/Directory.module.css";
import styles from "./offerings.module.css";

/**
 * Offerings: the same shape as every other directory page. A Qiko lede, four numbers, then a list
 * of rows; a row opens the offering's quick panel, where the decision and the people behind it live.
 */
export default function OfferingsPage() {
  const { state } = useWorkspaceData();
  const rows = useMemo(() => (state ? offeringCatalogue(state) : []), [state]);
  const [openKey, setOpenKey] = useState<string | null>(null);
  if (!state) {
    return (
      <div className="page">
        <SkeletonRows rows={4} height={64} />
      </div>
    );
  }
  const open = rows.find((row) => row.key === openKey) ?? null;
  const gaps = rows.filter((row) => row.health === "demand-exceeds-pool");
  const idle = rows.filter((row) => row.health === "pool-idle");
  const withMargin = rows.filter((row) => row.avgMarginPct !== null);
  const avgMargin = withMargin.length ? Math.round(withMargin.reduce((sum, row) => sum + (row.avgMarginPct ?? 0), 0) / withMargin.length) : null;
  const openValue = rows.reduce((sum, row) => sum + row.openValue, 0);

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Offerings</h1>
          <p className="subtitle">What Tessiant sells, read against who can deliver it, who wants it, and what it earns.</p>
        </div>
      </header>

      <section className={styles.lede}>
        <IconTile name="sparkles" tone="qiko" size="lg" />
        <div>
          <p className="kicker kicker-qiko">Qiko</p>
          <h2>
            {gaps.length > 0
              ? `${gaps.length} offering${gaps.length === 1 ? " has" : "s have"} more demand than people free to deliver`
              : idle.length > 0
                ? `${idle.length} offering${idle.length === 1 ? "" : "s"} with a pool and nobody asking`
                : "Pool and demand line up across the catalogue"}
          </h2>
          <p>
            {gaps.length > 0 ? `${gaps.map((row) => row.name).join(", ")}: sell carefully until sourcing catches up.` : ""}
            {idle.length > 0 ? ` ${idle.map((row) => row.name).join(", ")}: a sales conversation, not a sourcing one.` : ""}
            {" "}Open an offering for the decision behind it.
          </p>
        </div>
      </section>

      <section className={styles.kpis} aria-label="Catalogue summary">
        <Kpi icon="layers" tone="brand" value={rows.length} label="offerings on record" />
        <Kpi icon="alert" tone={gaps.length ? "danger" : "success"} value={gaps.length} label="demand exceeds pool" />
        <Kpi icon="target" tone="qiko" value={openValue} format={compactMoney} label="open pipeline across offerings" />
        <Kpi icon="coins" tone="success" value={avgMargin ?? 0} format={(n) => (avgMargin === null ? "—" : `${Math.round(n)}%`)} label="avg recorded margin" />
      </section>

      <section className="card" data-tour="offerings">
        <div className="card-body">
          <div className={styles.header} aria-hidden="true">
            <span>Offering</span>
            <span>Pool</span>
            <span>Accounts</span>
            <span>Won</span>
            <span>Margin</span>
            <span>Status</span>
            <span />
          </div>
          {rows.length === 0 ? (
            <EmptyState title="No offerings recorded" icon="layers" />
          ) : (
            <div className={directory.list}>
              {rows.map((row) => {
                const health = OFFERING_HEALTH[row.health];
                return (
                  <button key={row.key} type="button" className={styles.row} onClick={() => setOpenKey(row.key)}>
                    <span className={directory.identity}>
                      <IconTile name={offeringIcon(row.name)} tone={health.tone} size="md" />
                      <span className={directory.copy}>
                        <b>{row.name}</b>
                        <small>{row.why}</small>
                      </span>
                    </span>
                    <span className={directory.stat}>
                      <b className="tabular">{row.pool.length}</b>
                      <small className="tabular">{row.availableNow} free now</small>
                    </span>
                    <span className={directory.stat}>
                      <b className="tabular">{row.interested.length + row.purchased.length}</b>
                      <small className="tabular">{row.purchased.length} bought</small>
                    </span>
                    <span className={directory.stat}>
                      <b className="tabular">{row.wonDeals.length}</b>
                      <small className="tabular">{compactMoney(row.wonValue)}</small>
                    </span>
                    <span className={directory.stat}>
                      <b className="tabular">{row.avgMarginPct === null ? "—" : `${row.avgMarginPct}%`}</b>
                      <small>recorded</small>
                    </span>
                    <span className={styles.health} data-health={row.health}>
                      {health.label}
                    </span>
                    <span className={directory.trail}>
                      <Icon name="chevronRight" size={15} />
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <p className={styles.disclosure}>
        Offerings are read from associates&apos; recorded offerings, accounts&apos; interests and purchases, and opportunity services. Margin is client rate less associate cost on recorded placement terms.
      </p>

      {open ? <OfferingQuickPanel state={state} row={open} onClose={() => setOpenKey(null)} /> : null}
    </div>
  );
}

function Kpi({ icon, tone, value, label, format }: { icon: IconName; tone: IconTone; value: number; label: string; format?: (n: number) => string }) {
  return (
    <div className={styles.kpi}>
      <IconTile name={icon} tone={tone} size="md" />
      <div>
        <b className="tabular">
          <CountUp value={value} format={format ?? ((n) => String(Math.round(n)))} />
        </b>
        <span>{label}</span>
      </div>
    </div>
  );
}
