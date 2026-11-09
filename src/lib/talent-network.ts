// Talent Network helpers — directory filters, engagement status, saved views.

import type { CrmState } from "./types";
import {
  ASSOCIATE_ROLE_LABELS,
  type Associate,
  type AssociateRoleType,
  type AvailabilityStatus,
  type Placement,
  type SeniorityLevel,
  type TalentEngagementStatus,
} from "./tessiant-types";
import { addDays, todayKey } from "./format";

export const TALENT_PAGE_SIZE = 12;

export type TalentSavedView = "all" | "available_now" | "currently_deployed" | "sias" | "retail_specialists" | "needs_update";

export const TALENT_SAVED_VIEWS: { id: TalentSavedView; label: string; description: string }[] = [
  { id: "all", label: "All talent", description: "Full sample directory" },
  { id: "available_now", label: "Available now", description: "Verified and available" },
  { id: "currently_deployed", label: "Currently deployed", description: "On active client assignment" },
  { id: "sias", label: "SIAs & advisors", description: "SIA and executive advisors" },
  { id: "retail_specialists", label: "Retail specialists", description: "Retail sector experience" },
  { id: "needs_update", label: "Profiles requiring updates", description: "Stale, unverified or missing CV" },
];

export function roleLabel(roleType: AssociateRoleType) {
  return ASSOCIATE_ROLE_LABELS[roleType] ?? roleType;
}

export function roleFamilies(roleType: AssociateRoleType | "any"): AssociateRoleType[] {
  if (roleType === "any") return [...Object.keys(ASSOCIATE_ROLE_LABELS) as AssociateRoleType[]];
  if (roleType === "consultant" || roleType === "programme_manager") return ["consultant", "programme_manager"];
  if (roleType === "SIA" || roleType === "executive_advisor") return ["SIA", "executive_advisor"];
  return [roleType];
}

export function rolesMatch(associateRole: AssociateRoleType, requirementRole: AssociateRoleType | "any") {
  if (requirementRole === "any") return true;
  return roleFamilies(requirementRole).includes(associateRole);
}

export function activePlacementForAssociate(state: CrmState, associateId: string): Placement | null {
  const placements = state.tessiant?.placements ?? [];
  return (
    placements.find(
      (placement) =>
        placement.associateId === associateId &&
        placement.status === "confirmed" &&
        (placement.outcome === "open" || placement.outcome == null),
    ) ?? null
  );
}

export function engagementStatus(state: CrmState, associate: Associate): TalentEngagementStatus {
  if (associate.status === "inactive") return "inactive";
  if (activePlacementForAssociate(state, associate.id)) return "deployed";
  if (associate.availability === "available") return "available";
  if (associate.availability === "limited") return "limited";
  return "unavailable";
}

export function currentAssignmentLabel(state: CrmState, associate: Associate) {
  const placement = activePlacementForAssociate(state, associate.id);
  if (!placement) return null;
  const req = state.tessiant?.requirements.find((item) => item.id === placement.requirementId);
  const account = req ? state.tessiant?.accounts.find((item) => item.id === req.accountId) : undefined;
  return {
    placementId: placement.id,
    client: account?.name ?? "Client",
    role: req?.title ?? "Assignment",
    startDate: placement.terms.startDate,
    endDate: placement.terms.endDate,
    requirementId: placement.requirementId,
  };
}

export function latestCv(associate: Associate) {
  const docs = [...(associate.documents ?? [])].filter((doc) => doc.kind === "cv").sort((a, b) => b.version - a.version || b.uploadedAt.localeCompare(a.uploadedAt));
  return docs[0] ?? (associate.cvRef ? { id: "legacy", kind: "cv" as const, name: "CV", ref: associate.cvRef, uploadedAt: associate.profileUpdatedAt ?? associate.verifiedAt ?? "", verifiedAt: associate.verifiedAt, version: 1 } : null);
}

export function needsProfileUpdate(associate: Associate, today = todayKey()) {
  if (!associate.verifiedAt) return true;
  if (!latestCv(associate)?.verifiedAt) return true;
  const updated = associate.profileUpdatedAt;
  if (!updated) return true;
  return updated.slice(0, 10) < addDays(-90, new Date(`${today}T00:00:00`));
}

export interface TalentFilters {
  q: string;
  skill: string;
  sector: string;
  seniority: SeniorityLevel | "";
  roleType: AssociateRoleType | "";
  location: string;
  availability: AvailabilityStatus | "";
  engagement: TalentEngagementStatus | "";
  view: TalentSavedView;
}

export function filterTalentNetwork(state: CrmState, filters: TalentFilters) {
  const associates = state.tessiant?.associates ?? [];
  const query = filters.q.trim().toLowerCase();

  return associates
    .filter((associate) => {
      const engagement = engagementStatus(state, associate);
      const assignment = currentAssignmentLabel(state, associate);

      if (filters.view === "available_now") {
        if (!(associate.availability === "available" && associate.verifiedAt && associate.status === "active")) return false;
      } else if (filters.view === "currently_deployed") {
        if (engagement !== "deployed") return false;
      } else if (filters.view === "sias") {
        if (associate.roleType !== "SIA" && associate.roleType !== "executive_advisor") return false;
      } else if (filters.view === "retail_specialists") {
        const retailSector = associate.sectors.some((sector) => /retail/i.test(sector));
        const retailSkill = associate.skills.some((skill) => /retail/i.test(skill)) || associate.tags.some((tag) => /retail/i.test(tag));
        if (!retailSector && !retailSkill) return false;
      } else if (filters.view === "needs_update") {
        if (!needsProfileUpdate(associate)) return false;
      }

      if (filters.roleType && associate.roleType !== filters.roleType) return false;
      if (filters.availability && associate.availability !== filters.availability) return false;
      if (filters.seniority && associate.seniority !== filters.seniority) return false;
      if (filters.sector && !associate.sectors.some((sector) => sector.toLowerCase() === filters.sector.toLowerCase())) return false;
      if (filters.skill && !associate.skills.some((skill) => skill.toLowerCase() === filters.skill.toLowerCase()) && !(associate.specialisations ?? []).some((item) => item.toLowerCase() === filters.skill.toLowerCase())) {
        return false;
      }
      if (filters.location && !associate.location.toLowerCase().includes(filters.location.toLowerCase())) return false;
      if (filters.engagement && engagement !== filters.engagement) return false;

      if (!query) return true;
      const hay = [
        associate.name,
        associate.headline,
        associate.summary ?? "",
        roleLabel(associate.roleType),
        ...associate.skills,
        ...(associate.specialisations ?? []),
        ...associate.sectors,
        ...(associate.experience ?? []).flatMap((item) => [item.title, item.organisation, item.summary]),
        assignment?.client ?? "",
        assignment?.role ?? "",
        ...associate.tags,
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(query);
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function paginateTalent<T>(items: T[], page: number, pageSize = TALENT_PAGE_SIZE) {
  const total = items.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), pageCount);
  const start = (safePage - 1) * pageSize;
  return {
    page: safePage,
    pageCount,
    total,
    slice: items.slice(start, start + pageSize),
  };
}

/** Skills list with duplicates removed (case insensitive). */
export function uniqueSkillLabels(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of values) {
    const value = raw.trim();
    if (!value) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(value);
  }
  return out;
}

/** Specialisations that are not already listed as skills. */
export function specialisationsBeyondSkills(skills: string[], specialisations: string[] | undefined): string[] {
  const skillKeys = new Set(skills.map((item) => item.toLowerCase()));
  return uniqueSkillLabels(specialisations ?? []).filter((item) => !skillKeys.has(item.toLowerCase()));
}

/** Fill missing talent-profile fields for legacy/demo records. */
export function ensureTalentProfile(associate: Associate, nowIso = new Date().toISOString()): Associate {
  const profileUpdatedAt = associate.profileUpdatedAt ?? associate.verifiedAt ?? nowIso;
  const skills = uniqueSkillLabels(associate.skills);
  const documents =
    associate.documents ??
    (associate.cvRef
      ? [
          {
            id: `doc_${associate.id}_cv1`,
            kind: "cv" as const,
            name: `${associate.name} CV`,
            ref: associate.cvRef,
            uploadedAt: profileUpdatedAt,
            verifiedAt: associate.verifiedAt,
            version: 1,
          },
        ]
      : []);
  const experience =
    associate.experience ??
    associate.sectors.slice(0, 2).map((sector, index) => ({
      id: `exp_${associate.id}_${index}`,
      title: associate.headline.split("·")[0]?.trim() || associate.headline,
      organisation: `${sector} engagement`,
      sector,
      startDate: "2021-01",
      endDate: index === 0 ? null : "2023-06",
      summary: `Experience in ${sector} aligned to ${skills.slice(0, 2).join(", ") || "core skills"}.`,
    }));
  const defaultSpecialisations = specialisationsBeyondSkills(skills, associate.specialisations ?? skills.slice(0, 3));
  return {
    ...associate,
    skills,
    summary:
      associate.summary ??
      `${associate.name} is a ${roleLabel(associate.roleType).toLowerCase()} with ${associate.seniority} seniority across ${associate.sectors.join(", ") || "multiple sectors"}.`,
    specialisations: defaultSpecialisations,
    email: associate.email ?? `demo.${associate.id.replace(/^as_/, "")}@tessiant-network.example`,
    phone: associate.phone ?? null,
    profileUpdatedAt,
    documents,
    experience,
    activityNotes: associate.activityNotes ?? [
      {
        id: `an_${associate.id}_1`,
        body: associate.notes || "Profile seeded for workspace sample.",
        authorId: associate.ownerId ?? "me",
        createdAt: profileUpdatedAt,
        kind: "note" as const,
      },
    ],
    agreedRate: associate.agreedRate ?? null,
    contractNotes: associate.contractNotes ?? "Day rate contractor terms. Payroll integrations are configured separately.",
  };
}
