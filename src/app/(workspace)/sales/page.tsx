"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { buildMetrics, buildTrends, sourceBreakdown } from "@/lib/insights";
import { initials, timeAgo } from "@/lib/format";
import { LEAD_STATUSES, OPPORTUNITY_STAGES } from "@/lib/types";
import { commercialBuckets, isOpenLead } from "@/lib/sales-crm";
import Button from "@/components/ui/Button";
import { EmptyState, LeadStatusChip, SkeletonRows, useNow, useWorkspaceData } from "@/components/ui/bits";
import TrendChart, { BarList } from "@/components/charts/TrendChart";
import SuggestionCard from "@/components/tasks/SuggestionCard";
import { useWorkspace } from "@/components/shell/WorkspaceContext";
import styles from "./sales.module.css";

const RANGES = [7, 14, 30] as const;

export default function SalesOverviewPage() {
  const router = useRouter();
  const { state, workspace } = useWorkspaceData();
  const { openAddLead, askQiko } = useWorkspace();
  const [range, setRange] = useState<(typeof RANGES)[number]>(30);
  const now = useNow();

  const metrics = useMemo(() => (state ? buildMetrics(state, now || undefined) : []), [state, now]);
  const trends = useMemo(() => (state ? buildTrends(state, range) : []), [state, range]);
  const buckets = state ? commercialBuckets(state) : null;

  if (!state || !workspace) {
    return (
      <div className="page">
        <SkeletonRows rows={4} height={110} />
      </div>
    );
  }

  const hotLeads = workspace.leads.filter((lead) => isOpenLead(lead.status)).sort((a, b) => b.engagementScore - a.engagementScore).slice(0, 6);
  const leadPipeline = LEAD_STATUSES.map((status) => ({ label: status, value: state.leads.filter((lead) => lead.status === status).length }));
  const oppPipeline = OPPORTUNITY_STAGES.map((stage) => ({
    label: stage,
    value: (state.opportunities ?? []).filter((item) => item.stage === stage).length,
  }));

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Sales overview</h1>
          <p className="subtitle">
            B2B consulting & staffing CRM — leads, accounts, contacts and opportunities. Pipeline is not recognised revenue.
          </p>
        </div>
        <div className="page-actions">
          <Button variant="secondary" icon="sparkles" className="mobile-icon-button" aria-label="Summarise today" onClick={() => askQiko("What happened in sales today?")}>
            <span className="mobile-icon-label">Summarise today</span>
          </Button>
          <Button icon="userPlus" className="mobile-icon-button mobile-main-button" aria-label="Add lead" onClick={openAddLead}>
            <span className="mobile-icon-label">Add lead</span>
          </Button>
        </div>
      </header>

      {buckets && (
        <section className={`${styles.kpis} ${styles.kpisCommercial}`} aria-label="Commercial distinctions">
          <div className={styles.kpi}>
            <span className={styles.kpiLabel}>Open pipeline</span>
            <b className="tabular">£{buckets.pipeline.toLocaleString("en-GB")}</b>
            <span className={styles.kpiDelta} aria-hidden="true">
              &nbsp;
            </span>
            <small>Face-value opportunities still open</small>
          </div>
          <div className={styles.kpi}>
            <span className={styles.kpiLabel}>Weighted pipeline</span>
            <b className="tabular">£{buckets.weighted.toLocaleString("en-GB")}</b>
            <span className={styles.kpiDelta} aria-hidden="true">
              &nbsp;
            </span>
            <small>Probability-adjusted — still not revenue</small>
          </div>
          <div className={styles.kpi}>
            <span className={styles.kpiLabel}>Agreed contract</span>
            <b className="tabular">£{buckets.agreed.toLocaleString("en-GB")}</b>
            <span className={styles.kpiDelta} aria-hidden="true">
              &nbsp;
            </span>
            <small>Closed won contract value</small>
          </div>
          <div className={styles.kpi}>
            <span className={styles.kpiLabel}>Expected billing</span>
            <b className="tabular">£{buckets.expectedBilling.toLocaleString("en-GB")}</b>
            <span className={styles.kpiDelta} aria-hidden="true">
              &nbsp;
            </span>
            <small>Forecast from won work</small>
          </div>
          <div className={styles.kpi}>
            <span className={styles.kpiLabel}>Recognised revenue</span>
            <b className="tabular">£{buckets.recognised.toLocaleString("en-GB")}</b>
            <span className={styles.kpiDelta} aria-hidden="true">
              &nbsp;
            </span>
            <small>Realised only — not pipeline</small>
          </div>
        </section>
      )}

      <section className={styles.kpis} aria-label="Sales metrics">
        {metrics.map((metric, index) => (
          <Link key={metric.key} href={metric.href} className={styles.kpi} style={{ animationDelay: `${index * 40}ms` }}>
            <span className={styles.kpiLabel}>{metric.label}</span>
            <b className="tabular">{metric.value}</b>
            <span className={`${styles.kpiDelta} ${metric.tone ? styles[metric.tone] : ""}`}>{metric.delta || "\u00a0"}</span>
            <small>{metric.description}</small>
          </Link>
        ))}
      </section>

      <section className="card">
        <div className="card-head">
          <div>
            <h2>Last {range} days</h2>
            <p className="card-sub">Lead intake and engagement activity.</p>
          </div>
          <div className="segmented" role="group" aria-label="Date range">
            {RANGES.map((value) => (
              <button type="button" key={value} aria-pressed={range === value} onClick={() => setRange(value)}>
                {value}d
              </button>
            ))}
          </div>
        </div>
        <div className={`card-body ${styles.trends}`}>
          {trends.map((trend) => {
            const total = trend.points.reduce((sum, point) => sum + point.value, 0);
            return (
              <div key={trend.key} className={styles.trend}>
                <div className={styles.trendHead}>
                  <span>
                    <i style={{ background: trend.color }} />
                    {trend.label}
                  </span>
                  <span className={styles.trendTotal}>
                    <b className="tabular">{total}</b>
                    <small>in last {range} days</small>
                  </span>
                </div>
                {total === 0 ? <EmptyState title="No data in this range" /> : <TrendChart points={trend.points} color={trend.color} unit={trend.label.toLowerCase()} />}
              </div>
            );
          })}
        </div>
      </section>

      <section className={styles.split}>
        <article className="card">
          <div className="card-head">
            <h2>Leads by status</h2>
          </div>
          <div className="card-body">
            <BarList items={leadPipeline} onSelect={(label) => router.push(`/sales/leads?status=${encodeURIComponent(label)}`)} />
          </div>
        </article>
        <article className="card">
          <div className="card-head">
            <div>
              <h2>Opportunity stages</h2>
              <p className="card-sub">
                <Link href="/sales/pipeline">Open opportunity board</Link>
              </p>
            </div>
          </div>
          <div className="card-body">
            <BarList items={oppPipeline} onSelect={() => router.push("/sales/pipeline")} />
          </div>
        </article>
      </section>

      <section className={styles.split}>
        <article className="card">
          <div className="card-head">
            <div>
              <h2>Lead sources</h2>
            </div>
          </div>
          <div className="card-body">
            <BarList items={sourceBreakdown(state)} onSelect={(label) => router.push(`/sales/leads?source=${encodeURIComponent(label)}`)} />
          </div>
        </article>
        <article className="card">
          <div className="card-head">
            <div>
              <h2>Accounts</h2>
            </div>
            <Link href="/sales/accounts" className="text-link">
              Client 360
            </Link>
          </div>
          <div className="card-body">
            <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {(state.tessiant?.accounts ?? []).slice(0, 4).map((account) => (
                <li key={account.id} style={{ padding: "8px 0", borderBottom: "1px solid var(--line-soft)" }}>
                  <Link href={`/sales/accounts/${account.id}`}>{account.name}</Link>
                  <div className="muted">
                    {account.sector} · {account.status}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </article>
      </section>

      <section className={styles.split}>
        <article className="card">
          <div className="card-head">
            <div>
              <h2>Priority suggestions</h2>
            </div>
          </div>
          <div className="card-body stack-gap">
            {workspace.suggestions.slice(0, 4).map((suggestion) => (
              <SuggestionCard key={suggestion.id} suggestion={suggestion} />
            ))}
            {workspace.suggestions.length === 0 && <EmptyState title="No suggestions right now" />}
          </div>
        </article>
        <article className="card">
          <div className="card-head">
            <div>
              <h2>Active leads</h2>
            </div>
          </div>
          <div className="card-body">
            {hotLeads.length === 0 ? (
              <EmptyState title="No open leads" />
            ) : (
              <ul className={styles.leadList}>
                {hotLeads.map((lead) => (
                  <li key={lead.id}>
                    <Link href={`/sales/leads/${lead.id}`} className={styles.leadRow}>
                      <span className="avatar avatar-sm">{initials(lead.name)}</span>
                      <span>
                        <b>{lead.name}</b>
                        <small>
                          {lead.company ?? "No company"} · {timeAgo(lead.createdAt)}
                        </small>
                      </span>
                      <LeadStatusChip status={lead.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </article>
      </section>
    </div>
  );
}
