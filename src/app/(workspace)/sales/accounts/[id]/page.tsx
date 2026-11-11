"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import Button from "@/components/ui/Button";
import { EmptyState, SkeletonRows, useWorkspaceData } from "@/components/ui/bits";
import { useWorkspace } from "@/components/shell/WorkspaceContext";
import { crm } from "@/lib/crm-store";
import { assignmentRoleTitle, assignmentStatusLabel, deriveAssignmentStatus } from "@/lib/assignments";
import { addDays, formatDate, timeAgo } from "@/lib/format";
import {
  accountRelationshipStrip,
  opportunityTypeFromInterest,
  unpurchasedInterests,
} from "@/lib/record-intelligence";
import { client360 } from "@/lib/sales-crm";
import OpportunityQuickPanel from "@/components/sales/OpportunityQuickPanel";
import ContactQuickPanel from "@/components/sales/ContactQuickPanel";
import RecordInsightChip from "@/components/pulse/RecordInsightChip";
import salesStyles from "@/app/(workspace)/sales/sales.module.css";

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "contacts", label: "Contacts" },
  { key: "opportunities", label: "Opportunities" },
  { key: "staffing", label: "Staffing" },
  { key: "activity", label: "Activity" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export default function Client360Page() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { state } = useWorkspaceData();
  const { toast, openTaskForm } = useWorkspace();
  const [tab, setTab] = useState<TabKey>("overview");
  const [secondaryId, setSecondaryId] = useState("m_sarah");
  const [feedback, setFeedback] = useState("");
  const [previewOpp, setPreviewOpp] = useState<string | null>(null);
  const [previewContact, setPreviewContact] = useState<string | null>(null);

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
  const openOpps = view.openPipeline;
  const people = accountRelationshipStrip(state, account.id);
  const expansion = unpurchasedInterests(state, account.id);

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <p className="kicker">
            <Link href="/sales/accounts">Accounts</Link>
          </p>
          <h1>{account.name}</h1>
          <p className="subtitle">
            {account.sector} · {account.status} · Owner {view.primary?.name ?? "Unassigned"}
          </p>
        </div>
        <div className="page-actions">
          <Link href={`/sales/pipeline?account=${account.id}`}>
            <Button variant="secondary">Pipeline</Button>
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

      <RecordInsightChip accountId={account.id} />

      {view.founderDependency && (
        <div className="notice-banner" role="status">
          <div>
            <b>Relationship concentration</b>
            <div>Only a primary owner is set. Add a secondary owner to reduce single-person dependency.</div>
          </div>
        </div>
      )}

      {people.length > 0 && (
        <div className={salesStyles.peopleStrip} aria-label="People Tessiant already has on this account">
          {people.map((person) => (
            <Link key={person.id} href={person.href} className={salesStyles.peopleChip}>
              {person.label}
              <small>{person.role}</small>
            </Link>
          ))}
        </div>
      )}

      {expansion.length > 0 && (
        <div className="notice-banner" role="status">
          <div>
            <b>Interest not purchased</b>
            <div>Create a pipeline opportunity from a recorded offering interest. This is not realised revenue.</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
              {expansion.map((interest) => (
                <Button
                  key={interest}
                  size="small"
                  variant="secondary"
                  onClick={() => {
                    crm.createOpportunity({
                      name: `${account.name} · ${interest}`,
                      accountId: account.id,
                      contactId: view.contacts[0]?.id ?? null,
                      leadId: account.linkedLeadId ?? null,
                      type: opportunityTypeFromInterest(interest),
                      stage: "Qualification",
                      amount: 0,
                      currency: "GBP",
                      expectedCloseDate: addDays(30),
                      ownerId: account.primaryOwnerId,
                      services: [interest],
                      nextStep: "Qualify expansion (pipeline only)",
                      source: "Existing client",
                      agreedContractValue: null,
                      expectedBilling: null,
                      recognisedRevenue: null,
                      lostReason: null,
                    });
                    toast("Pipeline opportunity created — not realised revenue", "success");
                  }}
                >
                  Originate {interest}
                </Button>
              ))}
            </div>
          </div>
        </div>
      )}

      <nav className="pill-tabs" aria-label="Client 360 sections">
        {TABS.map((item) => (
          <button
            key={item.key}
            type="button"
            className="pill-tab"
            aria-pressed={tab === item.key}
            onClick={() => setTab(item.key)}
          >
            {item.label}
            {item.key === "contacts" && view.contacts.length > 0 && ` · ${view.contacts.length}`}
            {item.key === "opportunities" && openOpps.length > 0 && ` · ${openOpps.length}`}
            {item.key === "staffing" && view.liveAssignments.length > 0 && ` · ${view.liveAssignments.length}`}
          </button>
        ))}
      </nav>

      {tab === "overview" && (
        <div className="tab-panel">
          <section className="card" style={{ marginBottom: 14 }}>
            <div className="card-head">
              <h2>Company overview</h2>
            </div>
            <div className="card-body">
              <p>{account.notes || "No overview notes yet."}</p>
              <p className="muted" style={{ marginTop: 8 }}>
                Website {account.website ?? "—"} · Billing {account.billingCurrency ?? "GBP"} · Industry {account.industry}
              </p>
              <p className="muted">Services of interest: {(account.offeringInterests ?? []).join(", ") || "—"}</p>
              <p className="muted">Services purchased: {(account.servicesPurchased ?? []).join(", ") || "None recorded"}</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
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
                <div className="muted">Open pipeline</div>
              </div>
            </div>
            <div className="card">
              <div className="card-body">
                <b className="tabular">{openOpps.length}</b>
                <div className="muted">Open opportunities</div>
              </div>
            </div>
            <div className="card">
              <div className="card-body">
                <b className="tabular">{view.liveAssignments.length}</b>
                <div className="muted">Live assignments</div>
              </div>
            </div>
            <div className="card">
              <div className="card-body">
                <b>{view.tasks[0]?.title ?? "No open action"}</b>
                <div className="muted">Next action</div>
              </div>
            </div>
          </section>

          <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <article className="card">
              <div className="card-head">
                <h2>Priority opportunities</h2>
                <button type="button" className="text-link" onClick={() => setTab("opportunities")}>
                  View all
                </button>
              </div>
              <div className="card-body">
                {openOpps.length === 0 ? (
                  <EmptyState title="No open opportunities" />
                ) : (
                  <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                    {openOpps.slice(0, 4).map((opportunity) => (
                      <li key={opportunity.id} style={{ padding: "8px 0", borderBottom: "1px solid var(--line-soft)" }}>
                        <button type="button" className="text-link" onClick={() => setPreviewOpp(opportunity.id)}>
                          <b>{opportunity.name}</b>
                        </button>
                        <div className="muted">
                          {opportunity.stage} · £{opportunity.amount.toLocaleString("en-GB")} · close {formatDate(opportunity.expectedCloseDate)}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </article>

            <article className="card">
              <div className="card-head">
                <h2>Upcoming actions</h2>
                <button type="button" className="text-link" onClick={() => setTab("activity")}>
                  Activity
                </button>
              </div>
              <div className="card-body">
                {view.tasks.length === 0 ? (
                  <EmptyState title="No open tasks" />
                ) : (
                  <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                    {view.tasks.slice(0, 5).map((task) => (
                      <li key={task.id} style={{ padding: "8px 0", borderBottom: "1px solid var(--line-soft)" }}>
                        <b>{task.title}</b>
                        <div className="muted">
                          {task.status} · due {task.due ? formatDate(task.due) : "—"}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </article>
          </section>
        </div>
      )}

      {tab === "contacts" && (
        <section className="card tab-panel">
          <div className="card-head">
            <h2>Contacts</h2>
          </div>
          <div className="card-body">
            {view.contacts.length === 0 ? (
              <EmptyState title="No contacts" icon="users" />
            ) : (
              <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                {view.contacts.map((contact) => (
                  <li key={contact.id} style={{ padding: "10px 0", borderBottom: "1px solid var(--line-soft)" }}>
                    <button type="button" className="text-link" onClick={() => setPreviewContact(contact.id)}>
                      <b>
                        {contact.name}
                        {contact.isPrimary ? " · Primary" : ""}
                      </b>
                    </button>
                    <div className="muted">
                      {contact.role ?? "—"} · {contact.email}
                      {contact.phone ? ` · ${contact.phone}` : ""}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}

      {tab === "opportunities" && (
        <section className="card tab-panel">
          <div className="card-head">
            <h2>Opportunities</h2>
            <Link href={`/sales/pipeline?account=${account.id}`} className="text-link">
              Board view
            </Link>
          </div>
          <div className="card-body">
            {view.opportunities.length === 0 ? (
              <EmptyState title="No opportunities" />
            ) : (
              <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                {view.opportunities.map((opportunity) => (
                  <li key={opportunity.id} style={{ padding: "10px 0", borderBottom: "1px solid var(--line-soft)" }}>
                    <button type="button" className="text-link" onClick={() => setPreviewOpp(opportunity.id)}>
                      <b>{opportunity.name}</b>
                    </button>
                    <div className="muted">
                      {opportunity.stage} · {opportunity.type} · £{opportunity.amount.toLocaleString("en-GB")}
                      {opportunity.stage === "Closed Won" && opportunity.agreedContractValue != null
                        ? ` · agreed £${opportunity.agreedContractValue.toLocaleString("en-GB")}`
                        : ""}
                    </div>
                    {opportunity.stage === "Closed Won" && (
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
                        Create staffing requirement
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}

      {tab === "staffing" && (
        <section className="tab-panel" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <article className="card">
            <div className="card-head">
              <h2>Active requirements</h2>
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
                        {req.stage} · {req.category}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </article>

          <article className="card">
            <div className="card-head">
              <h2>Live assignments</h2>
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
              <h2>Past assignments</h2>
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
                  placeholder="Delivery quality, relationship health, next steps…"
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
        </section>
      )}

      {tab === "activity" && (
        <section className="tab-panel" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <article className="card">
            <div className="card-head">
              <h2>Open tasks</h2>
            </div>
            <div className="card-body">
              {view.tasks.length === 0 ? (
                <EmptyState title="No open tasks" />
              ) : (
                <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                  {view.tasks.map((task) => (
                    <li key={task.id} style={{ padding: "8px 0", borderBottom: "1px solid var(--line-soft)" }}>
                      <b>{task.title}</b>
                      <div className="muted">
                        {task.status} · due {task.due ? formatDate(task.due) : "—"}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </article>

          <article className="card">
            <div className="card-head">
              <h2>Recent activity</h2>
            </div>
            <div className="card-body">
              {view.events.length === 0 ? (
                <EmptyState title="No recent activity" />
              ) : (
                <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                  {view.events.slice(0, 16).map((event) => (
                    <li key={event.id} style={{ padding: "8px 0", borderBottom: "1px solid var(--line-soft)" }}>
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
      )}

      {previewOpp && <OpportunityQuickPanel opportunityId={previewOpp} onClose={() => setPreviewOpp(null)} />}
      {previewContact && <ContactQuickPanel contactId={previewContact} onClose={() => setPreviewContact(null)} />}
    </div>
  );
}
