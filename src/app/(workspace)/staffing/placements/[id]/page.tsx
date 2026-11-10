"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import Button from "@/components/ui/Button";
import { EmptyState, SkeletonRows, useWorkspaceData } from "@/components/ui/bits";
import { useWorkspace } from "@/components/shell/WorkspaceContext";
import { crm } from "@/lib/crm-store";
import {
  assignmentCapacity,
  assignmentRoleTitle,
  assignmentStatusLabel,
  deriveAssignmentStatus,
  resolveAssignmentAccountId,
} from "@/lib/assignments";
import { addDays, formatDate, todayKey } from "@/lib/format";
import { assignmentRenewalStatus, formatRate, marginForCandidate } from "@/lib/tessiant-insights";
import styles from "../../staffing.module.css";
import talent from "../../associates/talent.module.css";

type TabKey = "overview" | "commercials" | "documents" | "activity";

const TABS: { key: TabKey; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "commercials", label: "Commercials" },
  { key: "documents", label: "Documents" },
  { key: "activity", label: "Activity" },
];

export default function AssignmentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { state } = useWorkspaceData();
  const { toast } = useWorkspace();
  const tessiant = state?.tessiant;
  const assignment = tessiant?.placements.find((item) => item.id === id);
  const [tab, setTab] = useState<TabKey>("overview");
  const [note, setNote] = useState("");
  const [extendDate, setExtendDate] = useState("");
  const [availableDate, setAvailableDate] = useState(todayKey());
  const [cancelReason, setCancelReason] = useState("");
  const [capacity, setCapacity] = useState("");
  const [lifecycleAction, setLifecycleAction] = useState<"extend" | "capacity" | "complete" | "cancel" | null>(null);

  if (!state || !tessiant) {
    return (
      <div className={`page ${styles.density}`}>
        <SkeletonRows rows={6} height={64} />
      </div>
    );
  }

  if (!assignment) {
    return (
      <div className={`page ${styles.density}`}>
        <EmptyState title="Assignment not found" icon="checkCircle">
          <Link href="/staffing/placements">Back to assignments</Link>
        </EmptyState>
      </div>
    );
  }

  const today = todayKey();
  const status = deriveAssignmentStatus(assignment, today);
  const associate = tessiant.associates.find((item) => item.id === assignment.associateId);
  const accountId = resolveAssignmentAccountId(state, assignment);
  const account = tessiant.accounts.find((item) => item.id === accountId);
  const requirement = tessiant.requirements.find((item) => item.id === assignment.requirementId);
  const opportunity = requirement?.linkedOpportunityId
    ? state.opportunities?.find((item) => item.id === requirement.linkedOpportunityId)
    : undefined;
  const owner = state.members.find((item) => item.id === (assignment.ownerId ?? requirement?.ownerId));
  const renewal = assignmentRenewalStatus(assignment, today);
  const live = status === "upcoming" || status === "active" || status === "extended";
  const currentCapacity = assignmentCapacity(assignment);
  const roleTitle = assignmentRoleTitle(state, assignment);
  const notes = [...(assignment.engagementNotes ?? [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const documents = assignment.documents ?? [];

  return (
    <div className={`page ${styles.density}`}>
      <header className="page-head">
        <div>
          <p className="kicker">
            <Link href="/staffing/placements">Assignments</Link>
          </p>
          <h1>{roleTitle}</h1>
          <p className="subtitle">
            {associate?.name ?? "Associate"} · {account?.name ?? "Client"} ·{" "}
            {assignment.terms.startDate ? formatDate(assignment.terms.startDate) : "—"}
            {" → "}
            {assignment.terms.endDate ? formatDate(assignment.terms.endDate) : "open"} · {currentCapacity}% ·{" "}
            <span className="chip">{assignmentStatusLabel(status)}</span>
            <span className={`chip ${renewal === "renewal_due" || renewal === "ending" ? "chip-high" : ""}`} style={{ marginLeft: 6 }}>
              {renewal.replaceAll("_", " ")}
            </span>
          </p>
        </div>
        <div className="page-actions">
          <Link href={`/staffing/requirements/${assignment.requirementId}`}>
            <Button variant="secondary">Open requirement</Button>
          </Link>
          <Link href={`/staffing/associates/${assignment.associateId}`}>
            <Button variant="ghost">Associate profile</Button>
          </Link>
        </div>
      </header>

      <div className={styles.hierarchy} aria-label="Record links">
        {account && (
          <Link href={`/sales/accounts/${account.id}`} className={styles.rowLink}>
            {account.name}
          </Link>
        )}
        <span>/</span>
        {opportunity ? (
          <Link href={`/sales/pipeline`} className={styles.rowLink}>
            {opportunity.name}
          </Link>
        ) : (
          <span>No linked opportunity</span>
        )}
        <span>/</span>
        <Link href={`/staffing/requirements/${assignment.requirementId}`} className={styles.rowLink}>
          {requirement?.title ?? "Requirement"}
        </Link>
        <span>/</span>
        <b>{assignmentStatusLabel(status)}</b>
      </div>

      <div className={talent.tabs} role="tablist" aria-label="Assignment sections">
        {TABS.map((item) => (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={tab === item.key}
            className={talent.tab}
            data-active={tab === item.key}
            onClick={() => setTab(item.key)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <section className={styles.split}>
          <article className="card">
            <div className="card-head">
              <h2>Overview</h2>
            </div>
            <div className="card-body">
              <dl style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, margin: 0 }}>
                <div>
                  <div className="muted">Associate</div>
                  <b>
                    <Link href={`/staffing/associates/${assignment.associateId}`}>{associate?.name ?? "—"}</Link>
                  </b>
                </div>
                <div>
                  <div className="muted">Client</div>
                  <b>{account ? <Link href={`/sales/accounts/${account.id}`}>{account.name}</Link> : "—"}</b>
                </div>
                <div>
                  <div className="muted">Start date</div>
                  <b>{assignment.terms.startDate ? formatDate(assignment.terms.startDate) : "—"}</b>
                </div>
                <div>
                  <div className="muted">End date</div>
                  <b>{assignment.terms.endDate ? formatDate(assignment.terms.endDate) : "Open ended"}</b>
                </div>
                <div>
                  <div className="muted">Capacity</div>
                  <b>
                    {currentCapacity}% · {assignment.workingPattern ?? "—"}
                  </b>
                </div>
                <div>
                  <div className="muted">Resource manager</div>
                  <b>{owner?.name ?? "Unassigned"}</b>
                </div>
                {assignment.renewalDate ? (
                  <div>
                    <div className="muted">Renewal focus</div>
                    <b>{formatDate(assignment.renewalDate)}</b>
                  </div>
                ) : null}
                {assignment.confirmedAvailableDate ? (
                  <div>
                    <div className="muted">Available from</div>
                    <b>{formatDate(assignment.confirmedAvailableDate)}</b>
                  </div>
                ) : null}
              </dl>
            </div>
          </article>

          <article className="card">
            <div className="card-head">
              <h2>Lifecycle</h2>
            </div>
            <div className="card-body stack-gap">
              {live ? (
                <>
                  <div className={styles.actionRow}>
                    <Button size="small" variant={lifecycleAction === "extend" ? "primary" : "secondary"} onClick={() => setLifecycleAction(lifecycleAction === "extend" ? null : "extend")}>
                      Extend
                    </Button>
                    <Button size="small" variant={lifecycleAction === "capacity" ? "primary" : "secondary"} onClick={() => setLifecycleAction(lifecycleAction === "capacity" ? null : "capacity")}>
                      Capacity
                    </Button>
                    <Button size="small" variant={lifecycleAction === "complete" ? "primary" : "secondary"} onClick={() => setLifecycleAction(lifecycleAction === "complete" ? null : "complete")}>
                      Complete
                    </Button>
                    <Button
                      size="small"
                      variant="secondary"
                      onClick={() => {
                        const taskId = crm.ensureAssignmentRenewalFollowUp(assignment.id);
                        toast(
                          taskId ? "Redeployment / renewal follow-up created" : "Follow-up already exists or end date missing",
                          taskId ? "success" : "info",
                        );
                      }}
                    >
                      Redeploy / renew
                    </Button>
                    <Button size="small" variant={lifecycleAction === "cancel" ? "danger" : "ghost"} onClick={() => setLifecycleAction(lifecycleAction === "cancel" ? null : "cancel")}>
                      Cancel
                    </Button>
                  </div>

                  {lifecycleAction === "extend" && (
                    <div className={styles.actionBlock}>
                      <div className={styles.field}>
                        <label htmlFor="extendDate">New end date</label>
                        <input
                          id="extendDate"
                          type="date"
                          className="input"
                          min={assignment.terms.startDate || undefined}
                          value={extendDate || assignment.terms.endDate || addDays(30)}
                          onChange={(e) => setExtendDate(e.target.value)}
                        />
                      </div>
                      <div className={styles.actionRow}>
                        <Button
                          size="small"
                          onClick={() => {
                            const endDate = extendDate || assignment.terms.endDate || addDays(30);
                            if (assignment.terms.startDate && endDate < assignment.terms.startDate) {
                              toast("End date must be on or after the start date", "error");
                              return;
                            }
                            const result = crm.extendAssignment(assignment.id, {
                              endDate,
                              renewalDate: endDate,
                              note: note || undefined,
                            });
                            if (!result.ok) {
                              toast(result.error, "error");
                              return;
                            }
                            toast("Assignment extended", "success");
                            setLifecycleAction(null);
                            setNote("");
                          }}
                        >
                          Confirm extension
                        </Button>
                      </div>
                    </div>
                  )}

                  {lifecycleAction === "capacity" && (
                    <div className={styles.actionBlock}>
                      <div className={styles.field}>
                        <label htmlFor="capacityPct">Committed capacity %</label>
                        <div className={styles.actionRow}>
                          <input
                            id="capacityPct"
                            type="number"
                            min={10}
                            max={100}
                            step={10}
                            className="input"
                            value={capacity || String(currentCapacity)}
                            onChange={(e) => setCapacity(e.target.value)}
                          />
                          <Button
                            size="small"
                            variant="secondary"
                            onClick={() => {
                              const next = Number(capacity || currentCapacity);
                              if (!Number.isFinite(next) || next < 10 || next > 100) {
                                toast("Capacity must be between 10 and 100", "error");
                                return;
                              }
                              crm.updatePlacement(assignment.id, { capacityPercent: next });
                              toast(`Capacity updated to ${next}%`, "success");
                              setLifecycleAction(null);
                            }}
                          >
                            Save capacity
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}

                  {lifecycleAction === "complete" && (
                    <div className={styles.actionBlock}>
                      <div className={styles.field}>
                        <label htmlFor="availableDate">Confirmed available date</label>
                        <input id="availableDate" type="date" className="input" value={availableDate} onChange={(e) => setAvailableDate(e.target.value)} />
                      </div>
                      <div className={styles.actionRow}>
                        <Button
                          size="small"
                          variant="secondary"
                          onClick={() => {
                            if (!availableDate) {
                              toast("Confirm the date the associate becomes available", "error");
                              return;
                            }
                            crm.completeAssignment(assignment.id, {
                              confirmedAvailableDate: availableDate,
                              note: note || undefined,
                            });
                            toast("Assignment completed. Availability updated from the confirmed date.", "success");
                            setLifecycleAction(null);
                            setNote("");
                          }}
                        >
                          Confirm completion
                        </Button>
                      </div>
                    </div>
                  )}

                  {lifecycleAction === "cancel" && (
                    <div className={styles.actionBlock}>
                      <div className={styles.field}>
                        <label htmlFor="cancelReason">Cancellation reason</label>
                        <input id="cancelReason" className="input" value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} />
                      </div>
                      <div className={styles.actionRow}>
                        <Button
                          size="small"
                          variant="danger"
                          onClick={() => {
                            if (!cancelReason.trim()) {
                              toast("Add a cancellation reason", "error");
                              return;
                            }
                            crm.cancelAssignment(assignment.id, cancelReason);
                            toast("Assignment cancelled", "info");
                            setCancelReason("");
                            setLifecycleAction(null);
                          }}
                        >
                          Confirm cancellation
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <p className="muted">This assignment is {assignmentStatusLabel(status)}. Historical record is preserved.</p>
              )}
            </div>
          </article>
        </section>
      )}

      {tab === "commercials" && (
        <section className="card">
          <div className="card-head">
            <div>
              <h2>Commercial terms</h2>
            </div>
          </div>
          <div className="card-body">
            <dl style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, margin: 0 }}>
              <div>
                <div className="muted">Client rate</div>
                <b className="tabular">{formatRate(assignment.terms.clientRate)}</b>
              </div>
              <div>
                <div className="muted">Associate cost</div>
                <b className="tabular">{formatRate(assignment.terms.associateCost)}</b>
              </div>
              <div>
                <div className="muted">Margin</div>
                <b className="tabular">
                  {marginForCandidate(assignment.terms.associateCost, assignment.terms.clientRate)}
                </b>
              </div>
            </dl>
            {assignment.terms.notes ? (
              <p className="muted" style={{ marginTop: 12 }}>
                {assignment.terms.notes}
              </p>
            ) : null}
          </div>
        </section>
      )}

      {tab === "documents" && (
        <section className="card">
          <div className="card-head">
            <h2>Documents</h2>
          </div>
          <div className="card-body">
            {documents.length === 0 ? (
              <EmptyState title="No documents attached" icon="file" />
            ) : (
              <ul className={styles.timeline}>
                {documents.map((doc) => (
                  <li key={doc.id}>
                    <b>{doc.name}</b>
                    <div className="muted">
                      {doc.kind} · {formatDate(doc.uploadedAt)}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}

      {tab === "activity" && (
        <section className={styles.split}>
          <article className="card">
            <div className="card-head">
              <h2>Engagement notes</h2>
            </div>
            <div className="card-body">
              {notes.length === 0 ? (
                <EmptyState title="No notes yet" />
              ) : (
                <ul className={styles.timeline}>
                  {notes.map((item) => (
                    <li key={item.id}>
                      <b>{item.kind}</b>
                      <div className="muted">{formatDate(item.createdAt)}</div>
                      <p>{item.body}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </article>
          <article className="card">
            <div className="card-head">
              <h2>Add note</h2>
            </div>
            <div className="card-body">
              <div className={styles.actionBlock}>
                <div className={styles.field}>
                  <label htmlFor="asgNote">Engagement note</label>
                  <input id="asgNote" className="input" value={note} onChange={(e) => setNote(e.target.value)} />
                </div>
                <div className={styles.actionRow}>
                  <Button
                    size="small"
                    variant="secondary"
                    disabled={!note.trim()}
                    onClick={() => {
                      crm.addAssignmentNote(assignment.id, note);
                      toast("Note added", "success");
                      setNote("");
                    }}
                  >
                    Save note
                  </Button>
                </div>
              </div>
            </div>
          </article>
        </section>
      )}
    </div>
  );
}
