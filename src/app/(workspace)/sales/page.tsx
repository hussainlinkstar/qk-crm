"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { buildMetrics, buildTrends, sourceBreakdown } from "@/lib/insights";
import { initials, timeAgo } from "@/lib/format";
import { LEAD_STATUSES } from "@/lib/types";
import Button from "@/components/ui/Button";
import Icon from "@/components/ui/Icon";
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

  if (!state || !workspace) {
    return (
      <div className="page">
        <SkeletonRows rows={4} height={110} />
      </div>
    );
  }

  const hotLeads = workspace.leads.filter((lead) => lead.status !== "Won" && lead.status !== "Lost").sort((a, b) => b.engagementScore - a.engagementScore).slice(0, 6);
  const pipeline = LEAD_STATUSES.map((status) => ({ label: status, value: state.leads.filter((lead) => lead.status === status).length }));

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Sales overview</h1>
          <p className="subtitle">A unified view of sign-ups, scans, enquiries and product activity — and what to do about them.</p>
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

      <section className={styles.kpis} aria-label="Sales metrics">
        {metrics.map((metric, index) => (
          <Link key={metric.key} href={metric.href} className={styles.kpi} style={{ animationDelay: `${index * 40}ms` }}>
            <span className={styles.kpiLabel}>{metric.label}</span>
            <b className="tabular">{metric.value}</b>
            <span className={`${styles.kpiDelta} ${metric.tone ? styles[metric.tone] : ""}`}>{metric.delta}</span>
            <small>{metric.description}</small>
          </Link>
        ))}
      </section>

      <section className="card">
        <div className="card-head">
          <div>
            <h2>Last {range} days</h2>
            <p className="card-sub">Daily sign-ups and completed scans. Hover a bar for details.</p>
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
            <div>
              <h2>Leads by status</h2>
            </div>
          </div>
          <div className="card-body">
            <BarList items={pipeline} onSelect={(label) => router.push(`/sales/leads?status=${encodeURIComponent(label)}`)} />
          </div>
        </article>
        <article className="card">
          <div className="card-head">
            <div>
              <h2>Lead sources</h2>
            </div>
          </div>
          <div className="card-body">
            <BarList items={sourceBreakdown(state)} color="#3b82f6" onSelect={(label) => router.push(`/sales/leads?source=${encodeURIComponent(label)}`)} />
          </div>
        </article>
      </section>

      <section className={styles.split}>
        <article className="card">
          <div className="card-head">
            <div>
              <h2>Suggested follow-ups</h2>
              <p className="card-sub">Generated from recorded activity, each with its evidence.</p>
            </div>
            <Link href="/sales/actions" className="link-button">
              All {workspace.suggestions.length} <Icon name="arrowRight" size={13} />
            </Link>
          </div>
          <div className={`card-body ${styles.stack}`}>
            {workspace.suggestions.length === 0 ? (
              <EmptyState icon="checkCircle" title="No suggestions right now">Every active lead has a plan.</EmptyState>
            ) : (
              workspace.suggestions.slice(0, 3).map((suggestion) => <SuggestionCard key={suggestion.id} suggestion={suggestion} lead={workspace.leadById.get(suggestion.leadId)} />)
            )}
          </div>
        </article>
        <article className="card">
          <div className="card-head">
            <div>
              <h2>Most engaged prospects</h2>
              <p className="card-sub">Ranked by recent sign-ups, scans, logins and reports.</p>
            </div>
          </div>
          <ul className={styles.hot}>
            {hotLeads.map((lead) => (
              <li key={lead.id}>
                <Link href={`/sales/leads/${lead.id}`}>
                  <span className="avatar">{initials(lead.name)}</span>
                  <span className={styles.hotText}>
                    <b>{lead.name}</b>
                    <small>
                      {lead.company ?? lead.email} · {lead.lastActivity ? timeAgo(lead.lastActivity.occurredAt, now || undefined) : "no activity"}
                    </small>
                  </span>
                  <LeadStatusChip status={lead.status} />
                  <span className={styles.score} title="Engagement score (0–100)">
                    <span className={styles.scoreTrack}>
                      <i style={{ width: `${lead.engagementScore}%` }} />
                    </span>
                    <b className="tabular">{lead.engagementScore}</b>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </article>
      </section>

      <p className="demo-banner">
        <Icon name="database" size={14} />
        Demo data — metrics are calculated live from the sample workspace, so they update as you work leads and tasks.
      </p>
    </div>
  );
}
