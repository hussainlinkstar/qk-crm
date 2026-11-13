// Availability confidence: how much to trust an associate's recorded availability right now, from
// how recently it was confirmed, whether the record is internally consistent, and whether an
// assignment backs it up. The confirm queue ranks who to ask first: low confidence on people an
// open brief actually needs.

import type { CrmState } from "./types";
import type { Associate, AvailabilityStatus } from "./tessiant-types";
import { liveAssignments } from "./assignments";
import { crm } from "./crm-store";
import { addDays, formatDate, todayKey } from "./format";

export type ConfidenceBand = "high" | "medium" | "low";

export interface AvailabilityConfidence {
  score: number;
  band: ConfidenceBand;
  label: string;
  lastConfirmedAt: string | null;
  daysSince: number | null;
  reasons: Array<{ text: string; kind: "fact" | "inference" }>;
}

export function lastAvailabilityConfirmation(associate: Associate): string | null {
  const note = (associate.activityNotes ?? []).filter((item) => item.kind === "availability").sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  return note?.createdAt ?? associate.profileUpdatedAt ?? null;
}

export function availabilityConfidence(state: CrmState, associate: Associate, today = todayKey()): AvailabilityConfidence {
  const reasons: AvailabilityConfidence["reasons"] = [];
  let score = 0;
  const lastConfirmedAt = lastAvailabilityConfirmation(associate);
  const daysSince = lastConfirmedAt ? Math.max(0, Math.floor((new Date(`${today}T00:00:00`).getTime() - new Date(lastConfirmedAt).getTime()) / 86_400_000)) : null;
  const confirmedByNote = (associate.activityNotes ?? []).some((item) => item.kind === "availability");

  if (associate.availability === "unknown") {
    reasons.push({ text: "Availability is recorded as unknown", kind: "fact" });
  } else {
    score += 20;
  }

  if (daysSince === null) {
    reasons.push({ text: "Never confirmed", kind: "fact" });
  } else if (daysSince <= 14) {
    score += 45;
    reasons.push({ text: `Confirmed ${daysSince === 0 ? "today" : `${daysSince} days ago`}${confirmedByNote ? " by the associate or the team" : " (profile update)"}`, kind: "fact" });
  } else if (daysSince <= 45) {
    score += 30;
    reasons.push({ text: `Last confirmed ${daysSince} days ago`, kind: "fact" });
  } else if (daysSince <= 90) {
    score += 12;
    reasons.push({ text: `Last confirmed ${daysSince} days ago, going stale`, kind: "fact" });
  } else {
    reasons.push({ text: `Not confirmed for ${daysSince} days`, kind: "fact" });
  }

  const live = liveAssignments(state, today).filter((item) => item.associateId === associate.id);
  if (live.length > 0 && associate.availability === "available") {
    score -= 15;
    reasons.push({ text: "Listed available while on a live assignment", kind: "inference" });
  } else if (live.length > 0) {
    score += 15;
    reasons.push({ text: "Consistent with a live assignment on record", kind: "fact" });
  }

  if (associate.nextAvailableDate) {
    if (associate.nextAvailableDate < today && associate.availability !== "available") {
      score -= 10;
      reasons.push({ text: `Next-available date ${formatDate(associate.nextAvailableDate)} has passed`, kind: "fact" });
    } else if (associate.nextAvailableDate >= today) {
      score += 10;
      reasons.push({ text: `Next available ${formatDate(associate.nextAvailableDate)}`, kind: "fact" });
    }
  }

  if (associate.verifiedAt) score += 10;
  score = Math.max(0, Math.min(100, score));
  const band: ConfidenceBand = score >= 70 ? "high" : score >= 40 ? "medium" : "low";
  const label = band === "high" ? "Confirmed" : band === "medium" ? "Probably right" : "Needs confirming";
  return { score, band, label, lastConfirmedAt, daysSince, reasons };
}

export interface ConfirmQueueItem {
  associate: Associate;
  confidence: AvailabilityConfidence;
  /** Why it matters now: the open brief this person is shortlisted on or matches. */
  needed: string | null;
  requirementId: string | null;
  priority: number;
}

export function confirmQueue(state: CrmState, limit = 6, today = todayKey()): ConfirmQueueItem[] {
  const t = state.tessiant;
  if (!t) return [];
  const open = t.requirements.filter((req) => !req.archived && req.outcome === "active" && req.stage !== "Placed");
  const norm = (value: string) => value.trim().toLowerCase();
  return t.associates
    .filter((associate) => associate.status === "active")
    .map((associate) => {
      const confidence = availabilityConfidence(state, associate, today);
      const shortlisted = t.candidates.find((candidate) => candidate.associateId === associate.id && open.some((req) => req.id === candidate.requirementId));
      const shortlistReq = shortlisted ? open.find((req) => req.id === shortlisted.requirementId) ?? null : null;
      const skillReq = shortlistReq ?? open.find((req) => req.mustHaveSkills.some((skill) => associate.skills.map(norm).includes(norm(skill)))) ?? null;
      const needed = shortlistReq ? `Shortlisted for ${shortlistReq.title}` : skillReq ? `Skills match ${skillReq.title}` : null;
      const priority = (100 - confidence.score) + (shortlistReq ? 60 : skillReq ? 30 : 0) + (associate.verifiedAt ? 5 : 0);
      return { associate, confidence, needed, requirementId: skillReq?.id ?? null, priority };
    })
    .filter((item) => item.confidence.band !== "high")
    .sort((a, b) => b.priority - a.priority)
    .slice(0, limit);
}

/** Record a confirmation: updates the status and dates and leaves an availability note so confidence resets. */
export function recordAvailabilityConfirmation(associateId: string, availability: AvailabilityStatus, nextAvailableDate: string | null, via: "team" | "link") {
  crm.updateAssociate(associateId, { availability, nextAvailableDate: availability === "available" ? null : nextAvailableDate });
  const when = availability === "available" ? "available now" : nextAvailableDate ? `${availability}, next available ${formatDate(nextAvailableDate)}` : availability;
  crm.addAssociateNote(associateId, via === "link" ? `Availability confirmed by the associate via confirm link: ${when}.` : `Availability confirmed by the team: ${when}.`, "availability");
}

export function confirmLinkFor(associateId: string): string {
  return `/confirm/${associateId}`;
}

export function defaultNextAvailable(): string {
  return addDays(14);
}
