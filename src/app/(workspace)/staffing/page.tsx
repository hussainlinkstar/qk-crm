"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import Button from "@/components/ui/Button";
import Icon from "@/components/ui/Icon";
import { BarList } from "@/components/charts/TrendChart";
import { EmptyState, PriorityChip, SkeletonRows, useNow, useWorkspaceData } from "@/components/ui/bits";
import {
  assignmentOverviewRows,
  demandSnapshot,
  recruitmentPipeline,
  staffingCommandKpis,
  urgentStaffingNeeds,
  upcomingStaffingActions,
} from "@/lib/tessiant-insights";
import { formatDate } from "@/lib/format";
import styles from "./staffing.module.css";

const ACTION_LABEL: Record<string, string> = {
  interview: "Interview",
  availability: "Availability",
  feedback: "Feedback",
  assignment: "Assignment",
  cv: "CV",
  commercial: "Commercial",
  other: "Follow-up",
};

export default function StaffingOverviewPage() {
  const router = useRouter();
  const { state } = useWorkspaceData();
  const now = useNow();
  const tessiant = state?.tessiant;

  const kpis = useMemo(() => (state ? staffingCommandKpis(state, now || Date.now()) : []), [state, now]);
  const pipeline = useMemo(() => (state ? recruitmentPipeline(state) : []), [state]);
  const urgent = useMemo(() => (state ? urgentStaffingNeeds(state, now || Date.now()) : []), [state, now]);
  const assignments = useMemo(() => (state ? assignmentOverviewRows(state, now || Date.now()) : []), [state, now]);
  const actions = useMemo(() => (state ? upcomingStaffingActions(state) : []), [state]);
  const demand = useMemo(() => (state ? demandSnapshot(state) : { skills: [], sectors: [] }), [state]);

  if (!state || !tessiant) {
    return (
      <div className="page">
        <SkeletonRows rows={5} height={100} />
      </div>
    );
  }

  const primaryKpis = kpis.filter((item) => item.emphasis === "primary");
  const secondaryKpis = kpis.filter((item) => item.emphasis === "secondary");
  const pipelineBars = pipeline.map((item) => ({ label: item.stage, value: item.count }));

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <p className="kicker">Staffing operations</p>
          <h1>Staffing Overview</h1>
          <p className="subtitle">
            Network capacity, open demand, deployments and next actions for Tessiant resource managers.
          </p>
        </div>
        <div className="page-actions">
          <Link href="/staffing/requirements?view=urgent" className="button-link">
            <Button variant="secondary" icon="alert">
              Urgent needs
            </Button>
          </Link>
          <Link href="/staffing/requirements?new=1" className="button-link">
            <Button icon="plus">New requirement</Button>
          </Link>
        </div>
      </header>

      <p className="muted" style={{ margin: "0 0 4px", fontSize: 12 }} role="note">
        Sample workspace · {tessiant.networkStats.sampleSize} associates · illustrative network{" "}
        {tessiant.networkStats.totalMembers}+ · reset in Settings
      </p>

      <section className={styles.kpiPrimary} aria-label="Primary staffing KPIs">
        {primaryKpis.map((metric) => (
          <Link key={metric.key} href={metric.href} className={styles.kpi}>
            <span className={styles.kpiLabel}>{metric.label}</span>
            <b className="tabular">{metric.value}</b>
            <span className={`${styles.kpiDelta} ${metric.tone ? styles[metric.tone] : ""}`}>{metric.delta}</span>
            <small>{metric.description}</small>
          </Link>
        ))}
      </section>

      <section className={styles.kpiSecondary} aria-label="Secondary staffing KPIs">
        {secondaryKpis.map((metric) => (
          <Link key={metric.key} href={metric.href} className={`${styles.kpi} ${styles.kpiCompact}`}>
            <span className={styles.kpiLabel}>{metric.label}</span>
            <b className="tabular">{metric.value}</b>
            <span className={`${styles.kpiDelta} ${metric.tone ? styles[metric.tone] : ""}`}>{metric.delta}</span>
          </Link>
        ))}
      </section>

      <section className={styles.opsGrid}>
        <article className="card">
          <div className="card-head">
            <div>
              <h2>Recruitment pipeline</h2>
              <p className="card-sub">Requirements by operations stage. Click a stage to open the filtered list.</p>
            </div>
            <Link href="/staffing/requirements" className="text-link">
              All requirements
            </Link>
          </div>
          <div className="card-body">
            <BarList
              items={pipelineBars}
              color="var(--brand)"
              onSelect={(label) => router.push(`/staffing/requirements?opsStage=${encodeURIComponent(label)}`)}
            />
            <div className={styles.stageRail} style={{ marginTop: 14 }}>
              {pipeline.map((item) => (
                <Link key={item.stage} href={item.href} className={styles.stagePill} data-active={item.count > 0 ? "true" : undefined}>
                  {item.stage}
                  <span className="tabular">{item.count}</span>
                </Link>
              ))}
            </div>
          </div>
        </article>

        <article className="card">
          <div className="card-head">
            <div>
              <h2>Urgent staffing needs</h2>
              <p className="card-sub">High priority, overdue, approaching start, or hard to fill.</p>
            </div>
            <Link href="/staffing/requirements?view=urgent" className="text-link">
              View all
            </Link>
          </div>
          <div className="card-body">
            {urgent.length === 0 ? (
              <EmptyState title="No urgent requirements" icon="checkCircle" />
            ) : (
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Requirement</th>
                      <th>Stage</th>
                      <th>Start</th>
                      <th>Why urgent</th>
                    </tr>
                  </thead>
                  <tbody>
                    {urgent.slice(0, 6).map((item) => (
                      <tr key={item.id}>
                        <td>
                          <Link href={item.href} className={styles.rowLink}>
                            {item.title}
                          </Link>
                          <div className="muted">{item.client}</div>
                          <div className={styles.metaRow}>
                            <PriorityChip priority={item.priority} />
                            <span className="chip">{item.matches} verified matches</span>
                          </div>
                        </td>
                        <td>
                          <span className="chip chip-dot">{item.stage}</span>
                        </td>
                        <td className="tabular">{formatDate(item.startDate)}</td>
                        <td>
                          <div className={styles.metaRow}>
                            {item.reasons.map((reason) => (
                              <span key={reason} className="chip">
                                {reason}
                              </span>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </article>
      </section>

      <section className={styles.opsGrid}>
        <article className="card">
          <div className="card-head">
            <div>
              <h2>Assignment overview</h2>
              <p className="card-sub">Live assignments (active, extended and upcoming) — start/end and renewal status.</p>
            </div>
            <Link href="/staffing/placements" className="text-link">
              All assignments
            </Link>
          </div>
          <div className="card-body">
            {assignments.length === 0 ? (
              <EmptyState title="No live assignments" icon="users">
                Confirm a placement to populate the assignment desk.
              </EmptyState>
            ) : (
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Associate</th>
                      <th>Client / role</th>
                      <th>Status</th>
                      <th>Dates</th>
                      <th>Renewal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {assignments.map((row) => (
                      <tr key={row.id}>
                        <td>
                          <Link href={`/staffing/associates/${row.associateId}`} className={styles.rowLink}>
                            {row.associateName}
                          </Link>
                        </td>
                        <td>
                          <div>{row.client}</div>
                          <Link href={row.href} className="muted">
                            {row.role}
                          </Link>
                        </td>
                        <td>
                          <span className="chip">{String(row.status).replace("_", " ")}</span>
                        </td>
                        <td className="tabular">
                          {row.startDate ? formatDate(row.startDate) : "—"} → {row.endDate ? formatDate(row.endDate) : "open"}
                        </td>
                        <td>
                          <span className={`chip ${row.renewal === "renewal_due" || row.renewal === "ending" ? "chip-high" : ""}`}>
                            {row.renewal.replace("_", " ")}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </article>

        <article className="card">
          <div className="card-head">
            <div>
              <h2>Upcoming actions</h2>
              <p className="card-sub">Interviews, availability checks, renewals, CVs and commercials.</p>
            </div>
            <Link href="/tasks" className="text-link">
              Action workspace
            </Link>
          </div>
          <div className="card-body">
            {actions.length === 0 ? (
              <EmptyState title="No upcoming staffing actions" icon="tasks" />
            ) : (
              <ul className={styles.actionList}>
                {actions.map((action) => (
                  <li key={action.id}>
                    <Link href={action.href} className={styles.actionItem}>
                      <span className={styles.actionIcon}>
                        <Icon name={action.kind === "interview" ? "calendar" : action.kind === "commercial" ? "wallet" : "tasks"} size={14} />
                      </span>
                      <span>
                        <b>{action.title}</b>
                        <small>
                          {ACTION_LABEL[action.kind] ?? "Follow-up"} · due {action.due ? formatDate(action.due) : "—"} · {action.priority}
                        </small>
                      </span>
                      <Icon name="chevronRight" size={14} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </article>
      </section>

      <section className={styles.split}>
        <article className="card">
          <div className="card-head">
            <div>
              <h2>Demand snapshot</h2>
              <p className="card-sub">Most-requested must-have skills on open requirements. Deeper trends live in Pulse.</p>
            </div>
            <Link href="/pulse" className="text-link">
              Open Pulse
            </Link>
          </div>
          <div className="card-body">
            {demand.skills.length === 0 ? (
              <EmptyState title="No open demand yet" />
            ) : (
              <BarList
                items={demand.skills.map((item) => ({ label: item.label, value: item.value }))}
                color="var(--brand)"
                onSelect={(label) => {
                  const match = demand.skills.find((item) => item.label === label);
                  if (match) router.push(match.href);
                }}
              />
            )}
          </div>
        </article>

        <article className="card">
          <div className="card-head">
            <div>
              <h2>Demand by sector</h2>
              <p className="card-sub">Open requirements by client sector.</p>
            </div>
          </div>
          <div className="card-body">
            {demand.sectors.length === 0 ? (
              <EmptyState title="No sector demand" />
            ) : (
              <div className={styles.metaRow}>
                {demand.sectors.map((item) => (
                  <Link key={item.label} href={item.href} className="chip chip-ai">
                    {item.label} · {item.value}
                  </Link>
                ))}
              </div>
            )}
            <p className="muted" style={{ marginTop: 14 }}>
              Pulse interprets capacity gaps and commercial risk; this desk stays operational.
            </p>
          </div>
        </article>
      </section>
    </div>
  );
}
