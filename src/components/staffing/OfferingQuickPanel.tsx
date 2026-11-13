"use client";

import Link from "next/link";
import { useMemo } from "react";
import type { CrmState } from "@/lib/types";
import { offeringDecision, type OfferingHealth, type OfferingRow } from "@/lib/offerings";
import { compactMoney } from "@/lib/home-tessiant";
import { avatarStyle, initials } from "@/lib/format";
import Button from "@/components/ui/Button";
import Icon, { type IconName } from "@/components/ui/Icon";
import IconTile, { type IconTone } from "@/components/ui/IconTile";
import FeedbackThumbs from "@/components/ui/FeedbackThumbs";
import { Drawer } from "@/components/ui/Overlay";
import { useWorkspace } from "@/components/shell/WorkspaceContext";
import styles from "@/components/leads/Leads.module.css";
import own from "./OfferingQuickPanel.module.css";

export const OFFERING_HEALTH: Record<OfferingHealth, { label: string; tone: IconTone }> = {
  "demand-exceeds-pool": { label: "Demand exceeds pool", tone: "danger" },
  healthy: { label: "Covered", tone: "success" },
  "pool-idle": { label: "Pool idle", tone: "warning" },
  quiet: { label: "Quiet", tone: "muted" },
};

export function offeringIcon(name: string): IconName {
  const text = name.toLowerCase();
  if (/advis|sia/.test(text)) return "star";
  if (/sap|tech|data|cyber|architect/.test(text)) return "layers";
  if (/programme|project|pmo/.test(text)) return "compass";
  if (/change|transform/.test(text)) return "rocket";
  if (/consult/.test(text)) return "briefcase";
  if (/augment|staff/.test(text)) return "users";
  if (/public/.test(text)) return "building";
  return "target";
}

/** Quick panel for one offering: the same drawer every other list page opens, with the decision first. */
export default function OfferingQuickPanel({ state, row, onClose }: { state: CrmState; row: OfferingRow; onClose: () => void }) {
  const { askQiko } = useWorkspace();
  const decision = useMemo(() => offeringDecision(state, row), [state, row]);
  const health = OFFERING_HEALTH[row.health];

  return (
    <Drawer
      kicker="Offering"
      title={
        <span className={styles.panelTitle}>
          <span>
            {row.name}
            <small>{row.why}</small>
          </span>
        </span>
      }
      onClose={onClose}
      width={520}
      footer={
        <Link href="/staffing/requirements" className={styles.fullProfile} onClick={onClose}>
          Open requirements <Icon name="arrowRight" size={14} />
        </Link>
      }
    >
      <div className={own.meta}>
        <span className={`chip ${health.tone === "danger" ? "chip-danger" : health.tone === "success" ? "chip-success" : health.tone === "warning" ? "chip-warning" : ""}`}>{health.label}</span>
        <span className="chip tabular">{row.pool.length} in pool · {row.availableNow} free</span>
        <span className="chip tabular">{row.wonDeals.length} won · {compactMoney(row.wonValue)}</span>
        <span className="chip tabular">{row.avgMarginPct === null ? "margin —" : `${row.avgMarginPct}% margin`}</span>
      </div>

      {decision ? (
        <section className={own.decision} aria-label="The decision">
          <div className={own.decisionHead}>
            <IconTile name={offeringIcon(row.name)} tone="qiko" size="md" />
            <div>
              <p className="kicker kicker-qiko">Qiko · The decision</p>
              <h3>{decision.verdict}</h3>
            </div>
          </div>
          <ul className={own.decisionList}>
            <li>
              <Icon name="users" size={13} />
              <span>{decision.share ? `${decision.share.pct}% of the network (${decision.share.count}) has ${decision.sector} experience` : `No ${decision.sector} experience recorded in the network`}</span>
            </li>
            <li data-gap={decision.gap > 0 || undefined}>
              <Icon name="calendar" size={13} />
              <Link href="/staffing#bench" onClick={onClose}>
                {decision.benchRow
                  ? decision.gap > 0
                    ? `Bench: ${decision.sector} ${decision.gap} short inside ${decision.gapHorizon} days`
                    : `Bench: ${decision.sector} covered across 90 days`
                  : `Bench: no ${decision.sector} demand in the next 90 days`}
              </Link>
            </li>
            {decision.briefs.slice(0, 2).map((req) => (
              <li key={req.id}>
                <Icon name="flag" size={13} />
                <Link href={`/staffing/requirements/${req.id}`} onClick={onClose}>
                  Open brief: {req.title}
                </Link>
              </li>
            ))}
          </ul>
          <div className={own.decisionActions}>
            <Button size="small" variant="qiko" icon="sparkles" onClick={() => askQiko(`How should we grow ${row.name}? Who can deliver it and which accounts should we approach?`)}>
              Ask Qiko
            </Button>
            <FeedbackThumbs feedbackKey={`offering:${row.key}`} context="insight" />
          </div>
        </section>
      ) : null}

      <section className={own.block}>
        <h3 className="kicker">Who can deliver it</h3>
        {row.pool.length === 0 ? (
          <p className={own.quiet}>Nobody in the network records this offering.</p>
        ) : (
          <ul className={own.people}>
            {row.pool.slice(0, 10).map((associate) => (
              <li key={associate.id} data-available={associate.availability === "available" || undefined}>
                <Link href={`/staffing/associates/${associate.id}`} onClick={onClose} title={`${associate.name} · ${associate.availability}`}>
                  <span className="avatar avatar-sm" style={avatarStyle(associate.name)}>
                    {initials(associate.name)}
                  </span>
                </Link>
              </li>
            ))}
            {row.pool.length > 10 ? <li className={own.more}>+{row.pool.length - 10}</li> : null}
          </ul>
        )}
      </section>

      <section className={own.block}>
        <h3 className="kicker">Who wants it</h3>
        {row.interested.length === 0 && row.purchased.length === 0 ? (
          <p className={own.quiet}>No account has asked for or bought this yet.</p>
        ) : (
          <ul className={own.accounts}>
            {[...new Map([...row.purchased, ...row.interested].map((account) => [account.id, account])).values()].map((account) => (
              <li key={account.id}>
                <Link href={`/sales/accounts/${account.id}`} onClick={onClose}>
                  {account.name}
                </Link>
                <span className={`chip ${row.purchased.some((item) => item.id === account.id) ? "chip-won" : "chip-ai"}`}>{row.purchased.some((item) => item.id === account.id) ? "bought" : "interested"}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={own.block}>
        <h3 className="kicker">Deals</h3>
        {row.openDeals.length === 0 && row.wonDeals.length === 0 ? (
          <p className={own.quiet}>No opportunity references this offering.</p>
        ) : (
          <ul className={own.rows}>
            {[...row.openDeals, ...row.wonDeals].map((deal) => (
              <li key={deal.id}>
                <Link href={`/sales/pipeline?opportunity=${deal.id}`} onClick={onClose}>
                  {deal.name}
                </Link>
                <small>
                  {deal.stage} · {compactMoney(deal.amount)}
                </small>
              </li>
            ))}
          </ul>
        )}
      </section>

      {row.margins.length > 0 ? (
        <section className={own.block}>
          <h3 className="kicker">Margin on record</h3>
          <ul className={own.rows}>
            {row.margins.slice(0, 4).map((item) => (
              <li key={item.placement.id}>
                <Link href={`/staffing/placements/${item.placement.id}`} onClick={onClose}>
                  {item.associateName} · {item.accountName}
                </Link>
                <small>
                  {item.marginPct}% · £{item.marginPerDay.toLocaleString("en-GB")}/day{item.live ? "" : " · past"}
                </small>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </Drawer>
  );
}
