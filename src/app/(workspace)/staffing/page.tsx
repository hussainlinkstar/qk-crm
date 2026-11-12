"use client";

import Link from "next/link";
import { useMemo } from "react";
import Button from "@/components/ui/Button";
import Icon from "@/components/ui/Icon";
import { EmptyState, PriorityChip, SkeletonRows, useNow, useWorkspaceData } from "@/components/ui/bits";
import {
  assignmentsEndingSoon,
  mapRequirementToOpsStage,
  recruitmentPipeline,
  staffingCommandKpis,
  urgentStaffingNeeds,
  upcomingStaffingActions,
} from "@/lib/tessiant-insights";
import AssignmentRecommendedActions from "@/components/staffing/AssignmentRecommendedActions";
import SupplyDemand from "@/components/staffing/SupplyDemand";
import { staffingDeskFindings } from "@/lib/record-intelligence";
import { daysOpen, requirementPriority } from "@/lib/requisition";
import { recommendedMatches } from "@/lib/requirement-recommendations";
import { formatDate, todayKey } from "@/lib/format";
import styles from "./staffing.module.css";

const INITIAL_NOW = Date.now();

const ACTION_LABEL: Record<string, string> = {
  interview: "Interview",
  availability: "Availability check",
  feedback: "Feedback",
  assignment: "Renewal",
  cv: "CV update",
  commercial: "Client follow-up",
  other: "Follow-up",
};

export default function StaffingOverviewPage() {
  const { state } = useWorkspaceData();
  const now = useNow();
  const tessiant = state?.tessiant;

  const findings = useMemo(() => (state ? staffingDeskFindings(state, now || INITIAL_NOW) : []), [state, now]);
  const kpis = useMemo(() => (state ? staffingCommandKpis(state, now || INITIAL_NOW) : []), [state, now]);
  const pipeline = useMemo(() => (state ? recruitmentPipeline(state) : []), [state]);
  const openReqs = useMemo(() => (state ? urgentStaffingNeeds(state, now || INITIAL_NOW) : []), [state, now]);
  const allOpen = useMemo(() => {
    if (!state || !tessiant) return [];
    return tessiant.requirements
      .filter((req) => !req.archived && req.outcome === "active" && req.stage !== "Placed")
      .sort((a, b) => a.startDate.localeCompare(b.startDate));
  }, [state, tessiant]);
  const endingSoon = useMemo(() => {
    if (!state) return [];
    const today = todayKey();
    return assignmentsEndingSoon(state, today).map((placement) => {
      const associate = tessiant?.associates.find((item) => item.id === placement.associateId);
      const req = tessiant?.requirements.find((item) => item.id === placement.requirementId);
      const account = tessiant?.accounts.find((item) => item.id === (placement.accountId ?? req?.accountId));
      return {
        id: placement.id,
        associateName: associate?.name ?? "Associate",
        client: account?.name ?? "Client",
        endDate: placement.terms.endDate,
        renewal: placement.renewalStatus ?? "on_track",
        href: `/staffing/placements/${placement.id}`,
      };
    });
  }, [state, tessiant]);
  const actions = useMemo(() => (state ? upcomingStaffingActions(state) : []), [state]);
  const namedMatch = (() => {
    if (!state || !tessiant) return null;
    const rankedRequirements = [...tessiant.requirements]
      .filter((req) => !req.archived && req.outcome === "active" && req.stage !== "Placed")
      .sort((a, b) => {
        const rank = { high: 0, medium: 1, low: 2 };
        return rank[requirementPriority(a)] - rank[requirementPriority(b)] || a.startDate.localeCompare(b.startDate);
      });
    for (const requirement of rankedRequirements) {
      const match = recommendedMatches(state, requirement, 1).items[0];
      if (!match || match.presentation.suitabilityBand === "weak") continue;
      const account = tessiant.accounts.find((item) => item.id === requirement.accountId);
      return { requirement, match, accountName: account?.name ?? "Client" };
    }
    return null;
  })();
  const openRows = openReqs.length
    ? openReqs
    : allOpen.slice(0, 6).map((req) => {
        const account = tessiant?.accounts.find((item) => item.id === req.accountId);
        return {
          id: req.id,
          title: req.title,
          client: account?.name ?? "—",
          priority: requirementPriority(req),
          stage: mapRequirementToOpsStage(req),
          startDate: req.startDate,
          href: `/staffing/requirements/${req.id}`,
          matches: 0,
          reasons: [] as string[],
        };
      });

  if (!state || !tessiant) {
    return (
      <div className={`page ${styles.density}`}>
        <SkeletonRows rows={5} height={100} />
      </div>
    );
  }

  const pipelineTotal = pipeline.reduce((sum, item) => sum + item.count, 0);

  return (
    <div className={`page ${styles.density}`}>
      <header className="page-head">
        <div>
          <h1>Staffing Overview</h1>
          <p className="subtitle">Demand, talent and deployments.</p>
        </div>
        <div className="page-actions">
          <Link href="/staffing/requirements?new=1&layout=board" className="button-link">
            <Button icon="plus">New requirement</Button>
          </Link>
        </div>
      </header>

      <section className={styles.kpis} aria-label="Staffing summary">
        {kpis.map((item) => (
          <Link key={item.key} href={item.href} className="metric-card">
            <b className="tabular">{item.value}</b>
            <span className="metric-label">{item.label}</span>
            {item.delta ? <small className="metric-delta">{item.delta}</small> : null}
          </Link>
        ))}
      </section>

      {findings.length > 0 ? (
        <section className={styles.findingsStrip} aria-label="Staffing findings">
          {findings.map((item) => (
            <Link key={item.id} href={item.href} className={styles.findingsChip}>
              {item.label}
            </Link>
          ))}
        </section>
      ) : null}

      {namedMatch ? (
        <Link href={`/staffing/requirements/${namedMatch.requirement.id}`} className={styles.fitInsight}>
          <span>
            <small>Recorded talent match</small>
            <b>
              {namedMatch.match.associate.name} may fit {namedMatch.requirement.title}
            </b>
          </span>
          <span>
            {namedMatch.match.reason} {namedMatch.accountName} · {namedMatch.match.associate.availability}
            {namedMatch.match.unverified ? " · verification needed" : " · verified profile"}
          </span>
          <Icon name="arrowRight" size={15} />
        </Link>
      ) : null}

      <AssignmentRecommendedActions state={state} />

      <SupplyDemand state={state} />

      <section className={styles.opsSummary} aria-label="Recruitment pipeline">
        <div className={styles.opsSummaryHead}>
          <div>
            <h2>Recruitment pipeline</h2>
            <p className={styles.opsSummarySub}>
              <span className="tabular">{pipelineTotal}</span> requirements across stages
            </p>
          </div>
          <Link href="/staffing/requirements?layout=board" className="text-link">
            Open board
          </Link>
        </div>
        <ol className={styles.pipe}>
          {pipeline.map((item) => (
            <li key={item.stage}>
              <Link
                href={`/staffing/requirements?layout=board&opsStage=${encodeURIComponent(item.stage)}`}
                className={styles.pipeCard}
                data-empty={item.count === 0 ? "true" : undefined}
              >
                <b className="tabular">{item.count}</b>
                <span>{item.stage}</span>
              </Link>
            </li>
          ))}
        </ol>
      </section>

      <section className={styles.opsGridThree}>
        <article className="card">
          <div className="card-head">
            <div>
              <h2>Open requirements</h2>
            </div>
            <Link href="/staffing/requirements?view=open&layout=board" className="text-link">
              Board
            </Link>
          </div>
          <div className="card-body">
            {openRows.length === 0 ? (
              <EmptyState title="No open requirements" icon="flag" />
            ) : (
              <div className={styles.reqCards}>
                {openRows.slice(0, 5).map((item) => {
                  const req = tessiant.requirements.find((r) => r.id === item.id);
                  return (
                    <Link key={item.id} href={item.href} className={styles.reqCard}>
                      <span className={styles.reqCardTop}>
                        <b>{item.title}</b>
                        <PriorityChip priority={item.priority} />
                      </span>
                      <span className="muted">
                        {item.client} · {item.stage}
                      </span>
                      <span className={styles.reqCardFoot}>
                        <span className="chip tabular">{req?.headcount ?? "—"} pos</span>
                        <span className={`chip tabular ${"matches" in item && item.matches === 0 ? "chip-high" : ""}`}>
                          {item.matches} verified
                        </span>
                        <span className="muted tabular">{req ? `${daysOpen(req)}d open` : ""}</span>
                      </span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </article>

        <article className="card">
          <div className="card-head">
            <div>
              <h2>Upcoming actions</h2>
            </div>
            <Link href="/tasks" className="text-link">
              Tasks
            </Link>
          </div>
          <div className="card-body">
            {actions.length === 0 ? (
              <EmptyState title="No upcoming actions" icon="tasks" />
            ) : (
              <ul className={styles.actionList}>
                {actions.slice(0, 6).map((action) => (
                  <li key={action.id}>
                    <Link href={action.href} className={styles.actionItem}>
                      <span className={styles.actionIcon}>
                        <Icon
                          name={
                            action.kind === "interview"
                              ? "calendar"
                              : action.kind === "commercial"
                                ? "wallet"
                                : action.kind === "cv"
                                  ? "file"
                                  : "tasks"
                          }
                          size={14}
                        />
                      </span>
                      <span>
                        <b>{action.title}</b>
                        <small>
                          {ACTION_LABEL[action.kind] ?? "Follow-up"}
                          {action.due ? ` · ${formatDate(action.due)}` : ""}
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

        <article className="card">
          <div className="card-head">
            <div>
              <h2>Ending soon</h2>
            </div>
            <Link href="/staffing/placements?view=ending30" className="text-link">
              Assignments
            </Link>
          </div>
          <div className="card-body">
            {endingSoon.length === 0 ? (
              <EmptyState title="No assignments ending soon" icon="checkCircle" />
            ) : (
              <div className={styles.endingList}>
                {endingSoon.slice(0, 6).map((row) => (
                  <Link key={row.id} href={row.href} className={styles.endingItem}>
                    <span>
                      <b>{row.associateName}</b>
                      <small>
                        {row.client} · {row.endDate ? formatDate(row.endDate) : "—"}
                      </small>
                    </span>
                    <span className={`chip ${row.renewal === "renewal_due" || row.renewal === "ending" ? "chip-high" : ""}`}>
                      {String(row.renewal).replace("_", " ")}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </article>
      </section>
    </div>
  );
}
