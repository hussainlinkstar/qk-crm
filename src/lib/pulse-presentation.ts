import type { CrmState } from "./types";
import { TESSIANT_KNOWLEDGE_BLOCKS } from "./tessiant-knowledge";
import type { InsightEvidence, TessiantInsight } from "./tessiant-pulse-types";

/** Human labels for evidence rows — never show raw technical IDs in primary UI. */
export function evidenceLabel(state: CrmState | null | undefined, item: InsightEvidence): string {
  const t = state?.tessiant;
  switch (item.entityType) {
    case "requirement": {
      const req = t?.requirements.find((row) => row.id === item.entityId);
      return req?.title ?? "Client requirement";
    }
    case "associate": {
      const associate = t?.associates.find((row) => row.id === item.entityId);
      return associate?.name ?? "Associate";
    }
    case "account": {
      const account = t?.accounts.find((row) => row.id === item.entityId);
      return account?.name ?? "Client account";
    }
    case "placement": {
      const placement = t?.placements.find((row) => row.id === item.entityId);
      const associate = placement ? t?.associates.find((row) => row.id === placement.associateId) : null;
      return associate ? `Assignment · ${associate.name}` : "Assignment";
    }
    case "candidate": {
      const candidate = t?.candidates.find((row) => row.id === item.entityId);
      const associate = candidate ? t?.associates.find((row) => row.id === candidate.associateId) : null;
      return associate ? `Shortlist · ${associate.name}` : "Shortlisted candidate";
    }
    case "opportunity": {
      const opportunity = (state?.opportunities ?? []).find((row) => row.id === item.entityId);
      return opportunity?.name ?? "Sales opportunity";
    }
    case "lead": {
      const lead = state?.leads.find((row) => row.id === item.entityId);
      return lead?.name ?? "Sales lead";
    }
    case "contact":
      return "Contact";
    case "task":
      return "Task";
    default:
      return "Related record";
  }
}

export function evidenceKindLabel(item: InsightEvidence): string {
  switch (item.entityType) {
    case "requirement":
      return "Requirement";
    case "associate":
      return "Associate";
    case "account":
      return "Account";
    case "placement":
      return "Assignment";
    case "candidate":
      return "Candidate";
    case "opportunity":
      return "Opportunity";
    case "lead":
      return "Lead";
    default:
      return "Record";
  }
}

export function knowledgeBlockTitle(id: TessiantInsight["knowledgeBlockId"]) {
  return TESSIANT_KNOWLEDGE_BLOCKS.find((block) => block.id === id)?.title ?? "Knowledge block";
}

export function expectedBenefit(insight: TessiantInsight): string {
  const block = TESSIANT_KNOWLEDGE_BLOCKS.find((item) => item.id === insight.knowledgeBlockId);
  if (block?.outcomeMeasures[0]) return block.outcomeMeasures[0];
  if (insight.ruleId === "coverage_gap") return "Improve shortlist coverage and reduce time-to-fill risk";
  if (insight.ruleId === "relationship_concentration") return "Reduce single-owner relationship dependency";
  if (insight.ruleId === "possible_cross_sell") return "Surface pipeline potential without claiming realised revenue";
  if (insight.ruleId === "stalled_requirement") return "Unblock delivery and restore placement momentum";
  return "Improve operational follow-through on a grounded Tessiant signal";
}

export function rulePlainLanguage(ruleId: string): string {
  const map: Record<string, string> = {
    coverage_gap: "Open requirements need enough verified available matches before delivery confidence is high. Completing a follow-up does not mean a placement or revenue was realised.",
    stalled_requirement: "Requirements that stay in one stage too long need an owner unblock.",
    expiring_availability: "Shortlisted associates need recent availability verification.",
    offering_mismatch: "Demand in a skill or sector exceeds verified available network capacity.",
    relationship_concentration: "Active accounts should have secondary relationship coverage.",
    possible_cross_sell: "Advisory interest without a confirmed placement is pipeline potential only.",
    sia_contribution: "SIA profiles should progress commercially when shortlisted.",
  };
  return map[ruleId] ?? "Deterministic Tessiant business rule based on current CRM records.";
}

export function confidenceNote(insight: TessiantInsight): string {
  if (insight.confidence === "verified") return "Based on verified CRM fields in the Tessiant demo sample.";
  if (insight.confidence === "partial") return "Partially grounded — some inputs are incomplete; treat as directional.";
  return "Needs review — supporting fields are thin or stale.";
}

export type AskPulseAnswer = {
  question: string;
  answer: string;
  links: { label: string; href: string }[];
};

export function askPulseCatalog(state: CrmState, realised: number): AskPulseAnswer[] {
  const t = state.tessiant;
  if (!t) return [];

  const ending = t.placements.filter((placement) => {
    const end = placement.terms.endDate;
    if (!end || placement.status === "closed") return false;
    const today = new Date().toISOString().slice(0, 10);
    const limit = new Date();
    limit.setDate(limit.getDate() + 30);
    const until = limit.toISOString().slice(0, 10);
    return end >= today && end <= until && (placement.outcome === "open" || placement.outcome == null) && placement.status === "confirmed";
  });

  const openReqs = t.requirements.filter((req) => !req.archived && req.outcome === "active" && req.stage !== "Placed");
  const sectorCounts = new Map<string, number>();
  for (const req of openReqs) {
    if (!req.sector) continue;
    sectorCounts.set(req.sector, (sectorCounts.get(req.sector) ?? 0) + 1);
  }
  const sectors = [...sectorCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);

  const thin = openReqs
    .map((req) => {
      const matches = t.candidates.filter((candidate) => candidate.requirementId === req.id);
      const verified = matches.filter((candidate) => {
        const associate = t.associates.find((item) => item.id === candidate.associateId);
        return (
          associate &&
          associate.verifiedAt &&
          associate.availability === "available" &&
          associate.status === "active" &&
          candidate.matchScore >= 50
        );
      });
      return { req, count: verified.length };
    })
    .filter((item) => item.count < 2);

  const singleOwner = t.accounts.filter((account) => account.primaryOwnerId && !account.secondaryOwnerId && account.status !== "inactive");

  return [
    {
      question: "Where are our biggest capability gaps?",
      answer: `${thin.length} open requirement${thin.length === 1 ? "" : "s"} currently have fewer than 2 verified available matches. ${
        thin[0] ? `Example: ${thin[0].req.title}.` : "No thin-coverage requirements in the current sample."
      } Pulse only uses verified + available associates from the Tessiant CRM sample.`,
      links: [
        ...(thin[0] ? [{ label: thin[0].req.title, href: `/staffing/requirements/${thin[0].req.id}` }] : []),
        { label: "Network knowledge block", href: "/pulse/knowledge/network" },
        { label: "Open requirements", href: "/staffing/requirements?view=open" },
      ],
    },
    {
      question: "Which assignments are ending soon?",
      answer:
        ending.length === 0
          ? "No confirmed assignments end within 30 days in the Tessiant sample. Pulse will not invent renewal risk without end dates."
          : `${ending.length} assignment${ending.length === 1 ? "" : "s"} end within 30 days. Open Assignments to review renewal or redeployment.`,
      links: [
        { label: "Assignments ending soon", href: "/staffing/placements?view=ending30" },
        { label: "Augmentation knowledge block", href: "/pulse/knowledge/augmentation" },
      ],
    },
    {
      question: "Which sectors are generating the most demand?",
      answer:
        sectors.length === 0
          ? "No sector tags on open requirements in the current sample."
          : `Open demand concentrates in ${sectors.map(([label, value]) => `${label} (${value})`).join(", ")}. Counts come from requirement.sector only — not a market forecast.`,
      links: [
        { label: "Open requirements", href: "/staffing/requirements?view=open" },
        { label: "Capability knowledge block", href: "/pulse/knowledge/capability" },
      ],
    },
    {
      question: "Which requirements lack suitable available consultants?",
      answer:
        thin.length === 0
          ? "Every open requirement currently has at least 2 verified available matches in the sample."
          : thin
              .slice(0, 4)
              .map((item) => `${item.req.title} (${item.count} verified available)`)
              .join("; "),
      links: thin.slice(0, 3).map((item) => ({
        label: item.req.title,
        href: `/staffing/requirements/${item.req.id}`,
      })),
    },
    {
      question: "What commercial opportunities need attention?",
      answer: `${singleOwner.length} account${singleOwner.length === 1 ? "" : "s"} lack a secondary relationship owner${
        singleOwner[0] ? ` (including ${singleOwner[0].name})` : ""
      }. Realised placement day-rate context is £${realised.toLocaleString("en-GB")} — pipeline stays separate on Value.`,
      links: [
        ...(singleOwner[0] ? [{ label: singleOwner[0].name, href: `/sales/accounts/${singleOwner[0].id}` }] : []),
        { label: "Commercial knowledge block", href: "/pulse/knowledge/commercial" },
        { label: "Value dashboard", href: "/pulse/value" },
        { label: "Sales pipeline", href: "/sales/pipeline" },
      ],
    },
    {
      question: "Can Pulse forecast next quarter win rate?",
      answer: "Not supported in this demo. Tessiant Pulse answers only grounded, deterministic questions from CRM records. There is no predictive win-rate model.",
      links: [{ label: "Insights", href: "/pulse/insights" }],
    },
  ];
}
