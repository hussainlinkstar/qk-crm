import type { CrmState } from "./types";

export interface SectorBalance {
  sector: string;
  demandRequirements: number;
  demandHeadcount: number;
  associatesInSector: number;
  verifiedAvailable: number;
  /** Verified available ÷ open requirement headcount in this sector. */
  coveragePct: number;
  gapHeadcount: number;
  skills: string[];
  seniority: string;
  requirementIds: string[];
}

function norm(value: string) {
  return value.trim().toLowerCase();
}

/** Open requirements by sector versus associates who list that sector. */
export function talentSupplyVsDemand(state: CrmState): SectorBalance[] {
  const tessiant = state.tessiant;
  if (!tessiant) return [];

  const open = tessiant.requirements.filter((req) => !req.archived && req.outcome === "active" && req.stage !== "Placed" && req.sector.trim());
  const bySector = new Map<string, typeof open>();
  for (const req of open) {
    const key = norm(req.sector);
    const list = bySector.get(key) ?? [];
    list.push(req);
    bySector.set(key, list);
  }

  const rows: SectorBalance[] = [];
  for (const [key, reqs] of bySector) {
    const sector = reqs[0]?.sector ?? key;
    const demandHeadcount = reqs.reduce((sum, req) => sum + Math.max(req.headcount || 0, 1), 0);
    const inSector = tessiant.associates.filter(
      (associate) => associate.status === "active" && associate.sectors.some((item) => norm(item) === key),
    );
    const verifiedAvailable = inSector.filter(
      (associate) => associate.availability === "available" && Boolean(associate.verifiedAt),
    ).length;
    const skillCounts = new Map<string, number>();
    const seniorityCounts = new Map<string, number>();
    for (const req of reqs) {
      seniorityCounts.set(req.seniority, (seniorityCounts.get(req.seniority) ?? 0) + 1);
      for (const skill of [...req.mustHaveSkills, ...req.preferredSkills]) {
        skillCounts.set(skill, (skillCounts.get(skill) ?? 0) + 1);
      }
    }
    const skills = [...skillCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([skill]) => skill);
    const seniority = [...seniorityCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "mixed";
    rows.push({
      sector,
      demandRequirements: reqs.length,
      demandHeadcount,
      associatesInSector: inSector.length,
      verifiedAvailable,
      coveragePct: demandHeadcount === 0 ? 0 : Math.round((verifiedAvailable / demandHeadcount) * 100),
      gapHeadcount: demandHeadcount - verifiedAvailable,
      skills,
      seniority,
      requirementIds: reqs.map((req) => req.id),
    });
  }

  return rows.sort((a, b) => b.gapHeadcount - a.gapHeadcount || b.demandHeadcount - a.demandHeadcount);
}
