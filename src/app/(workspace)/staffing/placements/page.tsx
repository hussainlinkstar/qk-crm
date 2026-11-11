"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AssignmentQuickPanel from "@/components/staffing/AssignmentQuickPanel";
import AssignmentRecommendedActions from "@/components/staffing/AssignmentRecommendedActions";
import { EmptyState, SkeletonRows, useNow, useWorkspaceData } from "@/components/ui/bits";
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
import { formatDate, toDateKey } from "@/lib/format";
import { assignmentRenewalStatus } from "@/lib/tessiant-insights";
import styles from "../staffing.module.css";

const VIEWS: { id: AssignmentListView; label: string }[] = [
  { id: "all", label: "All" },
  { id: "active", label: "Deployed" },
  { id: "live", label: "Active" },
  { id: "upcoming", label: "Starting soon" },
  { id: "ending30", label: "Ending soon" },
  { id: "renewals", label: "Renewals" },
  { id: "month", label: "This month" },
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
  const [previewId, setPreviewId] = useState<string | null>(null);

  const today = toDateKey(new Date(now || Date.now()));
  const view = layout === "clients" ? "clients" : viewParam === "clients" ? "all" : viewParam;

  const dashboard = useMemo(() => (state ? assignmentDashboard(state, today) : null), [state, today]);
  const rows = useMemo(() => (state ? filterAssignments(state, view, today) : []), [state, view, today]);
  const clientRows = useMemo(() => (state ? clientDeploymentViews(state, today) : []), [state, today]);

  if (!state || !tessiant || !dashboard) {
    return (
      <div className={`page ${styles.density}`}>
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
    <div className={`page ${styles.density}`}>
      <header className="page-head">
        <div>
          <h1>Assignments</h1>
          <p className="subtitle">Deployments, capacity and renewals.</p>
        </div>
        <div className="page-actions">
          <div className="segmented" role="group" aria-label="Assignment views">
            <button type="button" aria-pressed={layout === "assignments"} onClick={() => setView(view === "clients" ? "all" : view)}>
              Assignments
            </button>
            <button type="button" aria-pressed={layout === "clients"} onClick={() => setView("clients")}>
              Client deployment
            </button>
          </div>
        </div>
      </header>

      <AssignmentRecommendedActions state={state} compact />

      <section className="metric-grid metric-grid-4" aria-label="Assignment KPIs">
        <Link href="/staffing/placements?view=active" className="metric-card">
          <span className="metric-label">Active</span>
          <b className="tabular">{dashboard.active}</b>
        </Link>
        <Link href="/staffing/placements?view=upcoming" className="metric-card">
          <span className="metric-label">Starting soon</span>
          <b className="tabular">{dashboard.startingSoon}</b>
        </Link>
        <Link href="/staffing/placements?view=ending30" className="metric-card">
          <span className="metric-label">Ending soon</span>
          <b className="tabular">{dashboard.ending30}</b>
        </Link>
        <Link href="/staffing/placements?view=renewals" className="metric-card">
          <span className="metric-label">Pending renewal</span>
          <b className="tabular">{dashboard.renewals}</b>
        </Link>
      </section>

      {layout === "clients" ? (
        <section className="card">
          <div className="card-head">
            <h2>Client deployment</h2>
          </div>
          <div className="card-body">
            {clientRows.length === 0 ? (
              <EmptyState title="No live client deployments" icon="building" />
            ) : (
              <div className={styles.stack}>
                {clientRows.map((row) => (
                  <article key={row.accountId} className={styles.clientDeployCard}>
                    <div className={styles.metaRow}>
                      <b>
                        <Link href={`/sales/accounts/${row.accountId}`} className={styles.rowLink}>
                          {row.accountName}
                        </Link>
                      </b>
                      <span className="chip tabular">{row.associateCount} associates</span>
                      {row.endingSoonCount > 0 && <span className="chip">{row.endingSoonCount} ending soon</span>}
                      {row.renewalCount > 0 && <span className="chip">{row.renewalCount} renewal</span>}
                    </div>
                    <div className="table-wrap" style={{ marginTop: 10 }}>
                      <table className="table">
                        <thead>
                          <tr>
                            <th>Associate</th>
                            <th>Role</th>
                            <th>Start</th>
                            <th>End</th>
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
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>
      ) : (
        <>
          <div className={styles.sectionNav}>
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
                <p className="card-sub tabular">{rows.length} records</p>
              </div>
            </div>
            <div className="card-body">
              {rows.length === 0 ? (
                <EmptyState title="No assignments in this view" icon="checkCircle" />
              ) : (
                <div className="table-wrap">
                  <table className={`table ${styles.assignTable}`}>
                    <thead>
                      <tr>
                        <th>Role</th>
                        <th>Associate</th>
                        <th>Client</th>
                        <th>Dates</th>
                        <th>Capacity</th>
                        <th>Status</th>
                        <th>Renewal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((assignment) => {
                        const associate = tessiant.associates.find((item) => item.id === assignment.associateId);
                        const accountId = resolveAssignmentAccountId(state, assignment);
                        const account = tessiant.accounts.find((item) => item.id === accountId);
                        const status = deriveAssignmentStatus(assignment, today);
                        const renewal = assignmentRenewalStatus(assignment, today);
                        const highlighted = highlight === assignment.id;
                        const ending = renewal === "ending" || renewal === "renewal_due";
                        return (
                          <tr
                            key={assignment.id}
                            className={renewal === "ending" ? styles.endingRow : renewal === "renewal_due" ? styles.renewalRow : undefined}
                            style={highlighted ? { background: "var(--brand-soft)" } : undefined}
                            onClick={() => setPreviewId(assignment.id)}
                          >
                            <td className="nowrap">
                              <button type="button" className={styles.rowLink} onClick={() => setPreviewId(assignment.id)}>
                                {assignmentRoleTitle(state, assignment)}
                              </button>
                            </td>
                            <td className="nowrap">
                              <Link
                                href={`/staffing/associates/${assignment.associateId}`}
                                className={styles.rowLink}
                                onClick={(event) => event.stopPropagation()}
                              >
                                {associate?.name ?? "—"}
                              </Link>
                            </td>
                            <td className="nowrap">
                              {account ? (
                                <Link
                                  href={`/sales/accounts/${account.id}`}
                                  className={styles.rowLink}
                                  onClick={(event) => event.stopPropagation()}
                                >
                                  {account.name}
                                </Link>
                              ) : (
                                "—"
                              )}
                            </td>
                            <td className="tabular nowrap">
                              {assignment.terms.startDate ? formatDate(assignment.terms.startDate) : "—"}
                              {" → "}
                              {assignment.terms.endDate ? formatDate(assignment.terms.endDate) : "open"}
                            </td>
                            <td className="tabular nowrap">{assignment.capacityPercent ?? 100}%</td>
                            <td className="nowrap">
                              <span className="chip">{assignmentStatusLabel(status)}</span>
                            </td>
                            <td className="nowrap">
                              <span className={`chip ${ending ? "chip-high" : ""}`}>{renewal.replaceAll("_", " ")}</span>
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

      {previewId ? <AssignmentQuickPanel assignmentId={previewId} onClose={() => setPreviewId(null)} /> : null}
    </div>
  );
}
