"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Button from "@/components/ui/Button";
import { EmptyState, SkeletonRows, useNow, useWorkspaceData } from "@/components/ui/bits";
import { formatDate, toDateKey } from "@/lib/format";
import {
  assignmentDashboard,
  assignmentRoleTitle,
  assignmentStatusLabel,
  clientDeploymentViews,
  deriveAssignmentStatus,
  filterAssignments,
  resolveAssignmentAccountId,
  type AssignmentListView,
} from "@/lib/assignments";
import { assignmentRenewalStatus, formatRate, marginForCandidate, placementsThisMonth } from "@/lib/tessiant-insights";
import styles from "../staffing.module.css";

const VIEWS: { id: AssignmentListView; label: string }[] = [
  { id: "all", label: "All" },
  { id: "active", label: "Active" },
  { id: "upcoming", label: "Starting soon" },
  { id: "ending30", label: "Ending 30d" },
  { id: "ending60", label: "Ending 60d" },
  { id: "renewals", label: "Renewals" },
  { id: "completed", label: "Completed" },
  { id: "clients", label: "By client" },
];

export default function AssignmentsPage() {
  const router = useRouter();
  const params = useSearchParams();
  const viewParam = (params.get("view") as AssignmentListView | null) || "all";
  const highlight = params.get("highlight");
  const { state } = useWorkspaceData();
  const now = useNow();
  const tessiant = state?.tessiant;
  const [layout, setLayout] = useState<"assignments" | "clients">(viewParam === "clients" ? "clients" : "assignments");

  const today = toDateKey(new Date(now || Date.now()));
  const view = layout === "clients" ? "clients" : viewParam === "clients" ? "all" : viewParam;

  const dashboard = useMemo(() => (state ? assignmentDashboard(state, today) : null), [state, today]);
  const rows = useMemo(() => (state ? filterAssignments(state, view, today) : []), [state, view, today]);
  const clientRows = useMemo(() => (state ? clientDeploymentViews(state, today) : []), [state, today]);
  const monthCount = state ? placementsThisMonth(state, new Date(now || Date.now())).length : 0;

  if (!state || !tessiant || !dashboard) {
    return (
      <div className="page">
        <SkeletonRows rows={5} height={64} />
      </div>
    );
  }

  const setView = (next: AssignmentListView) => {
    if (next === "clients") {
      setLayout("clients");
      router.push("/staffing/placements?view=clients");
      return;
    }
    setLayout("assignments");
    router.push(next === "all" ? "/staffing/placements" : `/staffing/placements?view=${next}`);
  };

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Assignments & deployment</h1>
          <p className="subtitle">
            Track deployed associates, capacity, renewals and client deployments after a placement is confirmed.
          </p>
        </div>
        <div className="page-actions">
          <div className={styles.viewToggle} role="group" aria-label="Assignment views">
            <button type="button" aria-pressed={layout === "assignments"} onClick={() => setView(view === "clients" ? "all" : view)}>
              Assignments
            </button>
            <button type="button" aria-pressed={layout === "clients"} onClick={() => setView("clients")}>
              Client deployment
            </button>
          </div>
        </div>
      </header>

      <div className={styles.statStrip} aria-label="Assignment dashboard">
        <Link href="/staffing/placements?view=active" className={styles.statLink}>
          <b className="tabular">{dashboard.active}</b>
          <span>Active assignments</span>
        </Link>
        <div>
          <b className="tabular">{dashboard.deployedAssociates}</b>
          <span>Associates deployed</span>
        </div>
        <div>
          <b className="tabular">{dashboard.clientsWithDeployments}</b>
          <span>Clients with resources</span>
        </div>
        <Link href="/staffing/placements?view=upcoming" className={styles.statLink}>
          <b className="tabular">{dashboard.startingSoon}</b>
          <span>Starting soon</span>
        </Link>
        <Link href="/staffing/placements?view=ending30" className={styles.statLink}>
          <b className="tabular">{dashboard.ending30}</b>
          <span>Ending in 30 days</span>
        </Link>
        <Link href="/staffing/placements?view=ending60" className={styles.statLink}>
          <b className="tabular">{dashboard.ending60}</b>
          <span>Ending in 60 days</span>
        </Link>
        <Link href="/staffing/placements?view=renewals" className={styles.statLink}>
          <b className="tabular">{dashboard.renewals}</b>
          <span>Pending renewals</span>
        </Link>
        <Link href="/staffing/placements?view=completed" className={styles.statLink}>
          <b className="tabular">{dashboard.completed}</b>
          <span>Completed · {monthCount} placed this month</span>
        </Link>
      </div>

      {layout === "clients" ? (
        <section className="card">
          <div className="card-head">
            <div>
              <h2>Client deployment view</h2>
              <p className="card-sub">Who is working where, in which role, and what frees up soon.</p>
            </div>
          </div>
          <div className="card-body">
            {clientRows.length === 0 ? (
              <EmptyState title="No live client deployments" icon="building" />
            ) : (
              <div className={styles.stack}>
                {clientRows.map((row) => (
                  <article key={row.accountId} className={styles.matchCard} style={{ gridTemplateColumns: "1fr" }}>
                    <div>
                      <div className={styles.metaRow}>
                        <b>{row.accountName}</b>
                        <span className="chip tabular">{row.associateCount} associates</span>
                        {row.endingSoonCount > 0 && <span className="chip">{row.endingSoonCount} ending soon</span>}
                        {row.renewalCount > 0 && <span className="chip chip-ai">{row.renewalCount} need renewal</span>}
                      </div>
                      <div className={styles.tableWrap} style={{ marginTop: 10 }}>
                        <table className={styles.table}>
                          <thead>
                            <tr>
                              <th>Associate</th>
                              <th>Role</th>
                              <th>Started</th>
                              <th>Expires</th>
                              <th>Capacity</th>
                              <th>Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {row.assignments.map((assignment) => {
                              const associate = tessiant.associates.find((item) => item.id === assignment.associateId);
                              const status = deriveAssignmentStatus(assignment, today);
                              return (
                                <tr key={assignment.id}>
                                  <td>
                                    <Link href={`/staffing/placements/${assignment.id}`} className={styles.rowLink}>
                                      {associate?.name ?? assignment.associateId}
                                    </Link>
                                  </td>
                                  <td>{assignmentRoleTitle(state, assignment)}</td>
                                  <td className="tabular">{assignment.terms.startDate ? formatDate(assignment.terms.startDate) : "—"}</td>
                                  <td className="tabular">{assignment.terms.endDate ? formatDate(assignment.terms.endDate) : "open"}</td>
                                  <td className="tabular">{assignment.capacityPercent ?? 100}%</td>
                                  <td>
                                    <span className="chip">{assignmentStatusLabel(status)}</span>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                      {row.freeingSoon.length > 0 && (
                        <p className="muted" style={{ marginTop: 8 }}>
                          Freeing soon:{" "}
                          {row.freeingSoon
                            .map((item) => tessiant.associates.find((a) => a.id === item.associateId)?.name ?? item.associateId)
                            .join(", ")}
                        </p>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>
      ) : (
        <>
          <div className={styles.sectionNav} style={{ marginBottom: 12 }}>
            {VIEWS.filter((item) => item.id !== "clients").map((item) => (
              <button
                key={item.id}
                type="button"
                className={styles.stagePill}
                data-active={(view === "all" ? "all" : view) === item.id}
                onClick={() => setView(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>

          <section className="card">
            <div className="card-head">
              <div>
                <h2>{VIEWS.find((item) => item.id === view)?.label ?? "Assignments"}</h2>
                <p className="card-sub tabular">{rows.length} records · placement is the confirmation event inside each assignment</p>
              </div>
            </div>
            <div className="card-body">
              {rows.length === 0 ? (
                <EmptyState title="No assignments in this view" icon="checkCircle">
                  Confirm a placement from a requirement to activate an assignment, or clear filters.
                </EmptyState>
              ) : (
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Assignment</th>
                        <th>Client</th>
                        <th>Associate</th>
                        <th>Dates</th>
                        <th>Capacity</th>
                        <th>Commercials</th>
                        <th>Owner</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((assignment) => {
                        const associate = tessiant.associates.find((item) => item.id === assignment.associateId);
                        const accountId = resolveAssignmentAccountId(state, assignment);
                        const account = tessiant.accounts.find((item) => item.id === accountId);
                        const owner = state.members.find((item) => item.id === assignment.ownerId);
                        const status = deriveAssignmentStatus(assignment, today);
                        const renewal = assignmentRenewalStatus(assignment, today);
                        const highlighted = highlight === assignment.id;
                        return (
                          <tr key={assignment.id} style={highlighted ? { background: "var(--brand-soft)" } : undefined}>
                            <td>
                              <Link href={`/staffing/placements/${assignment.id}`} className={styles.rowLink}>
                                {assignmentRoleTitle(state, assignment)}
                              </Link>
                              <div className="muted">
                                <Link href={`/staffing/requirements/${assignment.requirementId}`}>Requirement</Link>
                                {assignment.placementDate ? ` · placed ${formatDate(assignment.placementDate.slice(0, 10))}` : ""}
                              </div>
                            </td>
                            <td>{account?.name ?? "—"}</td>
                            <td>
                              <Link href={`/staffing/associates/${assignment.associateId}`} className={styles.rowLink}>
                                {associate?.name ?? "—"}
                              </Link>
                            </td>
                            <td className="tabular">
                              {assignment.terms.startDate ? formatDate(assignment.terms.startDate) : "—"} →{" "}
                              {assignment.terms.endDate ? formatDate(assignment.terms.endDate) : "open"}
                              <div className="muted">{renewal.replaceAll("_", " ")}</div>
                            </td>
                            <td className="tabular">
                              {assignment.capacityPercent ?? 100}%
                              <div className="muted">{assignment.workingPattern ?? "—"}</div>
                            </td>
                            <td>
                              <div className="tabular">Client {formatRate(assignment.terms.clientRate)}</div>
                              <div className="muted tabular">Cost {formatRate(assignment.terms.associateCost)}</div>
                              <div className="muted">{marginForCandidate(assignment.terms.associateCost, assignment.terms.clientRate)}</div>
                            </td>
                            <td>{owner?.name ?? "Unassigned"}</td>
                            <td>
                              <span className="chip">{assignmentStatusLabel(status)}</span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
