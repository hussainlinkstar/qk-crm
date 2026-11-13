// Network mix: the headline shares the client asked for, computed from the recorded sample only.
// "4% of SIAs bring in additional revenue · 26% of associates work in retail · 5% experienced in
// Government" is the shape; the numbers come from the seed, never from assumptions.

import type { CrmState } from "./types";

export interface NetworkShare {
  key: string;
  label: string;
  count: number;
  of: number;
  pct: number;
  note: string;
}

export interface OfferingCoverageRow {
  offering: string;
  associates: number;
  accountsInterested: number;
  accountsPurchased: number;
}

export interface NetworkMixStats {
  sampleSize: number;
  networkTotal: number;
  shares: NetworkShare[];
  sectors: Array<{ sector: string; count: number; pct: number }>;
  offerings: OfferingCoverageRow[];
}

function pct(count: number, of: number) {
  return of > 0 ? Math.round((count / of) * 100) : 0;
}

export function networkMixStats(state: CrmState): NetworkMixStats {
  const t = state.tessiant;
  const associates = (t?.associates ?? []).filter((item) => item.status !== "inactive");
  const sampleSize = associates.length;
  const networkTotal = t?.networkStats.totalMembers ?? 0;

  // SIAs with recorded commercial contribution: a confirmed/closed placement, or a candidate record
  // that reached offer or placed on a requirement.
  const sias = associates.filter((item) => item.roleType === "SIA" || item.roleType === "executive_advisor");
  const siaIds = new Set(sias.map((item) => item.id));
  const contributing = new Set<string>();
  for (const placement of t?.placements ?? []) {
    if (siaIds.has(placement.associateId) && (placement.status === "confirmed" || placement.status === "closed")) contributing.add(placement.associateId);
  }
  for (const candidate of t?.candidates ?? []) {
    if (siaIds.has(candidate.associateId) && (candidate.shortlistStatus === "offer" || candidate.shortlistStatus === "placed")) contributing.add(candidate.associateId);
  }

  const sectorCounts = new Map<string, number>();
  for (const associate of associates) {
    for (const sector of new Set(associate.sectors)) sectorCounts.set(sector, (sectorCounts.get(sector) ?? 0) + 1);
  }
  const sectors = [...sectorCounts.entries()]
    .map(([sector, count]) => ({ sector, count, pct: pct(count, sampleSize) }))
    .sort((a, b) => b.count - a.count || a.sector.localeCompare(b.sector));
  const retail = sectors.find((row) => /retail/i.test(row.sector));
  const government = associates.filter((item) => item.sectors.some((sector) => /public|government/i.test(sector))).length;

  const shares: NetworkShare[] = [
    {
      key: "sia",
      label: "of SIAs bring in additional revenue",
      count: contributing.size,
      of: sias.length,
      pct: pct(contributing.size, sias.length),
      note: `${contributing.size} of ${sias.length} Senior Industry Advisors with a recorded placement, offer or commercial progression`,
    },
    {
      key: "retail",
      label: "of associates work in retail",
      count: retail?.count ?? 0,
      of: sampleSize,
      pct: retail?.pct ?? 0,
      note: `${retail?.count ?? 0} of ${sampleSize} sampled associates with Retail on their recorded sectors`,
    },
    {
      key: "government",
      label: "are experienced in Government",
      count: government,
      of: sampleSize,
      pct: pct(government, sampleSize),
      note: `${government} of ${sampleSize} with public-sector experience recorded. The base for a public-sector growth decision.`,
    },
  ];

  // Offerings: what the pool can deliver against what clients have asked for or bought.
  const offeringMap = new Map<string, OfferingCoverageRow>();
  const row = (offering: string) => {
    const existing = offeringMap.get(offering);
    if (existing) return existing;
    const created = { offering, associates: 0, accountsInterested: 0, accountsPurchased: 0 };
    offeringMap.set(offering, created);
    return created;
  };
  for (const associate of associates) for (const offering of new Set(associate.offerings)) row(offering).associates += 1;
  for (const account of t?.accounts ?? []) {
    for (const offering of new Set(account.offeringInterests ?? [])) row(offering).accountsInterested += 1;
    for (const offering of new Set(account.servicesPurchased ?? [])) row(offering).accountsPurchased += 1;
  }
  const offerings = [...offeringMap.values()].sort(
    (a, b) => b.accountsInterested + b.accountsPurchased - (a.accountsInterested + a.accountsPurchased) || b.associates - a.associates,
  );

  return { sampleSize, networkTotal, shares, sectors, offerings };
}
