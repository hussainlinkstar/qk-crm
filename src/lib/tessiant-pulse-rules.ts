// Deterministic Tessiant Pulse signal rules. Thresholds are configuration, not ML.

import type { CrmState } from "./types";
import { PULSE_TENANT_ID, type TessiantInsight } from "./tessiant-pulse-types";
import { addDays, formatDate } from "./format";
import { founderDependency } from "./founder-dependency";
import { benchTimeline } from "./bench-timeline";
import { offeringCatalogue } from "./offerings";

const DAY_MS = 86_400_000;

export const PULSE_RULE_CONFIG = {
  coverageGapMinVerifiedAvailable: 2,
  stalledStageDays: 5,
  availabilityVerificationDays: 30,
  offeringMismatchMinOpenDemand: 1,
} as const;

function daysBetween(iso: string, now: number) {
  return (now - new Date(iso).getTime()) / DAY_MS;
}

function isVerifiedAvailable(associate: {
  verifiedAt: string | null;
  availability: string;
  status: string;
}) {
  return Boolean(associate.verifiedAt) && associate.availability === "available" && associate.status === "active";
}

/** Generate insights from CRM Tessiant slice; merge persisted review state. */
export function generateTessiantInsights(state: CrmState, now = Date.now()): TessiantInsight[] {
  const tessiant = state.tessiant;
  if (!tessiant) return [];
  const asOf = new Date(now).toISOString();
  const insights: TessiantInsight[] = [];

  const openReqs = tessiant.requirements.filter((req) => !req.archived && req.outcome === "active" && req.stage !== "Placed");

  // Rule: coverage_gap
  for (const req of openReqs) {
    const matches = tessiant.candidates.filter((c) => c.requirementId === req.id);
    const verifiedAvailable = matches.filter((c) => {
      const associate = tessiant.associates.find((a) => a.id === c.associateId);
      return associate && isVerifiedAvailable(associate) && c.matchScore >= 50;
    });
    if (verifiedAvailable.length < PULSE_RULE_CONFIG.coverageGapMinVerifiedAvailable) {
      const id = `ins_coverage_${req.id}`;
      insights.push(
        applyReview(
          {
            id,
            tenantId: PULSE_TENANT_ID,
            knowledgeBlockId: "augmentation",
            ruleId: "coverage_gap",
            title: `Coverage gap · ${req.title}`,
            summary: `Open requirement has ${verifiedAvailable.length} verified available match(es) (threshold < ${PULSE_RULE_CONFIG.coverageGapMinVerifiedAvailable}). Verify availability of existing candidates or expand sourcing.`,
            priority: verifiedAvailable.length === 0 ? "high" : "medium",
            evidence: [
              { entityType: "requirement", entityId: req.id, field: "stage", observedValue: req.stage, href: `/staffing/requirements/${req.id}` },
              { entityType: "requirement", entityId: req.id, field: "verifiedAvailableMatches", observedValue: verifiedAvailable.length },
              ...matches.slice(0, 4).map((c) => ({
                entityType: "candidate" as const,
                entityId: c.id,
                field: "shortlistStatus",
                observedValue: c.shortlistStatus,
                href: `/staffing/associates/${c.associateId}`,
              })),
            ],
            generatedAt: asOf,
            dataAsOf: asOf,
            confidence: matches.length ? ("verified" as const) : ("partial" as const),
            recommendedAction: {
              type: "review_sourcing",
              label: "Verify availability or expand sourcing",
              suggestedOwnerId: req.ownerId ?? "me",
            },
            reviewStatus: "pending",
          },
          tessiant.pulse,
        ),
      );
    }
  }

  // Rule: stalled_requirement
  for (const req of openReqs) {
    const stageEntry = [...req.stageHistory].reverse().find((entry) => entry.stage === req.stage);
    const stageAt = stageEntry?.at ?? req.updatedAt;
    const age = daysBetween(stageAt, now);
    if (age > PULSE_RULE_CONFIG.stalledStageDays) {
      const id = `ins_stalled_${req.id}_${req.stage.replace(/\s+/g, "_")}`;
      insights.push(
        applyReview(
          {
            id,
            tenantId: PULSE_TENANT_ID,
            knowledgeBlockId: "augmentation",
            ruleId: "stalled_requirement",
            title: `Stalled in ${req.stage} · ${req.title}`,
            summary: `Requirement has remained in ${req.stage} for ${Math.floor(age)} days (threshold > ${PULSE_RULE_CONFIG.stalledStageDays}). Ask owner to unblock.`,
            priority: age > 10 ? "high" : "medium",
            evidence: [
              { entityType: "requirement", entityId: req.id, field: "stage", observedValue: req.stage, href: `/staffing/requirements/${req.id}` },
              { entityType: "requirement", entityId: req.id, field: "stageAgeDays", observedValue: Math.floor(age) },
              { entityType: "requirement", entityId: req.id, field: "ownerId", observedValue: req.ownerId ?? "unassigned" },
            ],
            generatedAt: asOf,
            dataAsOf: asOf,
            confidence: "verified",
            recommendedAction: {
              type: "unblock_requirement",
              label: "Ask owner to unblock this requirement",
              suggestedOwnerId: req.ownerId ?? "me",
            },
            reviewStatus: "pending",
          },
          tessiant.pulse,
        ),
      );
    }
  }

  // Rule: expiring_availability (shortlisted without recent validation)
  for (const candidate of tessiant.candidates) {
    if (
      !["shortlisted", "availability_confirmed", "submitted_to_client", "interview", "offer", "validating", "quoted", "selected"].includes(
        candidate.shortlistStatus,
      )
    )
      continue;
    const associate = tessiant.associates.find((a) => a.id === candidate.associateId);
    if (!associate) continue;
    const verifiedAt = candidate.validation.verifiedAt ?? associate.verifiedAt;
    const stale = !verifiedAt || daysBetween(verifiedAt, now) > PULSE_RULE_CONFIG.availabilityVerificationDays;
    if (!stale) continue;
    const req = tessiant.requirements.find((r) => r.id === candidate.requirementId);
    const id = `ins_expiry_${candidate.id}`;
    insights.push(
      applyReview(
        {
          id,
          tenantId: PULSE_TENANT_ID,
          knowledgeBlockId: "network",
          ruleId: "expiring_availability",
          title: `Re-verify availability · ${associate.name}`,
          summary: `Shortlisted associate availability not verified within ${PULSE_RULE_CONFIG.availabilityVerificationDays} days${verifiedAt ? ` (last ${Math.floor(daysBetween(verifiedAt, now))}d ago)` : " (never verified)"}.`,
          priority: "medium",
          evidence: [
            { entityType: "associate", entityId: associate.id, field: "availability", observedValue: associate.availability, href: `/staffing/associates/${associate.id}` },
            { entityType: "candidate", entityId: candidate.id, field: "shortlistStatus", observedValue: candidate.shortlistStatus },
            ...(req
              ? [{ entityType: "requirement" as const, entityId: req.id, field: "title", observedValue: req.title, href: `/staffing/requirements/${req.id}` }]
              : []),
          ],
          generatedAt: asOf,
          dataAsOf: asOf,
          confidence: verifiedAt ? "partial" : "needs-review",
          recommendedAction: {
            type: "reverify_availability",
            label: `Re-verify availability for ${associate.name}`,
            suggestedOwnerId: associate.ownerId ?? req?.ownerId ?? "me",
          },
          reviewStatus: "pending",
        },
        tessiant.pulse,
      ),
    );
  }

  // Rule: offering_mismatch / public sector coverage (capability + network)
  const publicDemand = openReqs.filter((req) => req.sector.toLowerCase().includes("public"));
  if (publicDemand.length >= PULSE_RULE_CONFIG.offeringMismatchMinOpenDemand) {
    const verifiedPublic = tessiant.associates.filter(
      (a) => isVerifiedAvailable(a) && a.sectors.some((s) => s.toLowerCase().includes("public")),
    );
    if (verifiedPublic.length < publicDemand.length * 2) {
      const id = "ins_offering_public_sector";
      insights.push(
        applyReview(
          {
            id,
            tenantId: PULSE_TENANT_ID,
            knowledgeBlockId: "capability",
            ruleId: "offering_mismatch",
            title: "Public-sector coverage below open demand",
            summary: `${publicDemand.length} open public-sector requirement(s) vs ${verifiedPublic.length} verified available public-aligned associates in the sample. Validate readiness before expanding offerings.`,
            priority: "high",
            evidence: [
              { entityType: "requirement", entityId: publicDemand[0].id, field: "openPublicDemand", observedValue: publicDemand.length, href: `/staffing/requirements/${publicDemand[0].id}` },
              { entityType: "associate", entityId: verifiedPublic[0]?.id ?? "none", field: "verifiedPublicAvailable", observedValue: verifiedPublic.length },
            ],
            generatedAt: asOf,
            dataAsOf: asOf,
            confidence: "partial",
            recommendedAction: {
              type: "validate_capability",
              label: "Validate public-sector delivery readiness",
              suggestedOwnerId: "m_sarah",
            },
            reviewStatus: "pending",
          },
          tessiant.pulse,
        ),
      );
    }
  }

  // SAP scarce skill demand (network / offering)
  const sapDemand = openReqs.filter((req) => req.mustHaveSkills.some((s) => /sap/i.test(s)));
  if (sapDemand.length) {
    const sapCapacity = tessiant.associates.filter(
      (a) => isVerifiedAvailable(a) && a.skills.some((s) => /sap/i.test(s)),
    );
    if (sapCapacity.length < sapDemand.length * PULSE_RULE_CONFIG.coverageGapMinVerifiedAvailable) {
      const id = "ins_offering_sap";
      insights.push(
        applyReview(
          {
            id,
            tenantId: PULSE_TENANT_ID,
            knowledgeBlockId: "network",
            ruleId: "offering_mismatch",
            title: "SAP specialist capacity below open demand",
            summary: `${sapDemand.length} open SAP-tagged requirement(s) with only ${sapCapacity.length} verified available SAP specialist(s) in sample. Prioritise additional SAP specialists.`,
            priority: "high",
            evidence: [
              { entityType: "requirement", entityId: sapDemand[0].id, field: "mustHaveSkills", observedValue: sapDemand[0].mustHaveSkills.join(", "), href: `/staffing/requirements/${sapDemand[0].id}` },
              { entityType: "associate", entityId: sapCapacity[0]?.id ?? "none", field: "verifiedSapAvailable", observedValue: sapCapacity.length, href: sapCapacity[0] ? `/staffing/associates/${sapCapacity[0].id}` : undefined },
            ],
            generatedAt: asOf,
            dataAsOf: asOf,
            confidence: "verified",
            recommendedAction: {
              type: "grow_network",
              label: "Prioritise additional SAP specialists",
              suggestedOwnerId: sapDemand[0].ownerId ?? "me",
            },
            reviewStatus: "pending",
          },
          tessiant.pulse,
        ),
      );
    }
  }

  // Rule: relationship_concentration
  for (const account of tessiant.accounts) {
    if (!account.primaryOwnerId || account.secondaryOwnerId) continue;
    if (account.status === "inactive") continue;
    const id = `ins_rel_${account.id}`;
    insights.push(
      applyReview(
        {
          id,
          tenantId: PULSE_TENANT_ID,
          knowledgeBlockId: "commercial",
          ruleId: "relationship_concentration",
          title: `Founder / single-owner risk · ${account.name}`,
          summary: "Active account has a primary relationship owner and no documented secondary owner. Assign continuity coverage.",
          priority: "high",
          evidence: [
            { entityType: "account", entityId: account.id, field: "primaryOwnerId", observedValue: account.primaryOwnerId, href: `/sales/accounts/${account.id}` },
            { entityType: "account", entityId: account.id, field: "secondaryOwnerId", observedValue: "null" },
          ],
          generatedAt: asOf,
          dataAsOf: asOf,
          confidence: "verified",
          recommendedAction: {
            type: "assign_secondary_owner",
            label: "Assign secondary owner and capture relationship history",
            suggestedOwnerId: "m_sarah",
          },
          reviewStatus: "pending",
        },
        tessiant.pulse,
      ),
    );
  }

  // Rule: possible_cross_sell — SIA interview positive on advisory without placement = potential only
  for (const candidate of tessiant.candidates) {
    if (candidate.interview.outcome !== "positive") continue;
    const associate = tessiant.associates.find((a) => a.id === candidate.associateId);
    const req = tessiant.requirements.find((r) => r.id === candidate.requirementId);
    if (!associate || !req || (associate.roleType !== "SIA" && associate.roleType !== "executive_advisor")) continue;
    const placed = tessiant.placements.some((p) => p.requirementId === req.id && (p.status === "confirmed" || p.status === "closed"));
    if (placed) continue;
    const account = tessiant.accounts.find((a) => a.id === req.accountId);
    const id = `ins_crosssell_${req.id}`;
    insights.push(
      applyReview(
        {
          id,
          tenantId: PULSE_TENANT_ID,
          knowledgeBlockId: "commercial",
          ruleId: "possible_cross_sell",
          title: `Possible advisory expansion · ${account?.name ?? "account"}`,
          summary: "SIA interview recorded positive feedback on an advisory request without a confirmed placement. Treat as pipeline potential — not realised revenue.",
          priority: "medium",
          evidence: [
            { entityType: "requirement", entityId: req.id, field: "category", observedValue: req.category, href: `/staffing/requirements/${req.id}` },
            { entityType: "candidate", entityId: candidate.id, field: "interview.outcome", observedValue: candidate.interview.outcome },
            { entityType: "associate", entityId: associate.id, field: "roleType", observedValue: "SIA", href: `/staffing/associates/${associate.id}` },
            ...(account
              ? [{ entityType: "account" as const, entityId: account.id, field: "name", observedValue: account.name, href: `/sales/accounts/${account.id}` }]
              : []),
          ],
          generatedAt: asOf,
          dataAsOf: asOf,
          confidence: "partial",
          recommendedAction: {
            type: "account_review",
            label: "Review possible consulting/advisory opportunity (pipeline only)",
            suggestedOwnerId: req.ownerId ?? "me",
          },
          reviewStatus: "pending",
        },
        tessiant.pulse,
      ),
    );
  }

  // Rule: sia_contribution — summarise measured SIA activity
  const siaAssociates = tessiant.associates.filter((a) => a.roleType === "SIA" || a.roleType === "executive_advisor");
  const siaCandidateIds = new Set(siaAssociates.map((a) => a.id));
  const siaLinkedCandidates = tessiant.candidates.filter((c) => siaCandidateIds.has(c.associateId));
  const siaPlacements = tessiant.placements.filter((p) => siaCandidateIds.has(p.associateId) && (p.status === "confirmed" || p.status === "closed"));
  if (siaLinkedCandidates.length) {
    const id = "ins_sia_contribution";
    insights.push(
      applyReview(
        {
          id,
          tenantId: PULSE_TENANT_ID,
          knowledgeBlockId: "commercial",
          ruleId: "sia_contribution",
          title: "SIA contribution snapshot (recorded only)",
          summary: `${siaAssociates.length} SIA profiles in sample · ${siaLinkedCandidates.length} linked candidate record(s) · ${siaPlacements.length} confirmed/closed placement(s). Underused if SIAs are shortlisted without commercial progression.`,
          priority: "low",
          evidence: [
            { entityType: "associate", entityId: siaAssociates[0]?.id ?? "sia", field: "siaSample", observedValue: siaAssociates.length },
            { entityType: "candidate", entityId: siaLinkedCandidates[0]?.id ?? "none", field: "siaLinkedCandidates", observedValue: siaLinkedCandidates.length },
            { entityType: "placement", entityId: siaPlacements[0]?.id ?? "none", field: "siaPlacements", observedValue: siaPlacements.length },
          ],
          generatedAt: asOf,
          dataAsOf: asOf,
          confidence: "verified",
          recommendedAction: {
            type: "review_sia_channels",
            label: "Review underused SIA introduction channels",
            suggestedOwnerId: "me",
          },
          reviewStatus: "pending",
        },
        tessiant.pulse,
      ),
    );
  }

  // Rule: founder_dependency — the recorded dependency score, not just "one owner".
  for (const account of tessiant.accounts.filter((item) => item.status !== "inactive")) {
    const score = founderDependency(state, account.id, now);
    if (!score || score.band !== "high") continue;
    insights.push(
      applyReview(
        {
          id: `ins_founder_${account.id}`,
          tenantId: PULSE_TENANT_ID,
          knowledgeBlockId: "commercial",
          ruleId: "founder_dependency",
          title: `${account.name} rests on ${score.keyPerson ?? "one person"}`,
          summary: `Founder dependency ${score.score}/100${score.delta > 0 ? `, up ${score.delta} in three months` : ""}. ${score.drivers.map((item) => item.label).join("; ")}. Widen the relationship before it is tested.`,
          priority: "high",
          evidence: [
            { entityType: "account", entityId: account.id, field: "founderDependency", observedValue: score.score, href: `/sales/accounts/${account.id}` },
            ...score.drivers.map((driver) => ({ entityType: "account" as const, entityId: account.id, field: driver.label, observedValue: `+${driver.points}` })),
          ],
          generatedAt: asOf,
          dataAsOf: asOf,
          confidence: "verified",
          recommendedAction: { type: "widen_relationship", label: "Add a second owner and a second stakeholder", suggestedOwnerId: account.primaryOwnerId ?? "me" },
          reviewStatus: "pending",
        },
        tessiant.pulse,
      ),
    );
  }

  // Rule: proposal_without_brief — a staffing deal at Proposal or Negotiation with no requirement behind it.
  for (const opportunity of (state.opportunities ?? []).filter((item) => (item.stage === "Proposal" || item.stage === "Negotiation") && item.type !== "advisory" && item.type !== "consultancy")) {
    if (tessiant.requirements.some((req) => req.linkedOpportunityId === opportunity.id)) continue;
    const account = tessiant.accounts.find((item) => item.id === opportunity.accountId);
    insights.push(
      applyReview(
        {
          id: `ins_proposal_${opportunity.id}`,
          tenantId: PULSE_TENANT_ID,
          knowledgeBlockId: "augmentation",
          ruleId: "proposal_without_brief",
          title: `${opportunity.name} is at ${opportunity.stage} with no brief behind it`,
          summary: `£${opportunity.amount.toLocaleString("en-GB")} at ${opportunity.stage} for ${account?.name ?? "the client"}, expected ${formatDate(opportunity.expectedCloseDate)}. No staffing requirement is linked, so nobody is sourcing for a deal that may close.`,
          priority: opportunity.stage === "Negotiation" ? "high" : "medium",
          evidence: [
            { entityType: "opportunity", entityId: opportunity.id, field: "stage", observedValue: opportunity.stage, href: `/sales/pipeline?opportunity=${opportunity.id}` },
            { entityType: "opportunity", entityId: opportunity.id, field: "amount", observedValue: opportunity.amount },
          ],
          generatedAt: asOf,
          dataAsOf: asOf,
          confidence: "verified",
          recommendedAction: { type: "open_requirement", label: "Open the requirement so sourcing starts before the deal closes", suggestedOwnerId: opportunity.ownerId ?? "me" },
          reviewStatus: "pending",
        },
        tessiant.pulse,
      ),
    );
  }

  // Rule: bench_gap — a skill where briefs start inside 60 days and the bench runs short.
  const timeline = benchTimeline(state, "skill");
  for (const row of timeline.rows.filter((item) => item.cells[60].gap > 0)) {
    const cell = row.cells[60];
    insights.push(
      applyReview(
        {
          id: `ins_bench_${row.key.replace(/[^a-z0-9]+/gi, "_")}`,
          tenantId: PULSE_TENANT_ID,
          knowledgeBlockId: "capability",
          ruleId: "bench_gap",
          title: `${row.label}: ${cell.gap} short inside 60 days`,
          summary: `${cell.demand} seat${cell.demand === 1 ? "" : "s"} start within 60 days against ${cell.supply} on the bench by then (${cell.freeingUp} freeing up). Source or introduce before the start dates, not after.`,
          priority: cell.gap >= 2 ? "high" : "medium",
          evidence: cell.requirements.slice(0, 3).map((req) => ({ entityType: "requirement" as const, entityId: req.id, field: "startDate", observedValue: req.startDate, href: `/staffing/requirements/${req.id}` })),
          generatedAt: asOf,
          dataAsOf: asOf,
          confidence: "verified",
          recommendedAction: { type: "source_ahead", label: `Run the sweep and request introductions for ${row.label}`, suggestedOwnerId: "me" },
          reviewStatus: "pending",
        },
        tessiant.pulse,
      ),
    );
  }

  // Rule: offering_gap — an offering clients want with nobody free to deliver it.
  for (const offering of offeringCatalogue(state).filter((item) => item.health === "demand-exceeds-pool")) {
    insights.push(
      applyReview(
        {
          id: `ins_offering_${offering.key.replace(/[^a-z0-9]+/gi, "_")}`,
          tenantId: PULSE_TENANT_ID,
          knowledgeBlockId: "capability",
          ruleId: "offering_gap",
          title: `${offering.name}: demand exceeds the pool`,
          summary: `${offering.interested.length + offering.openDeals.length} demand signal${offering.interested.length + offering.openDeals.length === 1 ? "" : "s"} against ${offering.availableNow} available of ${offering.pool.length} who record the offering. Sell carefully until sourcing catches up.`,
          priority: "medium",
          evidence: [
            ...offering.interested.slice(0, 2).map((account) => ({ entityType: "account" as const, entityId: account.id, field: "offeringInterest", observedValue: offering.name, href: `/sales/accounts/${account.id}` })),
            ...offering.pool.slice(0, 2).map((associate) => ({ entityType: "associate" as const, entityId: associate.id, field: "availability", observedValue: associate.availability, href: `/staffing/associates/${associate.id}` })),
          ],
          generatedAt: asOf,
          dataAsOf: asOf,
          confidence: "verified",
          recommendedAction: { type: "grow_pool", label: `Grow the ${offering.name} pool before the next proposal`, suggestedOwnerId: "me" },
          reviewStatus: "pending",
        },
        tessiant.pulse,
      ),
    );
  }

  // Rule: sia_dormant — SIAs whose sector has prospects and who have introduced nobody.
  const introduced = new Set(state.leads.map((lead) => lead.introducedByAssociateId).filter(Boolean));
  const prospectSectors = new Set(tessiant.accounts.filter((item) => item.status !== "active").map((item) => item.sector));
  const dormant = tessiant.associates.filter((item) => item.roleType === "SIA" && item.status === "active" && !introduced.has(item.id) && item.sectors.some((sector) => prospectSectors.has(sector)));
  if (dormant.length) {
    insights.push(
      applyReview(
        {
          id: "ins_sia_dormant",
          tenantId: PULSE_TENANT_ID,
          knowledgeBlockId: "network",
          ruleId: "sia_dormant",
          title: `${dormant.length} SIA${dormant.length === 1 ? "" : "s"} with prospects in their sector and no introduction on record`,
          summary: `${dormant.slice(0, 3).map((item) => item.name).join(", ")}${dormant.length > 3 ? ` and ${dormant.length - 3} more` : ""} advise in sectors where Tessiant has prospects. SIA-sourced revenue is the number to move; an introduction ask costs one conversation.`,
          priority: "medium",
          evidence: dormant.slice(0, 4).map((item) => ({ entityType: "associate" as const, entityId: item.id, field: "introductions", observedValue: 0, href: `/staffing/associates/${item.id}` })),
          generatedAt: asOf,
          dataAsOf: asOf,
          confidence: "verified",
          recommendedAction: { type: "request_introduction", label: "Ask the SIAs for one introduction each", suggestedOwnerId: "me" },
          reviewStatus: "pending",
        },
        tessiant.pulse,
      ),
    );
  }

  // Deduplicate by id; sort by priority
  const rank = { high: 0, medium: 1, low: 2 };
  const unique = new Map<string, TessiantInsight>();
  for (const insight of insights) unique.set(insight.id, insight);
  return [...unique.values()].sort((a, b) => rank[a.priority] - rank[b.priority] || a.title.localeCompare(b.title));
}

function applyReview(
  insight: TessiantInsight,
  pulse?: { reviews?: Record<string, { decision: "accepted" | "rejected"; reason?: string; taskId?: string }>; outcomes?: { id: string; insightId: string }[] },
): TessiantInsight {
  const review = pulse?.reviews?.[insight.id];
  const outcome = pulse?.outcomes?.find((item) => item.insightId === insight.id);
  if (!review && !outcome) return insight;
  return {
    ...insight,
    reviewStatus: review ? (review.decision === "accepted" ? "accepted" : "rejected") : insight.reviewStatus,
    reviewReason: review?.reason,
    taskId: review?.taskId,
    outcomeId: outcome?.id,
  };
}

export function networkMix(state: CrmState) {
  const associates = state.tessiant?.associates ?? [];
  const byRole: Record<string, number> = {};
  const bySector: Record<string, number> = {};
  for (const associate of associates) {
    byRole[associate.roleType] = (byRole[associate.roleType] ?? 0) + 1;
    for (const sector of associate.sectors) bySector[sector] = (bySector[sector] ?? 0) + 1;
  }
  const verifiedAvailable = associates.filter(isVerifiedAvailable).length;
  return {
    byRole,
    bySector,
    sampleSize: associates.length,
    networkTotal: state.tessiant?.networkStats.totalMembers ?? 0,
    verifiedAvailable,
    verifiedSample: state.tessiant?.networkStats.verifiedSample ?? 0,
  };
}

export function placementFunnel(state: CrmState) {
  const requirements = state.tessiant?.requirements.filter((r) => !r.archived) ?? [];
  const denominator = requirements.length || 1;
  const stages = ["New Requirement", "Sourcing", "Validation", "Interview", "Commercials", "Placed"] as const;
  return {
    denominator,
    stages: stages.map((stage) => ({
      stage,
      count: requirements.filter((r) => r.stage === stage && r.outcome === "active").length,
    })),
    lostOrHeld: requirements.filter((r) => ["on_hold", "lost", "cancelled"].includes(r.outcome)).length,
  };
}

export function demoChatAnswers(): { question: string; answer: string }[] {
  return [
    {
      question: "Where are our biggest staffing capacity gaps?",
      answer:
        "Pulse rules currently flag SAP specialist scarcity and public-sector coverage vs open demand using the shared Tessiant CRM sample. Open the Network and Augmentation knowledge blocks for evidence-linked insights — numbers are computed from fixture records, not invented.",
    },
    {
      question: "Which accounts have founder relationship risk?",
      answer:
        "Accounts with a primary owner and no secondary owner trigger the relationship_concentration rule. In seed data, Crest Consumer Brands is the example. Accepting that insight creates a continuity task; it does not message the client.",
    },
    {
      question: "How much revenue has Pulse generated?",
      answer:
        "Pulse does not invent revenue. The Value page separates realised (confirmed placements/outcomes), pipeline potential (unclosed), and estimated time saved. Quoted CRM pipeline is never treated as realised.",
    },
  ];
}

export function suggestedDueFromNow(days = 2) {
  return addDays(days);
}
