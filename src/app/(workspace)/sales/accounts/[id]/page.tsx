"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import Button from "@/components/ui/Button";
import { EmptyState, SkeletonRows, useWorkspaceData } from "@/components/ui/bits";
import { useWorkspace } from "@/components/shell/WorkspaceContext";
import { crm } from "@/lib/crm-store";
import { assignmentRoleTitle, assignmentStatusLabel, deriveAssignmentStatus } from "@/lib/assignments";
import { formatDate, timeAgo } from "@/lib/format";
import { client360 } from "@/lib/sales-crm";

export default function Client360Page() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { state } = useWorkspaceData();
  const { toast, openTaskForm } = useWorkspace();
  const [secondaryId, setSecondaryId] = useState("m_sarah");
  const [feedback, setFeedback] = useState("");

  if (!state) {
    return (
      <div className="page">
        <SkeletonRows rows={6} height={72} />
      </div>
    );
  }

  const view = client360(state, id);
  if (!view) {
    return (
      <div className="page">
        <EmptyState title="Account not found" icon="building">
          <Link href="/sales/accounts">Back to accounts</Link>
        </EmptyState>
      </div>
    );
  }

  const { account, commercial } = view;

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <p className="kicker">
            <Link href="/sales/accounts">Accounts</Link>
          </p>
          <h1>{account.name}</h1>
          <p className="subtitle">
            Client 360 · {account.sector} · {account.status} · {account.industry}
          </p>
        </div>
        <div className="page-actions">
          <Link href={`/sales/pipeline?account=${account.id}`}>
            <Button variant="secondary">Account pipeline</Button>
          </Link>
          <Button
            icon="tasks"
            onClick={() =>
              openTaskForm({
                title: "Account follow-up",
                initial: {
                  title: `Follow up · ${account.name}`,
                  description: `Account ${account.id}`,
                  leadId: account.linkedLeadId,
                  priority: "medium",
                  due: null,
                  ownerId: account.primaryOwnerId ?? "me",
                },
              })
            }
          >
            Add activity
          </Button>
        </div>
      </header>

      {view.founderDependency && (
        <div className="notice-banner" role="status">
          <div>
            <b>Relationship concentration</b>
            <div>Only a primary owner is set. Add a secondary owner to reduce founder or executive dependency.</div>
          </div>
        </div>
      )}

      <section className="card" style={{ marginBottom: 14 }}>
        <div className="card-head">
          <h2>Company overview</h2>
        </div>
        <div className="card-body">
          <p>{account.notes}</p>
          <p className="muted">
            Services of interest: {(account.offeringInterests ?? []).join(", ") || "—"}
          </p>
          <p className="muted">
            Services purchased: {(account.servicesPurchased ?? []).join(", ") || "None recorded"}
          </p>
          <p className="muted">Website: {account.website ?? "—"} · Billing {account.billingCurrency ?? "GBP"}</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
            <span className="chip">Primary: {view.primary?.name ?? "Unassigned"}</span>
            <span className="chip">Secondary: {view.secondary?.name ?? "None"}</span>
            {!account.secondaryOwnerId && (
              <>
                <select className="input" style={{ maxWidth: 180 }} value={secondaryId} onChange={(e) => setSecondaryId(e.target.value)}>
                  {state.members.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.name}
                    </option>
                  ))}
                </select>
                <Button
                  size="small"
                  onClick={() => {
                    crm.updateAccountOwners(account.id, account.primaryOwnerId, secondaryId);
                    toast("Secondary relationship owner added", "success");
                  }}
                >
                  Add secondary owner
                </Button>
              </>
            )}
          </div>
        </div>
      </section>

      <section style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 10, marginBottom: 14 }}>
        <div className="card">
          <div className="card-body">
            <b className="tabular">£{commercial.pipeline.toLocaleString("en-GB")}</b>
            <div className="muted">Open pipeline value</div>
          </div>
        </div>
        <div className="card">
          <div className="card-body">
            <b className="tabular">£{commercial.agreed.toLocaleString("en-GB")}</b>
            <div className="muted">Agreed contract</div>
          </div>
        </div>
        <div className="card">
          <div className="card-body">
            <b className="tabular">£{commercial.expectedBilling.toLocaleString("en-GB")}</b>
            <div className="muted">Expected billing</div>
          </div>
        </div>
        <div className="card">
          <div className="card-body">
            <b className="tabular">£{commercial.recognised.toLocaleString("en-GB")}</b>
            <div className="muted">Recognised revenue</div>
          </div>
        </div>
      </section>

      <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <article className="card">
          <div className="card-head">
            <h2>Contacts</h2>
          </div>
          <div className="card-body">
            {view.contacts.length === 0 ? (
              <EmptyState title="No contacts" />
            ) : (
              <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                {view.contacts.map((contact) => (
                  <li key={contact.id} style={{ padding: "8px 0", borderBottom: "1px solid var(--line-soft)" }}>
                    <b>
                      {contact.name}
                      {contact.isPrimary ? " · Primary" : ""}
                    </b>
                    <div className="muted">
                      {contact.role ?? "—"} · {contact.email}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </article>

        <article className="card">
          <div className="card-head">
            <h2>Sales pipeline</h2>
          </div>
          <div className="card-body">
            {view.opportunities.length === 0 ? (
              <EmptyState title="No opportunities" />
            ) : (
              <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                {view.opportunities.map((opportunity) => (
                  <li key={opportunity.id} style={{ padding: "8px 0", borderBottom: "1px solid var(--line-soft)" }}>
                    <b>{opportunity.name}</b>
                    <div className="muted">
                      {opportunity.stage} · {opportunity.type} · £{opportunity.amount.toLocaleString("en-GB")}
                      {opportunity.stage === "Closed Won" && opportunity.agreedContractValue != null
                        ? ` · agreed £${opportunity.agreedContractValue.toLocaleString("en-GB")}`
                        : ""}
                    </div>
                    {(opportunity.stage === "Closed Won" || opportunity.stage === "Negotiation" || opportunity.stage === "Proposal") && (
                      <Button
                        size="small"
                        style={{ marginTop: 6 }}
                        onClick={() => {
                          const result = crm.createRequirementFromOpportunity(opportunity.id);
                          if (!result.ok) {
                            toast(result.error, "error");
                            return;
                          }
                          toast("Requirement generated from opportunity", "success");
                          router.push(`/staffing/requirements/${result.requirementId}`);
                        }}
                      >
                        Generate staffing requirement
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </article>

        <article className="card">
          <div className="card-head">
            <h2>Active staffing requirements</h2>
          </div>
          <div className="card-body">
            {view.activeRequirements.length === 0 ? (
              <EmptyState title="No open requirements" />
            ) : (
              <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                {view.activeRequirements.map((req) => (
                  <li key={req.id} style={{ padding: "8px 0", borderBottom: "1px solid var(--line-soft)" }}>
                    <Link href={`/staffing/requirements/${req.id}`}>{req.title}</Link>
                    <div className="muted">
                      {req.stage} · {req.category} · opp {req.linkedOpportunityId ?? "—"}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </article>

        <article className="card">
          <div className="card-head">
            <h2>Current deployed associates</h2>
          </div>
          <div className="card-body">
            {view.liveAssignments.length === 0 ? (
              <EmptyState title="No live deployments" />
            ) : (
              <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                {view.liveAssignments.map((assignment) => {
                  const associate = state.tessiant?.associates.find((item) => item.id === assignment.associateId);
                  return (
                    <li key={assignment.id} style={{ padding: "8px 0", borderBottom: "1px solid var(--line-soft)" }}>
                      <Link href={`/staffing/placements/${assignment.id}`}>
                        {associate?.name ?? "Associate"} · {assignmentRoleTitle(state, assignment)}
                      </Link>
                      <div className="muted">
                        {assignmentStatusLabel(deriveAssignmentStatus(assignment))} · started{" "}
                        {assignment.terms.startDate ? formatDate(assignment.terms.startDate) : "—"} · ends{" "}
                        {assignment.terms.endDate ? formatDate(assignment.terms.endDate) : "open"}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </article>

        <article className="card">
          <div className="card-head">
            <h2>Past placements / assignments</h2>
          </div>
          <div className="card-body">
            {view.pastAssignments.length === 0 ? (
              <EmptyState title="No past assignments" />
            ) : (
              <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                {view.pastAssignments.map((assignment) => {
                  const associate = state.tessiant?.associates.find((item) => item.id === assignment.associateId);
                  return (
                    <li key={assignment.id} style={{ padding: "8px 0", borderBottom: "1px solid var(--line-soft)" }}>
                      <Link href={`/staffing/placements/${assignment.id}`}>{associate?.name ?? "Associate"}</Link>
                      <div className="muted">
                        {assignmentRoleTitle(state, assignment)} · {assignmentStatusLabel(deriveAssignmentStatus(assignment))}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </article>

        <article className="card">
          <div className="card-head">
            <h2>Advisory / consultancy engagements</h2>
          </div>
          <div className="card-body">
            {view.won.filter((item) => item.type === "advisory" || item.type === "consultancy").length === 0 ? (
              <EmptyState title="No advisory/consultancy wins recorded" />
            ) : (
              <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                {view.won
                  .filter((item) => item.type === "advisory" || item.type === "consultancy")
                  .map((opportunity) => (
                    <li key={opportunity.id} style={{ padding: "8px 0", borderBottom: "1px solid var(--line-soft)" }}>
                      <b>{opportunity.name}</b>
                      <div className="muted">
                        Agreed £{(opportunity.agreedContractValue ?? opportunity.amount).toLocaleString("en-GB")} · recognised £
                        {(opportunity.recognisedRevenue ?? 0).toLocaleString("en-GB")}
                      </div>
                    </li>
                  ))}
              </ul>
            )}
          </div>
        </article>

        <article className="card">
          <div className="card-head">
            <h2>Client feedback</h2>
          </div>
          <div className="card-body">
            <label className="field">
              <span>Record feedback</span>
              <textarea
                className="textarea"
                rows={3}
                value={feedback}
                onChange={(event) => setFeedback(event.target.value)}
                placeholder="What did the client say about delivery, quality or next steps?"
              />
            </label>
            <Button
              size="small"
              icon="check"
              style={{ marginTop: 8 }}
              onClick={() => {
                const result = crm.recordClientFeedback({
                  accountId: account.id,
                  body: feedback,
                  placementId: view.liveAssignments[0]?.id ?? null,
                  sentiment: "neutral",
                });
                if (!result.ok) {
                  toast(result.error, "error");
                  return;
                }
                setFeedback("");
                toast("Client feedback recorded");
              }}
            >
              Save feedback
            </Button>
          </div>
        </article>

        <article className="card">
          <div className="card-head">
            <h2>Activities & next actions</h2>
          </div>
          <div className="card-body">
            {view.tasks.length > 0 && (
              <ul style={{ listStyle: "none", margin: "0 0 12px", padding: 0 }}>
                {view.tasks.map((task) => (
                  <li key={task.id} style={{ padding: "6px 0" }}>
                    <b>{task.title}</b>
                    <div className="muted">
                      {task.status} · due {task.due ? formatDate(task.due) : "—"}
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {view.events.length === 0 ? (
              <EmptyState title="No recent activity" />
            ) : (
              <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                {view.events.slice(0, 12).map((event) => (
                  <li key={event.id} style={{ padding: "6px 0", borderBottom: "1px solid var(--line-soft)" }}>
                    <b>{event.title}</b>
                    <div className="muted">
                      {timeAgo(event.occurredAt)}
                      {event.detail ? ` · ${event.detail}` : ""}
                    </div>
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
