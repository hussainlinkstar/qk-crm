"use client";

import Link from "next/link";
import Select from "@/components/ui/Select";
import { useParams, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import Button from "@/components/ui/Button";
import RecordHeader, { type RecordFact } from "@/components/ui/RecordHeader";
import { EmptyState, SkeletonRows, useWorkspaceData } from "@/components/ui/bits";
import { useWorkspace } from "@/components/shell/WorkspaceContext";
import { crm } from "@/lib/crm-store";
import { assignmentRoleTitle, assignmentStatusLabel, deriveAssignmentStatus } from "@/lib/assignments";
import { addDays, formatDate, plural, timeAgo } from "@/lib/format";
import { compactMoney } from "@/lib/home-tessiant";
import { accountRelationshipStrip, opportunityTypeFromInterest, unpurchasedInterests } from "@/lib/record-intelligence";
import { client360 } from "@/lib/sales-crm";
import { salesRelationshipIntel } from "@/lib/sales-relationship";
import { engagementInsights } from "@/lib/commercial-intelligence";
import { verifiedAvailableMatchCount } from "@/lib/tessiant-insights";
import OpportunityQuickPanel from "@/components/sales/OpportunityQuickPanel";
import ContactQuickPanel from "@/components/sales/ContactQuickPanel";
import RelationshipIntelligence from "@/components/sales/RelationshipIntelligence";
import RelationshipMap from "@/components/sales/RelationshipMap";
import BrandMark from "@/components/ui/BrandMark";
import { relationshipMap } from "@/lib/relationship-map";
import { dependencyLabel, founderDependency } from "@/lib/founder-dependency";
import CountUp from "@/components/ui/CountUp";
import Spark from "@/components/ui/Spark";
import RecordInsightChip from "@/components/pulse/RecordInsightChip";
import DealJourney from "@/components/journey/DealJourney";
import { dealJourneys } from "@/lib/deal-journey";
import styles from "./account.module.css";

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "contacts", label: "Contacts" },
  { key: "opportunities", label: "Opportunities" },
  { key: "staffing", label: "Staffing" },
  { key: "activity", label: "Activity" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

const STATUS_CHIP: Record<string, string> = { active: "chip-won", prospect: "chip-new", inactive: "chip-lost" };

export default function Client360Page() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { state } = useWorkspaceData();
  const { toast, openTaskForm, askQiko } = useWorkspace();
  const [tab, setTab] = useState<TabKey>("overview");
  const [secondaryId, setSecondaryId] = useState("m_sarah");
  const [feedback, setFeedback] = useState("");
  const [previewOpp, setPreviewOpp] = useState<string | null>(null);
  const [previewContact, setPreviewContact] = useState<string | null>(null);

  const view = useMemo(() => (state ? client360(state, id) : null), [state, id]);
  const relationship = useMemo(() => (state && view ? salesRelationshipIntel(state, { accountId: id }) : null), [state, view, id]);

  if (!state) {
    return (
      <div className="page">
        <SkeletonRows rows={6} height={72} />
      </div>
    );
  }

  if (!view || !relationship) {
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
  const map = relationshipMap(state, account.id);
  const dependency = founderDependency(state, account.id);
  const expansion = unpurchasedInterests(state, account.id);
  const ending = engagementInsights(state).find((item) => item.accountId === account.id) ?? null;

  const facts: RecordFact[] = [
    { label: "Open pipeline", value: compactMoney(commercial.pipeline), href: `/sales/pipeline?account=${account.id}` },
    { label: "Agreed contracts", value: compactMoney(commercial.agreed), href: `/sales/pipeline?account=${account.id}` },
    { label: "Open opportunities", value: openOpps.length },
    { label: "Live assignments", value: view.liveAssignments.length, href: "/staffing/placements?view=active" },
    { label: "Open requirements", value: view.activeRequirements.length, href: "/staffing/requirements?view=open" },
    {
      label: "Relationship owners",
      value: view.secondary ? `${view.primary?.name ?? "—"} · ${view.secondary.name}` : (view.primary?.name ?? "Unassigned"),
      tone: view.founderDependency ? "danger" : "default",
    },
  ];

  const addSecondaryOwner = () => {
    crm.updateAccountOwners(account.id, account.primaryOwnerId, secondaryId);
    toast("Secondary relationship owner added", "success");
  };

  const createFollowUp = () => {
    openTaskForm({
      title: "Re-engage client",
      initial: {
        title: `Re-engage · ${account.name}`,
        description: ending
          ? `[account:${account.id}] ${ending.detail}${ending.contactName ? ` Contact: ${ending.contactName}.` : ""}`
          : `Account ${account.id}`,
        leadId: account.linkedLeadId,
        accountId: account.id,
        priority: "medium",
        due: addDays(5),
        ownerId: account.primaryOwnerId ?? "me",
      },
    });
  };

  const originate = (interest: string) => {
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
  };

  const uncovered = view.activeRequirements.filter((req) => verifiedAvailableMatchCount(state, req.id) === 0);
  const planTouch = (title: string, description: string) =>
    openTaskForm({
      title: "Plan the next touch",
      initial: {
        title,
        description: `[account:${account.id}] ${description}`,
        leadId: account.linkedLeadId,
        accountId: account.id,
        priority: "medium",
        due: addDays(3),
        ownerId: account.primaryOwnerId ?? "me",
      },
    });
  return (
    <div className="page">
      <RecordHeader
        back={{ href: "/sales/accounts", label: "Accounts" }}
        mark={<BrandMark name={account.name} size={48} radius={14} />}
        title={account.name}
        chips={
          <>
            <span className={`chip chip-dot ${STATUS_CHIP[account.status] ?? ""}`}>{account.status}</span>
            <span className="chip">{account.sector}</span>
          </>
        }
        meta={
          <>
            {account.industry}
            {account.website ? <> · {account.website}</> : null}
            {" · "}Billing {account.billingCurrency ?? "GBP"}
          </>
        }
        facts={facts}
        actions={
          <>
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
                    accountId: account.id,
                    priority: "medium",
                    due: null,
                    ownerId: account.primaryOwnerId ?? "me",
                  },
                })
              }
            >
              Add activity
            </Button>
          </>
        }
      />

      <RecordInsightChip accountId={account.id} />

      <section className={styles.intel} aria-labelledby="intel-title">
          <div className={styles.intelHead}>
            <div>
              <p className="kicker kicker-qiko">Qiko on this account</p>
              <h2 id="intel-title">What would move this relationship</h2>
            </div>
            <div className={styles.intelStrength}>
              <span className="chip chip-ai">Relationship · {relationship.strength}</span>
              <span>{relationship.strengthWhy}</span>
            </div>
          </div>
          <div className={styles.signals}>
            {dependency ? (
              <article className={`${styles.signal} ${styles.dependencySignal}`} data-band={dependency.band}>
                <span className={styles.signalKind}>Founder dependency</span>
                <div className={styles.dependencyScore}>
                  <b className="tabular">
                    <CountUp value={dependency.score} />
                    <small>/100</small>
                  </b>
                  <Spark values={dependency.trend} kind="line" tone={dependency.band === "high" ? "muted" : "brand"} width={72} height={26} label="Dependency over the last six months" />
                  <span className={styles.dependencyDelta} data-dir={dependency.delta > 0 ? "up" : dependency.delta < 0 ? "down" : "flat"}>
                    {dependency.delta > 0 ? `+${dependency.delta}` : dependency.delta === 0 ? "steady" : dependency.delta} vs 3 months ago
                  </span>
                </div>
                <b>{dependency.band === "high" && dependency.keyPerson ? `Rests on ${dependency.keyPerson}` : `${dependencyLabel(dependency.band)}${dependency.keyPerson ? ` · mostly ${dependency.keyPerson}` : ""}`}</b>
                <ul className={styles.drivers}>
                  {dependency.drivers.map((driver) => (
                    <li key={driver.label} data-kind={driver.kind}>
                      <span className="tabular">+{driver.points}</span> {driver.label}
                      <small>{driver.kind}</small>
                    </li>
                  ))}
                </ul>
                <div className={styles.signalActions}>
                  {!view.founderDependency ? (
                    <Link href="/sales/contacts" className="text-link">
                      Add a stakeholder
                    </Link>
                  ) : null}
                  {view.founderDependency ? (
                    <>
                      <Select className="input" style={{ maxWidth: 180 }} value={secondaryId} onChange={(event) => setSecondaryId(event.target.value)} aria-label="Secondary owner">
                        {state.members
                          .filter((member) => member.id !== account.primaryOwnerId)
                          .map((member) => (
                            <option key={member.id} value={member.id}>
                              {member.name}
                            </option>
                          ))}
                      </Select>
                      <Button size="small" variant="qiko" onClick={addSecondaryOwner}>
                        Add second owner
                      </Button>
                    </>
                  ) : null}
                </div>
              </article>
            ) : null}

            {ending ? (
              <article className={styles.signal}>
                <span className={styles.signalKind}>Re-engage</span>
                <b>{ending.title}</b>
                <p>{ending.detail}</p>
                <div className={styles.signalActions}>
                  <Button size="small" variant="qiko" icon="tasks" onClick={createFollowUp}>
                    Create follow-up
                  </Button>
                  <Link href={`/staffing/placements/${ending.assignmentId}`} className="text-link">
                    Open assignment
                  </Link>
                </div>
              </article>
            ) : null}

            <article className={styles.signal}>
              <span className={styles.signalKind}>Last meaningful touch</span>
              <b>{relationship.lastInteraction ? relationship.lastInteraction.title : "No meaningful interaction recorded"}</b>
              <p>
                {relationship.lastInteraction
                  ? `${timeAgo(relationship.lastInteraction.at)} · ${relationship.lastInteraction.source}. `
                  : "Nothing on file beyond the account record. "}
                {relationship.nextAction}
              </p>
              <div className={styles.signalActions}>
                <Button size="small" variant="qiko" icon="sparkles" onClick={() => askQiko(`Tell me everything about ${account.name}`)}>
                  Ask Qiko
                </Button>
                <Button size="small" variant="secondary" onClick={() => planTouch(`${relationship.nextAction} · ${account.name}`, relationship.nextAction)}>
                  Plan next touch
                </Button>
              </div>
            </article>

            {relationship.missing.length > 0 ? (
              <article className={styles.signal}>
                <span className={styles.signalKind}>Coverage</span>
                <b>Missing: {relationship.missing.join(", ")}</b>
                <p>{relationship.coverageLabel}. Fill the gaps before the next proposal so the file carries the relationship, not one person.</p>
                <div className={styles.signalActions}>
                  <Button size="small" variant="secondary" icon="tasks" onClick={() => planTouch(`Close coverage gaps · ${account.name}`, `Missing: ${relationship.missing.join(", ")}.`)}>
                    Add to plan
                  </Button>
                </div>
              </article>
            ) : null}

            {relationship.network.length > 0 ? (
              <article className={styles.signal}>
                <span className={styles.signalKind}>Network</span>
                <b>{plural(relationship.network.length, "person", "people")} in Tessiant&apos;s network know this account</b>
                <p>
                  {relationship.network
                    .slice(0, 3)
                    .map((link) => `${link.name} (${link.detail})`)
                    .join(" · ")}
                  . Recorded assignments only, no inferred connections.
                </p>
                <div className={styles.signalActions}>
                  <Button
                    size="small"
                    variant="qiko"
                    icon="users"
                    onClick={() =>
                      planTouch(
                        `Ask ${relationship.network[0].name} for an introduction · ${account.name}`,
                        `${relationship.network[0].name} is recorded on this account (${relationship.network[0].detail}).`,
                      )
                    }
                  >
                    Ask for an introduction
                  </Button>
                  <Link href={relationship.network[0].href} className="text-link">
                    Open profile
                  </Link>
                </div>
              </article>
            ) : null}

            {uncovered.length > 0 ? (
              <article className={styles.signal}>
                <span className={styles.signalKind}>Delivery risk</span>
                <b>
                  {uncovered.length === 1 ? `${uncovered[0].title} has no verified available match` : `${uncovered.length} open requirements have no verified available match`}
                </b>
                <p>Winning the work without cover to deliver it is the risk Pulse flags first. Review sourcing before the client asks.</p>
                <div className={styles.signalActions}>
                  <Link href={`/staffing/requirements/${uncovered[0].id}`} className="text-link">
                    Review sourcing
                  </Link>
                </div>
              </article>
            ) : null}

            {expansion.length > 0 ? (
              <article className={styles.signal}>
                <span className={styles.signalKind}>Expansion</span>
                <b>{plural(expansion.length, "recorded interest")} not yet purchased</b>
                <p>Originate a pipeline opportunity from an interest this client has already expressed. Pipeline only, never revenue.</p>
                <div className={styles.signalActions}>
                  {expansion.map((interest) => (
                    <Button key={interest} size="small" variant="secondary" icon="plus" onClick={() => originate(interest)}>
                      {interest}
                    </Button>
                  ))}
                </div>
              </article>
            ) : null}
          </div>
        </section>

      {map && map.nodes.length > 1 ? (
        <section className={`card ${styles.mapCard}`} aria-labelledby="map-title" data-tour="map">
          <div className={styles.mapHead}>
            <div>
              <p className="kicker kicker-qiko">Relationship map</p>
              <h2 id="map-title">Who we know here, and how the door opened</h2>
            </div>
            <span className={styles.mapCount}>
              {people.length} {people.length === 1 ? "person" : "people"} on record
            </span>
          </div>
          <RelationshipMap data={map} />
        </section>
      ) : null}

      <nav className="pill-tabs" aria-label="Client 360 sections">
        {TABS.map((item) => (
          <button key={item.key} type="button" className="pill-tab" aria-pressed={tab === item.key} onClick={() => setTab(item.key)}>
            {item.label}
            {item.key === "contacts" && view.contacts.length > 0 && ` · ${view.contacts.length}`}
            {item.key === "opportunities" && openOpps.length > 0 && ` · ${openOpps.length}`}
            {item.key === "staffing" && view.liveAssignments.length > 0 && ` · ${view.liveAssignments.length}`}
          </button>
        ))}
      </nav>

      {tab === "overview" && (
        <div className={`tab-panel ${styles.twoCol}`}>
          <div className={styles.stack}>
            <section className={`card ${styles.overview}`}>
              <div className="card-head">
                <h2>Company overview</h2>
              </div>
              <div className="card-body">
                <p>{account.notes || "No overview notes yet."}</p>
                <dl>
                  <div>
                    <dt>Services of interest</dt>
                    <dd>{(account.offeringInterests ?? []).join(", ") || "—"}</dd>
                  </div>
                  <div>
                    <dt>Services purchased</dt>
                    <dd>{(account.servicesPurchased ?? []).join(", ") || "None recorded"}</dd>
                  </div>
                  <div>
                    <dt>Primary owner</dt>
                    <dd>{view.primary?.name ?? "Unassigned"}</dd>
                  </div>
                  <div>
                    <dt>Secondary owner</dt>
                    <dd>{view.secondary?.name ?? "None"}</dd>
                  </div>
                </dl>
              </div>
            </section>

            {(() => {
              const journeys = dealJourneys(state).filter((item) => item.accountId === account.id);
              if (journeys.length === 0) return null;
              return (
                <section className="card">
                  <div className="card-head">
                    <div>
                      <h2>From deal to delivery</h2>
                      <p className="card-sub">Every chain on this account from opportunity to placement.</p>
                    </div>
                  </div>
                  <div className={`card-body ${styles.stack}`}>
                    {journeys.slice(0, 4).map((journey) => (
                      <DealJourney key={journey.key} journey={journey} compact />
                    ))}
                  </div>
                </section>
              );
            })()}

            <section className="card">
              <div className="card-body">
                <RelationshipIntelligence intel={relationship} variant="page" />
              </div>
            </section>
          </div>

          <div className={styles.stack}>
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
                  <ul className={styles.list}>
                    {openOpps.slice(0, 4).map((opportunity) => (
                      <li key={opportunity.id} className={styles.listItem}>
                        <button type="button" className="text-link" onClick={() => setPreviewOpp(opportunity.id)}>
                          <b>{opportunity.name}</b>
                        </button>
                        <small>
                          {opportunity.stage} · £{opportunity.amount.toLocaleString("en-GB")} · close {formatDate(opportunity.expectedCloseDate)}
                        </small>
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
                  <ul className={styles.list}>
                    {view.tasks.slice(0, 5).map((task) => (
                      <li key={task.id} className={styles.listItem}>
                        <b>{task.title}</b>
                        <small>
                          {task.status.replace("_", " ")} · due {task.due ? formatDate(task.due) : "—"}
                        </small>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </article>
          </div>
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
              <ul className={styles.list}>
                {view.contacts.map((contact) => (
                  <li key={contact.id} className={styles.listItem}>
                    <button type="button" className="text-link" onClick={() => setPreviewContact(contact.id)}>
                      <b>
                        {contact.name}
                        {contact.isPrimary ? " · Primary" : ""}
                      </b>
                    </button>
                    <small>
                      {contact.role ?? "—"} · {contact.email}
                      {contact.phone ? ` · ${contact.phone}` : ""}
                    </small>
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
              <ul className={styles.list}>
                {view.opportunities.map((opportunity) => (
                  <li key={opportunity.id} className={styles.listItem}>
                    <button type="button" className="text-link" onClick={() => setPreviewOpp(opportunity.id)}>
                      <b>{opportunity.name}</b>
                    </button>
                    <small>
                      {opportunity.stage} · {opportunity.type} · £{opportunity.amount.toLocaleString("en-GB")}
                      {opportunity.stage === "Closed Won" && opportunity.agreedContractValue != null
                        ? ` · agreed £${opportunity.agreedContractValue.toLocaleString("en-GB")}`
                        : ""}
                    </small>
                    {opportunity.stage === "Closed Won" && (
                      <div className={styles.listActions}>
                        <Button
                          size="small"
                          variant="secondary"
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
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}

      {tab === "staffing" && (
        <section className={`tab-panel ${styles.twoCol}`}>
          <article className="card">
            <div className="card-head">
              <h2>Active requirements</h2>
            </div>
            <div className="card-body">
              {view.activeRequirements.length === 0 ? (
                <EmptyState title="No open requirements" />
              ) : (
                <ul className={styles.list}>
                  {view.activeRequirements.map((req) => (
                    <li key={req.id} className={styles.listItem}>
                      <Link href={`/staffing/requirements/${req.id}`} className="text-link">
                        <b>{req.title}</b>
                      </Link>
                      <small>
                        {req.stage} · {req.category}
                      </small>
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
                <ul className={styles.list}>
                  {view.liveAssignments.map((assignment) => {
                    const associate = state.tessiant?.associates.find((item) => item.id === assignment.associateId);
                    return (
                      <li key={assignment.id} className={styles.listItem}>
                        <Link href={`/staffing/placements/${assignment.id}`} className="text-link">
                          <b>
                            {associate?.name ?? "Associate"} · {assignmentRoleTitle(state, assignment)}
                          </b>
                        </Link>
                        <small>
                          {assignmentStatusLabel(deriveAssignmentStatus(assignment))} · started{" "}
                          {assignment.terms.startDate ? formatDate(assignment.terms.startDate) : "—"} · ends{" "}
                          {assignment.terms.endDate ? formatDate(assignment.terms.endDate) : "open"}
                        </small>
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
                <ul className={styles.list}>
                  {view.pastAssignments.map((assignment) => {
                    const associate = state.tessiant?.associates.find((item) => item.id === assignment.associateId);
                    return (
                      <li key={assignment.id} className={styles.listItem}>
                        <Link href={`/staffing/placements/${assignment.id}`} className="text-link">
                          <b>{associate?.name ?? "Associate"}</b>
                        </Link>
                        <small>
                          {assignmentRoleTitle(state, assignment)} · {assignmentStatusLabel(deriveAssignmentStatus(assignment))}
                        </small>
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
              <div className={styles.listActions}>
                <Button
                  size="small"
                  icon="check"
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
            </div>
          </article>
        </section>
      )}

      {tab === "activity" && (
        <section className={`tab-panel ${styles.twoCol}`}>
          <article className="card">
            <div className="card-head">
              <h2>Open tasks</h2>
            </div>
            <div className="card-body">
              {view.tasks.length === 0 ? (
                <EmptyState title="No open tasks" />
              ) : (
                <ul className={styles.list}>
                  {view.tasks.map((task) => (
                    <li key={task.id} className={styles.listItem}>
                      <b>{task.title}</b>
                      <small>
                        {task.status.replace("_", " ")} · due {task.due ? formatDate(task.due) : "—"}
                      </small>
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
                <ul className={styles.list}>
                  {view.events.slice(0, 16).map((event) => (
                    <li key={event.id} className={styles.listItem}>
                      <b>{event.title}</b>
                      <small>
                        {timeAgo(event.occurredAt)}
                        {event.detail ? ` · ${event.detail}` : ""}
                      </small>
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
