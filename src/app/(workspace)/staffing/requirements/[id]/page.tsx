"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import MatchCandidateCard from "@/components/staffing/MatchCandidateCard";
import RecommendedMatches from "@/components/staffing/RecommendedMatches";
import RecordInsightChip from "@/components/pulse/RecordInsightChip";
import Button from "@/components/ui/Button";
import { EmptyState, SkeletonRows, useWorkspaceData } from "@/components/ui/bits";
import { useWorkspace } from "@/components/shell/WorkspaceContext";
import { crm } from "@/lib/crm-store";
import { addDays, formatDate, timeAgo } from "@/lib/format";
import { formatRate, marginForCandidate, mapRequirementToOpsStage, requirementTasks, verifiedAvailableMatchCount } from "@/lib/tessiant-insights";
import { buildMatchPresentation } from "@/lib/tessiant-matching";
import {
  actionsForCandidate,
  candidateStatusLabel,
  daysOpen,
  groupCandidatesByStatus,
  normalizeCandidateStatus,
  requirementActivityTimeline,
  requisitionCounts,
  type CandidateAction,
} from "@/lib/requisition";
import { REQUIREMENT_STAGES, type RequirementStage } from "@/lib/tessiant-types";
import styles from "../../staffing.module.css";

const SECTIONS = [
  { id: "overview", label: "Overview" },
  { id: "candidates", label: "Candidates" },
  { id: "interviews", label: "Interviews" },
  { id: "commercials", label: "Commercials" },
  { id: "activity", label: "Activity" },
] as const;

type SectionId = (typeof SECTIONS)[number]["id"];

export default function RequirementDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { state } = useWorkspaceData();
  const { toast, openTaskForm } = useWorkspace();
  const tessiant = state?.tessiant;
  const requirement = tessiant?.requirements.find((item) => item.id === id);
  const [tab, setTab] = useState<SectionId>("overview");
  const [quoteAmount, setQuoteAmount] = useState<Record<string, number>>({});
  const [overrideReason, setOverrideReason] = useState("");
  const [outcomeReason, setOutcomeReason] = useState("");
  const [externalAssociateId, setExternalAssociateId] = useState("");
  const [actionNotes, setActionNotes] = useState<Record<string, string>>({});
  const [expandedCandidate, setExpandedCandidate] = useState<string | null>(null);
  const [externalForm, setExternalForm] = useState({
    name: "",
    headline: "",
    skills: "",
    sectors: "",
    rateAmount: "",
    location: "",
    notes: "",
  });

  const candidates = useMemo(() => {
    if (!tessiant || !requirement) return [];
    return tessiant.candidates
      .filter((c) => c.requirementId === requirement.id)
      .sort((a, b) => {
        const ao = a.rankOverride ?? 999;
        const bo = b.rankOverride ?? 999;
        if (ao !== bo) return ao - bo;
        return b.matchScore - a.matchScore;
      });
  }, [tessiant, requirement]);

  const placements = useMemo(
    () => (tessiant?.placements ?? []).filter((p) => p.requirementId === id),
    [tessiant, id],
  );
  const activePlacement = placements.find((p) => p.status !== "closed");
  const tasks = state && requirement ? requirementTasks(state, requirement.id) : [];
  const timeline = state && requirement ? requirementActivityTimeline(state, requirement.id) : [];
  const account = tessiant?.accounts.find((item) => item.id === requirement?.accountId);
  const opportunity = state?.opportunities?.find((item) => item.id === requirement?.linkedOpportunityId);
  const owner = state?.members.find((member) => member.id === requirement?.ownerId);
  const counts = state && requirement ? requisitionCounts(state, requirement.id) : null;
  const pipelineGroups = useMemo(() => groupCandidatesByStatus(candidates), [candidates]);

  const presentationFor = (candidate: (typeof candidates)[number]) => {
    const associate = tessiant!.associates.find((item) => item.id === candidate.associateId);
    if (!associate || !requirement) {
      return buildMatchPresentation(
        {
          id: candidate.associateId,
          name: "Unknown",
          roleType: "consultant",
          headline: "",
          seniority: "senior",
          skills: [],
          sectors: [],
          location: "",
          workingMode: "hybrid",
          availability: "unknown",
          nextAvailableDate: null,
          rate: null,
          source: "external",
          cvRef: "",
          verifiedAt: null,
          ownerId: null,
          notes: "",
          tags: [],
          status: "unverified",
          languages: [],
          offerings: [],
          priorPlacementCount: 0,
        },
        requirement!,
      );
    }
    return buildMatchPresentation(associate, requirement, {
      placements: tessiant!.placements,
      requirements: tessiant!.requirements,
      availabilityConfirmed: candidate.validation.availabilityConfirmed,
    });
  };

  if (!state || !tessiant) {
    return (
      <div className={`page ${styles.density}`}>
        <SkeletonRows rows={6} height={72} />
      </div>
    );
  }

  if (!requirement) {
    return (
      <div className={`page ${styles.density}`}>
        <EmptyState title="Requirement not found" icon="flag">
          <Link href="/staffing/requirements">Back to requirements</Link>
        </EmptyState>
      </div>
    );
  }

  const stageIndex = REQUIREMENT_STAGES.indexOf(requirement.stage);
  const matchingCandidates = candidates.filter((c) =>
    ["suggested", "contacted", "availability_confirmed", "shortlisted"].includes(normalizeCandidateStatus(c.shortlistStatus)),
  );
  const interviewCandidates = candidates.filter((c) => {
    const status = normalizeCandidateStatus(c.shortlistStatus);
    return status === "interview" || Boolean(c.interview.heldAt);
  });
  const commercialCandidates = candidates.filter((c) => {
    const status = normalizeCandidateStatus(c.shortlistStatus);
    return status === "offer" || status === "placed" || Boolean(c.quotedClientRate);
  });

  const runMatches = () => {
    const added = crm.findMatches(requirement.id);
    toast(added > 0 ? `Find Matches added ${added} suggestions` : "Matches refreshed (scores updated)", "success");
  };

  const moveStage = (stage: RequirementStage) => {
    if (stage === "Placed") {
      toast("Confirm a placement with agreed terms to reach Placed", "info");
      return;
    }
    crm.setRequirementStage(requirement.id, stage, `Moved to ${stage}`);
    toast(`Stage → ${stage}`, "success");
  };

  const confirmPlacement = (candidateId: string) => {
    const candidate = candidates.find((item) => item.id === candidateId);
    if (!candidate) return;
    const status = normalizeCandidateStatus(candidate.shortlistStatus);
    if (status !== "offer" && !candidate.quotedClientRate) {
      toast("Set a client rate and move to offer before placement", "error");
      return;
    }
    const clientRate =
      candidate.quotedClientRate ??
      ({
        amount: quoteAmount[candidate.id] ?? Math.round((candidate.validation.indicativeCost?.amount ?? 900) * 1.25),
        currency: "GBP" as const,
        unit: "day" as const,
      });
    if (!candidate.quotedClientRate) {
      crm.sendQuote(candidate.id, clientRate);
    }
    // Always record commercial agreement so Pulse gets offer.agreed / quote.agreed on the happy path.
    crm.agreeQuote(candidate.id);
    const startDate = requirement.startDate;
    const endDate = addDays(requirement.durationWeeks * 7, new Date(`${startDate}T12:00:00`));
    const result = crm.confirmPlacement({
      requirementId: requirement.id,
      candidateId,
      terms: {
        associateCost: candidate.validation.indicativeCost,
        clientRate,
        startDate,
        endDate,
        notes: "Placement confirmed — assignment created for delivery tracking",
      },
    });
    if (!result.ok) {
      toast(result.error, "error");
      return;
    }
    toast("Placement confirmed — assignment is live on Staffing Overview", "success");
    router.push(`/staffing/placements/${result.placementId}`);
  };

  const runAction = (candidateId: string, action: CandidateAction) => {
    const candidate = candidates.find((item) => item.id === candidateId);
    if (!candidate) return;
    const associate = tessiant.associates.find((item) => item.id === candidate.associateId);
    const note = (actionNotes[candidateId] ?? "").trim();

    switch (action.type) {
      case "shortlist":
        crm.setCandidateStatus(candidateId, action.next);
        toast("Shortlisted — timeline updated", "success");
        break;
      case "remove_shortlist":
        crm.setCandidateStatus(candidateId, action.next, { overrideReason: note || "Removed from shortlist" });
        toast("Removed from shortlist", "info");
        break;
      case "contact":
        crm.logCandidateContact(candidateId, note || "Contact logged", Boolean(action.next));
        toast("Contact logged on timeline", "success");
        break;
      case "request_availability":
        crm.logCandidateContact(candidateId, note || "Availability requested", true);
        toast("Availability request logged", "success");
        break;
      case "confirm_availability":
        crm.completeCandidateValidation(candidateId, {
          availabilityConfirmed: true,
          costConfirmed: Boolean(associate?.rate),
          indicativeCost: associate?.rate ?? candidate.validation.indicativeCost,
          notes: note || "Availability and cost verified",
        });
        if (requirement.stage === "Sourcing") crm.setRequirementStage(requirement.id, "Validation", "Availability confirmed");
        toast("Availability confirmed — timeline updated", "success");
        break;
      case "submit_client":
        crm.setCandidateStatus(candidateId, action.next);
        if (["Sourcing", "Validation"].includes(requirement.stage)) {
          crm.setRequirementStage(requirement.id, "Interview", "Submitted to client");
        }
        toast("Submitted to client — timeline updated", "success");
        break;
      case "interview":
        if (normalizeCandidateStatus(candidate.shortlistStatus) === "interview" && note) {
          crm.completeInterview(candidateId, {
            outcome: "positive",
            summary: note,
          });
          toast("Interview feedback logged", "success");
        } else {
          crm.completeInterview(candidateId, {
            outcome: "pending",
            summary: note || "Interview recorded",
          });
          if (["Sourcing", "Validation", "Interview"].includes(requirement.stage) === false) {
            /* keep */
          }
          if (["Sourcing", "Validation"].includes(requirement.stage)) {
            crm.setRequirementStage(requirement.id, "Interview", "Interview recorded");
          }
          toast("Interview recorded — timeline updated", "success");
        }
        break;
      case "offer": {
        const amount =
          quoteAmount[candidateId] ??
          candidate.quotedClientRate?.amount ??
          Math.round((associate?.rate?.amount ?? 900) * 1.25);
        if (!candidate.interview.heldAt) {
          crm.completeInterview(candidateId, {
            outcome: "positive",
            summary: note || candidate.interview.summary || "Interview feedback before offer",
          });
        }
        crm.sendQuote(candidateId, { amount, currency: "GBP", unit: "day" });
        if (requirement.stage !== "Commercials" && requirement.stage !== "Placed") {
          crm.setRequirementStage(requirement.id, "Commercials", "Offer / commercial negotiation");
        }
        toast("Moved to offer / commercials — timeline updated", "success");
        break;
      }
      case "place":
        confirmPlacement(candidateId);
        break;
      case "reject":
        if (!note) {
          toast("Add a rejection reason before rejecting", "error");
          return;
        }
        crm.rejectCandidate(candidateId, note);
        toast("Rejection recorded on timeline", "info");
        break;
      default:
        break;
    }
    setActionNotes((prev) => ({ ...prev, [candidateId]: "" }));
  };

  const renderCard = (candidate: (typeof candidates)[number], forceCompact = true) => {
    const associate = tessiant.associates.find((item) => item.id === candidate.associateId);
    if (!associate) return null;
    const presentation = presentationFor(candidate);
    const compact = forceCompact && expandedCandidate !== candidate.id;
    return (
      <div key={candidate.id} className={styles.candidateWrap}>
        <MatchCandidateCard
          associateId={associate.id}
          associateName={associate.name}
          headline={associate.headline}
          candidate={candidate}
          presentation={presentation}
          actions={actionsForCandidate(candidate.shortlistStatus)}
          onAction={(action) => runAction(candidate.id, action)}
          quoteAmount={quoteAmount[candidate.id]}
          onQuoteChange={(amount) => setQuoteAmount({ ...quoteAmount, [candidate.id]: amount })}
          noteValue={actionNotes[candidate.id] ?? ""}
          onNoteChange={(value) => setActionNotes({ ...actionNotes, [candidate.id]: value })}
          compact={compact}
        />
        <button
          type="button"
          className={styles.expandCandidate}
          onClick={() => setExpandedCandidate(expandedCandidate === candidate.id ? null : candidate.id)}
        >
          {compact ? "Show match detail" : "Hide match detail"}
        </button>
      </div>
    );
  };

  return (
    <div className={`page ${styles.density}`}>
      <header className="page-head">
        <div>
          <p className="kicker">
            <Link href="/staffing/requirements">Requirements</Link>
          </p>
          <h1>{requirement.title}</h1>
          <p className="subtitle">
            {account?.name ?? "Client"} · {requirement.category} · {requirement.sector} · {mapRequirementToOpsStage(requirement)} ·{" "}
            {daysOpen(requirement)} days open · {verifiedAvailableMatchCount(state, requirement.id)} verified available
          </p>
        </div>
        <div className="page-actions">
          <Button
            variant="secondary"
            icon="tasks"
            onClick={() =>
              openTaskForm({
                title: "Create staffing task",
                initial: {
                  title: `Follow up · ${requirement.title}`,
                  description: `Follow up on requirement ${requirement.title}`,
                  leadId: account?.linkedLeadId ?? requirement.linkedOpportunityId ?? null,
                  priority: "medium",
                  due: null,
                  ownerId: "me",
                },
              })
            }
          >
            Add task
          </Button>
          <Button icon="search" onClick={runMatches}>
            Find Matches
          </Button>
        </div>
      </header>

      <RecordInsightChip requirementId={requirement.id} accountId={requirement.accountId} />

      <RecommendedMatches state={state} requirement={requirement} />

      {counts && (
        <div className={styles.statStrip} aria-label="Pipeline counts">
          <div>
            <b className="tabular">{counts.suggested}</b>
            <span>Suggested / contacted</span>
          </div>
          <div>
            <b className="tabular">{counts.shortlisted}</b>
            <span>Shortlisted / submitted</span>
          </div>
          <div>
            <b className="tabular">{counts.interviewed}</b>
            <span>Interview</span>
          </div>
          <div>
            <b className="tabular">{counts.offered}</b>
            <span>Offer</span>
          </div>
          <div>
            <b className="tabular">{counts.filled}</b>
            <span>Filled · need {requirement.headcount}</span>
          </div>
        </div>
      )}

      <nav className="pill-tabs" aria-label="Requirement sections">
        {SECTIONS.map((section) => (
          <button
            key={section.id}
            type="button"
            className="pill-tab"
            aria-pressed={tab === section.id}
            onClick={() => setTab(section.id)}
          >
            {section.label}
            {section.id === "candidates" && matchingCandidates.length > 0 ? ` · ${matchingCandidates.length}` : ""}
            {section.id === "interviews" && interviewCandidates.length > 0 ? ` · ${interviewCandidates.length}` : ""}
          </button>
        ))}
      </nav>

      <section className={`card tab-panel`}>
        <div className="card-body">
          <div className={styles.stageRail} aria-label="Requirement stages">
            {REQUIREMENT_STAGES.map((stage, index) => (
              <button
                key={stage}
                type="button"
                className={styles.stagePill}
                data-active={requirement.stage === stage}
                data-done={index < stageIndex}
                onClick={() => moveStage(stage)}
              >
                {stage}
              </button>
            ))}
          </div>
          <div className={styles.outcomeBar}>
            <Button
              size="small"
              variant="secondary"
              onClick={() => {
                crm.setRequirementOutcome(requirement.id, "on_hold", outcomeReason || "On hold");
                toast("Marked on hold", "info");
              }}
            >
              On hold
            </Button>
            <Button
              size="small"
              variant="secondary"
              onClick={() => {
                crm.setRequirementOutcome(requirement.id, "lost", outcomeReason || "Lost");
                toast("Marked lost", "info");
              }}
            >
              Lost
            </Button>
            <Button
              size="small"
              variant="secondary"
              onClick={() => {
                crm.setRequirementOutcome(requirement.id, "cancelled", outcomeReason || "Cancelled");
                toast("Cancelled", "info");
              }}
            >
              Cancelled
            </Button>
            <input
              className="input"
              placeholder="Outcome reason (optional)"
              value={outcomeReason}
              onChange={(e) => setOutcomeReason(e.target.value)}
              aria-label="Outcome reason"
            />
            <span className="chip">Outcome: {requirement.outcome}</span>
          </div>
        </div>
      </section>

      {tab === "overview" && <section className={`${styles.split} ${styles.sectionAnchor}`}>
        <article className="card">
          <div className="card-head">
            <h2>Overview</h2>
          </div>
          <div className="card-body">
            <p>{requirement.description}</p>
            <div className={styles.metaRow} style={{ marginTop: 12 }}>
              {requirement.mustHaveSkills.map((skill) => (
                <span key={skill} className="chip">
                  Must · {skill}
                </span>
              ))}
              {requirement.preferredSkills.map((skill) => (
                <span key={skill} className="chip chip-ai">
                  Desirable · {skill}
                </span>
              ))}
            </div>
            <p className="muted" style={{ marginTop: 12 }}>
              {requirement.seniority} · {requirement.roleType} · {requirement.workingMode} · {requirement.location}
            </p>
            <p className="muted">
              Start {formatDate(requirement.startDate)} · {requirement.durationWeeks} weeks · {requirement.headcount} position
              {requirement.headcount === 1 ? "" : "s"} · urgency {requirement.priority ?? "medium"}
            </p>
            <p className="muted">
              Budget {requirement.currency} {requirement.rateMin ?? "—"}–{requirement.rateMax ?? "—"}/{requirement.rateUnit}
            </p>
            <p className="muted">Owner: {owner?.name ?? "Unassigned"}</p>
            {opportunity && (
              <p className="muted">
                Linked opportunity:{" "}
                <Link href={`/sales/accounts/${opportunity.accountId}`}>{opportunity.name}</Link> · {opportunity.stage} · £
                {opportunity.amount.toLocaleString("en-GB")}
              </p>
            )}
            {account && (
              <p className="muted">
                Client 360: <Link href={`/sales/accounts/${account.id}`}>{account.name}</Link>
              </p>
            )}
            {requirement.notes ? <p className="muted">{requirement.notes}</p> : null}
          </div>
        </article>

        <article className="card">
          <div className="card-head">
            <h2>Stage history</h2>
          </div>
          <div className="card-body">
            <ul className={styles.timeline}>
              {[...requirement.stageHistory].reverse().map((entry, index) => (
                <li key={`${entry.at}-${index}`}>
                  <b>{entry.stage}</b>
                  <div className="muted">
                    {timeAgo(entry.at)}
                    {entry.reason ? ` · ${entry.reason}` : ""}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </article>
      </section>}

      {tab === "candidates" && <section className={`card ${styles.sectionAnchor}`}>
        <div className="card-head">
          <div>
            <h2>Candidates</h2>
          </div>
          <Button variant="secondary" size="small" icon="search" onClick={runMatches}>
            Refresh matches
          </Button>
        </div>
        <div className="card-body stack-gap">
          {matchingCandidates.length === 0 ? (
            <EmptyState title="No match suggestions" icon="users">
              Use <b>Find Matches</b> or add a candidate below.
            </EmptyState>
          ) : (
            <div className={`kanban-board ${styles.candidateBoard}`} aria-label="Candidate pipeline">
              {groupCandidatesByStatus(matchingCandidates).map((column) => (
                <div key={column.status} className={`kanban-column ${styles.candidateColumn}`}>
                  <div className={styles.boardColumnHead}>
                    <b>{column.label}</b>
                    <span className="chip tabular">{column.items.length}</span>
                  </div>
                  {column.items.length === 0 ? (
                    <p className="muted">None</p>
                  ) : (
                    column.items.map((candidate) => renderCard(candidate))
                  )}
                </div>
              ))}
            </div>
          )}

          <div className={styles.actions} style={{ marginTop: 16 }}>
            <select
              className="input"
              value={externalAssociateId}
              onChange={(e) => setExternalAssociateId(e.target.value)}
              aria-label="Add existing associate as external source"
            >
              <option value="">Add existing associate as externally sourced…</option>
              {tessiant.associates
                .filter((associate) => !candidates.some((c) => c.associateId === associate.id))
                .slice(0, 40)
                .map((associate) => (
                  <option key={associate.id} value={associate.id}>
                    {associate.name}
                  </option>
                ))}
            </select>
            <Button
              size="small"
              variant="secondary"
              disabled={!externalAssociateId}
              onClick={() => {
                crm.recordExternalCandidate(requirement.id, externalAssociateId);
                setExternalAssociateId("");
                toast("External candidate recorded on timeline", "success");
              }}
            >
              Add from network
            </Button>
            <input
              className="input"
              style={{ maxWidth: 260 }}
              placeholder="Manual override reason"
              value={overrideReason}
              onChange={(e) => setOverrideReason(e.target.value)}
              aria-label="Override reason"
            />
            <Button
              size="small"
              variant="ghost"
              disabled={!overrideReason.trim() || candidates.length === 0}
              onClick={() => {
                const top = candidates[0];
                crm.overrideCandidateRank(top.id, 1, overrideReason);
                setOverrideReason("");
                toast("Manual rank override saved", "info");
              }}
            >
              Override top rank
            </Button>
          </div>

          <div className={styles.externalForm}>
            <h3 style={{ margin: "0 0 8px", fontSize: 14 }}>Record external candidate</h3>
            <div className={styles.formGrid}>
              <div className={styles.field}>
                <label htmlFor="extName">Name</label>
                <input
                  id="extName"
                  className="input"
                  value={externalForm.name}
                  onChange={(e) => setExternalForm({ ...externalForm, name: e.target.value })}
                />
              </div>
              <div className={styles.field}>
                <label htmlFor="extHeadline">Headline</label>
                <input
                  id="extHeadline"
                  className="input"
                  value={externalForm.headline}
                  onChange={(e) => setExternalForm({ ...externalForm, headline: e.target.value })}
                />
              </div>
              <div className={styles.field}>
                <label htmlFor="extSkills">Skills (comma-separated)</label>
                <input
                  id="extSkills"
                  className="input"
                  value={externalForm.skills}
                  onChange={(e) => setExternalForm({ ...externalForm, skills: e.target.value })}
                />
              </div>
              <div className={styles.field}>
                <label htmlFor="extSectors">Sectors</label>
                <input
                  id="extSectors"
                  className="input"
                  value={externalForm.sectors}
                  onChange={(e) => setExternalForm({ ...externalForm, sectors: e.target.value })}
                  placeholder={requirement.sector}
                />
              </div>
              <div className={styles.field}>
                <label htmlFor="extRate">Indicative day rate</label>
                <input
                  id="extRate"
                  className="input"
                  type="number"
                  value={externalForm.rateAmount}
                  onChange={(e) => setExternalForm({ ...externalForm, rateAmount: e.target.value })}
                />
              </div>
              <div className={styles.field}>
                <label htmlFor="extLocation">Location</label>
                <input
                  id="extLocation"
                  className="input"
                  value={externalForm.location}
                  onChange={(e) => setExternalForm({ ...externalForm, location: e.target.value })}
                />
              </div>
              <div className={`${styles.field} ${styles.full}`}>
                <label htmlFor="extNotes">Notes</label>
                <input
                  id="extNotes"
                  className="input"
                  value={externalForm.notes}
                  onChange={(e) => setExternalForm({ ...externalForm, notes: e.target.value })}
                />
              </div>
            </div>
            <div className={styles.actions}>
              <Button
                size="small"
                icon="plus"
                onClick={() => {
                  if (!externalForm.name.trim()) {
                    toast("Name is required for an external candidate", "error");
                    return;
                  }
                  crm.recordExternalNetworkCandidate(requirement.id, {
                    name: externalForm.name,
                    headline: externalForm.headline,
                    skills: externalForm.skills.split(",").map((s) => s.trim()).filter(Boolean),
                    sectors: externalForm.sectors.split(",").map((s) => s.trim()).filter(Boolean),
                    rateAmount: externalForm.rateAmount ? Number(externalForm.rateAmount) : null,
                    location: externalForm.location,
                    notes: externalForm.notes,
                  });
                  setExternalForm({ name: "", headline: "", skills: "", sectors: "", rateAmount: "", location: "", notes: "" });
                  toast("External candidate created and shortlisted", "success");
                }}
              >
                Record external candidate
              </Button>
            </div>
          </div>

          <div style={{ marginTop: 8 }}>
            <h3 style={{ margin: "0 0 4px", fontSize: 14 }}>Pipeline</h3>
            {pipelineGroups.length === 0 ? (
              <EmptyState title="Pipeline empty" icon="users" />
            ) : (
              pipelineGroups.map((group) => (
                <div key={group.status} className={styles.pipelineGroup}>
                  <h3>
                    {group.label} <span className="chip tabular">{group.items.length}</span>
                  </h3>
                  {group.items.length === 0 ? (
                    <p className="muted">None</p>
                  ) : (
                    <div className={styles.stack}>{group.items.map((candidate) => renderCard(candidate, true))}</div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </section>}

      {tab === "interviews" && (
        <section className={`card ${styles.sectionAnchor}`}>
          <div className="card-head">
            <h2>Interviews</h2>
          </div>
          <div className="card-body">
            {interviewCandidates.length === 0 ? (
              <EmptyState title="No interviews yet" icon="users" />
            ) : (
              <div className={styles.stack}>{interviewCandidates.map((candidate) => renderCard(candidate))}</div>
            )}
          </div>
        </section>
      )}

      {tab === "commercials" && <section className={`${styles.split} ${styles.sectionAnchor}`}>
        <article className="card">
          <div className="card-head">
            <h2>Commercials</h2>
          </div>
          <div className="card-body">
            {commercialCandidates.length === 0 ? (
              <EmptyState title="No quotes yet" icon="checkCircle" />
            ) : (
              <ul className={styles.timeline}>
                {commercialCandidates.map((candidate) => {
                  const associate = tessiant.associates.find((item) => item.id === candidate.associateId);
                  return (
                    <li key={candidate.id}>
                      <b>{associate?.name ?? "Associate"}</b>
                      <div className="muted">
                        {candidateStatusLabel(candidate.shortlistStatus)} · Client {formatRate(candidate.quotedClientRate)} · Cost{" "}
                        {formatRate(candidate.validation.indicativeCost)}
                      </div>
                      <div className="muted">{marginForCandidate(candidate.validation.indicativeCost, candidate.quotedClientRate)}</div>
                      {normalizeCandidateStatus(candidate.shortlistStatus) === "offer" && (
                        <div className={styles.actions}>
                          {actionsForCandidate(candidate.shortlistStatus).map((action) => (
                            <Button
                              key={action.type}
                              size="small"
                              variant={action.type === "reject" ? "ghost" : "secondary"}
                              onClick={() => runAction(candidate.id, action)}
                            >
                              {action.label}
                            </Button>
                          ))}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </article>

        <article className="card">
          <div className="card-head">
            <h2>Placement</h2>
          </div>
          <div className="card-body">
            {!activePlacement ? (
              <EmptyState title="No placement confirmed" icon="checkCircle" />
            ) : (
              <>
                <p>
                  <b>{activePlacement.assignmentStatus ?? activePlacement.status}</b> ·{" "}
                  {tessiant.associates.find((a) => a.id === activePlacement.associateId)?.name}
                  {activePlacement.capacityPercent != null ? ` · ${activePlacement.capacityPercent}% capacity` : ""}
                </p>
                <p className="muted">
                  Cost {formatRate(activePlacement.terms.associateCost)} · Client {formatRate(activePlacement.terms.clientRate)}
                </p>
                <p className="muted">{marginForCandidate(activePlacement.terms.associateCost, activePlacement.terms.clientRate)}</p>
                <p className="muted">
                  Start {activePlacement.terms.startDate ? formatDate(activePlacement.terms.startDate) : "—"} · placed{" "}
                  {activePlacement.placementDate ? timeAgo(activePlacement.placementDate) : "—"}
                </p>
                <div className={styles.actions}>
                  <Link href={`/staffing/placements/${activePlacement.id}`}>
                    <Button size="small" variant="secondary">
                      Open assignment
                    </Button>
                  </Link>
                  <Button
                    size="small"
                    variant="ghost"
                    onClick={() => {
                      crm.completeAssignment(activePlacement.id, {
                        confirmedAvailableDate: activePlacement.terms.endDate || addDays(0),
                        note: "Completed from requirement workspace",
                      });
                      toast("Assignment completed — availability uses confirmed date", "success");
                    }}
                  >
                    Complete assignment
                  </Button>
                  <Link href="/staffing/placements" className="text-link">
                    Assignments desk
                  </Link>
                </div>
              </>
            )}
          </div>
        </article>
      </section>}

      {tab === "activity" && <section className={`card ${styles.sectionAnchor}`}>
        <div className="card-head">
          <h2>Activity</h2>
        </div>
        <div className="card-body">
          <p>
            Client:{" "}
            {account ? <Link href={`/sales/accounts/${account.id}`}>{account.name}</Link> : "—"}
          </p>
          {tasks.length > 0 && (
            <ul className={styles.timeline} style={{ marginBottom: 16 }}>
              {tasks.map((task) => (
                <li key={task.id}>
                  <b>{task.title}</b>
                  <div className="muted">
                    {task.status} · due {task.due ? formatDate(task.due) : "—"}
                  </div>
                </li>
              ))}
            </ul>
          )}
          {timeline.length === 0 ? (
            <EmptyState title="No activity yet" icon="tasks" />
          ) : (
            <ul className={`${styles.timeline} ${styles.eventFeed}`}>
              {timeline.map((item) => (
                <li key={item.id}>
                  <b>{item.title}</b>
                  <div className="muted">
                    {timeAgo(item.at)} · {item.actor}
                    {item.detail ? ` · ${item.detail}` : ""}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>}
    </div>
  );
}
