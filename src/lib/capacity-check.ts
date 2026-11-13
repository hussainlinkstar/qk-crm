// Pre-sales capacity check: before a proposal goes out, can Tessiant actually staff the deal if it
// closes? Reads the linked requirement (or a preview built from the opportunity's services), the
// matcher's verified-available count, and who is projected on the bench by the close date.

import type { CrmState, Opportunity } from "./types";
import type { Associate, ClientRequirement } from "./tessiant-types";
import { isStaffingOpportunity, previewRequirement } from "./record-intelligence";
import { recommendedMatches } from "./requirement-recommendations";
import { benchDate } from "./bench-timeline";
import { addDays, formatDate, todayKey } from "./format";

export type CapacityStatus = "covered" | "thin" | "uncovered" | "advisory" | "n/a";

export interface CapacityCheck {
  status: CapacityStatus;
  label: string;
  headline: string;
  detail: string;
  next: string;
  verified: number;
  benchByStart: number;
  startBy: string;
  skills: string[];
  requirement: ClientRequirement | null;
  linked: boolean;
  names: Array<{ associate: Associate; band: string; availability: string }>;
}

const CHECK_STAGES = new Set(["Proposal", "Negotiation"]);

export function needsCapacityCheck(opportunity: Opportunity): boolean {
  return CHECK_STAGES.has(opportunity.stage);
}

const norm = (value: string) => value.trim().toLowerCase();

export function capacityCheck(state: CrmState, opportunity: Opportunity, today = todayKey()): CapacityCheck {
  const base: CapacityCheck = { status: "n/a", label: "No check", headline: "", detail: "", next: "", verified: 0, benchByStart: 0, startBy: opportunity.expectedCloseDate, skills: [], requirement: null, linked: false, names: [] };
  if (!state.tessiant) return base;
  if (!isStaffingOpportunity(opportunity.type)) {
    const sias = state.tessiant.associates.filter((item) => item.roleType === "SIA" && item.status === "active" && item.availability !== "unavailable");
    return { ...base, status: "advisory", label: `${sias.length} SIA${sias.length === 1 ? "" : "s"} available`, headline: "Advisory deal: SIA cover, not bench cover", detail: `${sias.length} active Senior Industry Advisors are not fully deployed.`, next: "Name the advisor in the proposal" };
  }
  const requirement = previewRequirement(state, opportunity);
  if (!requirement) return base;
  const linked = !requirement.id.startsWith("preview-");
  const recs = recommendedMatches(state, requirement, 3);
  // Start-by: the later of the brief's start date and the close date, with two weeks' onboarding.
  const startBy = [requirement.startDate, addDays(14, new Date(opportunity.expectedCloseDate))].sort().at(-1) ?? opportunity.expectedCloseDate;
  const wanted = requirement.mustHaveSkills.map(norm);
  const benchByStart = state.tessiant.associates.filter((associate) => {
    const date = benchDate(state, associate, today);
    return date && date <= startBy && associate.skills.some((skill) => wanted.includes(norm(skill)));
  }).length;
  const headcount = Math.max(requirement.headcount || 0, 1);
  const verified = recs.verifiedCount;
  const names = recs.items.map((item) => ({ associate: item.associate, band: item.presentation.suitabilityBand, availability: item.presentation.availabilityLabel }));
  const skills = requirement.mustHaveSkills.slice(0, 3);

  const status: CapacityStatus = verified >= headcount ? "covered" : verified > 0 || benchByStart >= headcount ? "thin" : "uncovered";
  const label = status === "covered" ? `Staffable · ${verified} verified` : status === "thin" ? `Thin cover · ${verified} verified, ${benchByStart} on bench` : `Uncovered · 0 verified`;
  const headline =
    status === "covered"
      ? `We can staff this if it closes: ${verified} verified available for ${headcount} seat${headcount === 1 ? "" : "s"}`
      : status === "thin"
        ? `Thin cover: ${verified} verified now, ${benchByStart} with the skills free by ${formatDate(startBy)}`
        : `Nobody verified available for ${skills.join(", ") || "this brief"} by ${formatDate(startBy)}`;
  const detail = `${headcount} seat${headcount === 1 ? "" : "s"} · ${skills.join(", ") || "skills not recorded"} · start by ${formatDate(startBy)}${linked ? " · linked requirement" : " · from the opportunity's services, no requirement yet"}`;
  const next = status === "covered" ? "Name the people in the proposal" : status === "thin" ? "Confirm availability with the bench before pricing" : linked ? "Run the sourcing sweep before the proposal goes out" : "Open the requirement so sourcing starts before the deal closes";
  return { status, label, headline, detail, next, verified, benchByStart, startBy, skills, requirement, linked, names };
}
