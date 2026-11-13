// Deal → requirement → placement: the one chain that couples Qiko Core (sales) with the staffing
// product. Resolved read-only from existing links: Opportunity.id ↔ ClientRequirement.linkedOpportunityId
// ↔ Placement.requirementId. Nothing here invents a link that is not recorded.

import type { CrmState, Opportunity } from "./types";
import type { ClientRequirement, Placement } from "./tessiant-types";
import { deriveAssignmentStatus } from "./assignments";
import { mapRequirementToOpsStage, verifiedAvailableMatchCount } from "./tessiant-insights";
import { formatDate, todayKey } from "./format";

export type JourneyStage = "deal" | "requirement" | "placement" | "delivered";

export interface JourneyNode {
  title: string;
  meta: string;
  href: string;
}

export interface DealJourney {
  key: string;
  accountId: string;
  accountName: string;
  stage: JourneyStage;
  opportunity: Opportunity | null;
  requirement: ClientRequirement | null;
  placement: Placement | null;
  deal: JourneyNode | null;
  req: JourneyNode | null;
  place: JourneyNode | null;
  /** The next move along the chain, or null when delivered. */
  next: { label: string; href: string } | null;
  /** True while something on the chain is still open. */
  inFlight: boolean;
}

function money(value: number) {
  return `£${value.toLocaleString("en-GB")}`;
}

function build(
  state: CrmState,
  opportunity: Opportunity | null,
  requirement: ClientRequirement | null,
  placement: Placement | null,
): DealJourney | null {
  const t = state.tessiant;
  const accountId = opportunity?.accountId ?? requirement?.accountId ?? placement?.accountId ?? null;
  if (!accountId) return null;
  const accountName = t?.accounts.find((item) => item.id === accountId)?.name ?? "Account";
  const today = todayKey();
  const associate = placement ? t?.associates.find((item) => item.id === placement.associateId) : null;
  const assignmentStatus = placement ? deriveAssignmentStatus(placement, today) : null;
  const delivered = Boolean(placement && (placement.status === "closed" || assignmentStatus === "completed"));

  const stage: JourneyStage = delivered ? "delivered" : placement ? "placement" : requirement ? "requirement" : "deal";

  const deal: JourneyNode | null = opportunity
    ? {
        title: opportunity.name,
        meta: `${opportunity.stage} · ${money(opportunity.amount)}${opportunity.stage === "Closed Won" && opportunity.agreedContractValue ? ` agreed` : ""}`,
        href: `/sales/pipeline?opportunity=${opportunity.id}`,
      }
    : null;
  const req: JourneyNode | null = requirement
    ? {
        title: requirement.title,
        meta:
          requirement.stage === "Placed"
            ? "Placed"
            : `${mapRequirementToOpsStage(requirement)} · ${verifiedAvailableMatchCount(state, requirement.id)} verified available`,
        href: `/staffing/requirements/${requirement.id}`,
      }
    : null;
  const place: JourneyNode | null = placement
    ? {
        title: associate?.name ?? "Associate",
        meta: `${delivered ? "Delivered" : assignmentStatus ? assignmentStatus.replace("_", " ") : "Confirmed"} · ${
          placement.terms.startDate ? formatDate(placement.terms.startDate) : "—"
        } → ${placement.terms.endDate ? formatDate(placement.terms.endDate) : "open"}`,
        href: `/staffing/placements/${placement.id}`,
      }
    : null;

  let next: DealJourney["next"] = null;
  if (!placement && requirement && requirement.stage !== "Placed") {
    next = { label: "Confirm a placement", href: `/staffing/requirements/${requirement.id}` };
  } else if (!requirement && opportunity) {
    next =
      opportunity.stage === "Closed Won"
        ? { label: "Create the staffing requirement", href: `/sales/pipeline?opportunity=${opportunity.id}` }
        : opportunity.stage === "Closed Lost"
          ? null
          : { label: "Win the deal", href: `/sales/pipeline?opportunity=${opportunity.id}` };
  } else if (placement && !delivered) {
    next = { label: "Track the assignment", href: `/staffing/placements/${placement.id}` };
  }

  const inFlight = !delivered && !(opportunity?.stage === "Closed Lost");

  return {
    key: opportunity?.id ?? requirement?.id ?? placement?.id ?? accountId,
    accountId,
    accountName,
    stage,
    opportunity,
    requirement,
    placement,
    deal,
    req,
    place,
    next,
    inFlight,
  };
}

function placementFor(state: CrmState, requirementId: string | null | undefined): Placement | null {
  if (!requirementId) return null;
  const rows = (state.tessiant?.placements ?? []).filter((item) => item.requirementId === requirementId && item.status !== "draft");
  // Prefer a live one, then the most recent.
  const today = todayKey();
  const live = rows.find((item) => {
    const status = deriveAssignmentStatus(item, today);
    return status === "active" || status === "extended" || status === "upcoming";
  });
  return live ?? [...rows].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null;
}

export function dealJourneyFor(
  state: CrmState,
  scope: { opportunityId?: string | null; requirementId?: string | null; assignmentId?: string | null },
): DealJourney | null {
  const t = state.tessiant;
  let placement: Placement | null = scope.assignmentId ? t?.placements.find((item) => item.id === scope.assignmentId) ?? null : null;
  let requirement: ClientRequirement | null = scope.requirementId
    ? t?.requirements.find((item) => item.id === scope.requirementId) ?? null
    : placement
      ? t?.requirements.find((item) => item.id === placement?.requirementId) ?? null
      : null;
  let opportunity: Opportunity | null = scope.opportunityId
    ? (state.opportunities ?? []).find((item) => item.id === scope.opportunityId) ?? null
    : requirement?.linkedOpportunityId
      ? (state.opportunities ?? []).find((item) => item.id === requirement?.linkedOpportunityId) ?? null
      : null;
  if (!requirement && opportunity) {
    requirement = t?.requirements.find((item) => item.linkedOpportunityId === opportunity?.id) ?? null;
  }
  if (!opportunity && requirement?.linkedOpportunityId) {
    opportunity = (state.opportunities ?? []).find((item) => item.id === requirement?.linkedOpportunityId) ?? null;
  }
  if (!placement) placement = placementFor(state, requirement?.id);
  if (!opportunity && !requirement && !placement) return null;
  return build(state, opportunity, requirement, placement);
}

/** Every chain that starts from an opportunity, in-flight first, most valuable first. */
export function dealJourneys(state: CrmState): DealJourney[] {
  const rows: DealJourney[] = [];
  for (const opportunity of state.opportunities ?? []) {
    const journey = dealJourneyFor(state, { opportunityId: opportunity.id });
    if (journey) rows.push(journey);
  }
  // Requirements with no opportunity still belong on the staffing side of the chain.
  for (const requirement of state.tessiant?.requirements ?? []) {
    if (requirement.archived || requirement.linkedOpportunityId) continue;
    const journey = dealJourneyFor(state, { requirementId: requirement.id });
    if (journey) rows.push(journey);
  }
  const rank: Record<JourneyStage, number> = { requirement: 0, placement: 1, deal: 2, delivered: 3 };
  return rows.sort(
    (a, b) =>
      Number(b.inFlight) - Number(a.inFlight) || rank[a.stage] - rank[b.stage] || (b.opportunity?.amount ?? 0) - (a.opportunity?.amount ?? 0),
  );
}
