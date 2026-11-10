// Deterministic Tessiant Pulse signal rules. Thresholds are configuration, not ML.

import type { CrmState } from "./types";
import { PULSE_TENANT_ID, type TessiantInsight } from "./tessiant-pulse-types";
import { addDays } from "./format";

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
  const reviews = tessiant.pulse?.reviews ?? {};
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
            summary: `Open requirement has ${verifiedAvailable.length} verified available match(es) (threshold < ${PULSE_RULE_CONFIG.coverageGapMinVerifiedAvailable}). Review sourcing or clarify constraints.`,
            priority: verifiedAvailable.length === 0 ? "high" : "medium",
            evidence: [
              { entityType: "requirement", entityId: req.id, field: "stage", observedValue: req.stage, href: `/staffing/requirements/${req.id}` },
              { entityType: "requirement", entityId: req.id, field: "verifiedAvailableMatches", observedValue: verifiedAvailable.length },
              ...verifiedAvailable.slice(0, 3).map((c) => ({
                entityType: "candidate" as const,
                entityId: c.id,
                field: "associateId",
                observedValue: c.associateId,
                href: `/staffing/associates/${c.associateId}`,
              })),
            ],
            generatedAt: asOf,
            dataAsOf: asOf,
            confidence: matches.length ? ("verified" as const) : ("partial" as const),
            recommendedAction: {
              type: "review_sourcing",
              label: "Review sourcing or requirement constraints",
              suggestedOwnerId: req.ownerId ?? "me",
            },
            reviewStatus: "pending",
          },
          reviews,
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
          reviews,
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
        reviews,
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
          reviews,
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
          reviews,
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
        reviews,
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
        reviews,
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
        reviews,
      ),
    );
  }

  // Deduplicate by id; sort by priority
  const rank = { high: 0, medium: 1, low: 2 };
  const unique = new Map<string, TessiantInsight>();
  for (const insight of insights) unique.set(insight.id, insight);
  return [...unique.values()].sort((a, b) => rank[a.priority] - rank[b.priority] || a.title.localeCompare(b.title));
}

function applyReview(insight: TessiantInsight, reviews: Record<string, { decision: "accepted" | "rejected"; reason?: string; taskId?: string }>): TessiantInsight {
  const review = reviews[insight.id];
  if (!review) return insight;
  return {
    ...insight,
    reviewStatus: review.decision === "accepted" ? "accepted" : "rejected",
    reviewReason: review.reason,
    taskId: review.taskId,
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
        "DEMO grounded answer: Pulse rules currently flag SAP specialist scarcity and public-sector coverage vs open demand using the shared Tessiant CRM sample. Open the Network and Augmentation knowledge blocks for evidence-linked insights — numbers are computed from fixture records, not invented.",
    },
    {
      question: "Which accounts have founder relationship risk?",
      answer:
        "DEMO grounded answer: Accounts with a primary owner and no secondary owner trigger the relationship_concentration rule. In seed data, Crest Consumer Brands is the example. Accepting that insight creates a continuity task; it does not message the client.",
    },
    {
      question: "How much revenue has Pulse generated?",
      answer:
        "DEMO grounded answer: Pulse does not invent revenue. The Value page separates realised (confirmed placements/outcomes), pipeline potential (unclosed), and estimated time saved. Quoted CRM pipeline is never treated as realised.",
    },
  ];
}

export function suggestedDueFromNow(days = 2) {
  return addDays(days);
}
