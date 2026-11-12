"use client";

import Link from "next/link";
import Select from "@/components/ui/Select";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import Button from "@/components/ui/Button";
import Icon from "@/components/ui/Icon";
import { Drawer } from "@/components/ui/Overlay";
import { EmptyState, useWorkspaceData } from "@/components/ui/bits";
import { useWorkspace } from "@/components/shell/WorkspaceContext";
import { crm } from "@/lib/crm-store";
import { associateCommittedCapacity } from "@/lib/assignments";
import { formatDate, initials, timeAgo } from "@/lib/format";
import { formatRate } from "@/lib/tessiant-insights";
import {
  currentAssignmentLabel,
  engagementStatus,
  ensureTalentProfile,
  latestCv,
  roleLabel,
  specialisationsBeyondSkills,
} from "@/lib/talent-network";
import { shortlistLabel } from "@/lib/tessiant-matching";
import { AVAILABILITY_STATUSES, type AvailabilityStatus } from "@/lib/tessiant-types";
import styles from "@/components/leads/Leads.module.css";

export default function AssociateQuickPanel({
  associateId,
  onClose,
  showRates = true,
}: {
  associateId: string;
  onClose: () => void;
  showRates?: boolean;
}) {
  const router = useRouter();
  const { state } = useWorkspaceData();
  const { toast } = useWorkspace();
  const tessiant = state?.tessiant;
  const raw = tessiant?.associates.find((item) => item.id === associateId);
  const [shortlistReqId, setShortlistReqId] = useState("");

  const openRequirements = useMemo(() => {
    if (!tessiant) return [];
    return tessiant.requirements.filter((req) => !req.archived && req.outcome === "active" && req.stage !== "Placed");
  }, [tessiant]);

  if (!state || !tessiant || !raw) return null;

  const associate = ensureTalentProfile(raw);
  const assignment = currentAssignmentLabel(state, associate);
  const engagement = engagementStatus(state, associate);
  const capacity = associateCommittedCapacity(state, associate.id);
  const freeCapacity = Math.max(0, 100 - capacity);
  const cv = latestCv(associate);
  const extras = specialisationsBeyondSkills(associate.skills, associate.specialisations);
  const recentRecruitment = tessiant.candidates
    .filter((item) => item.associateId === associate.id)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 4);
  const recentEvents = (state.events ?? [])
    .filter(
      (event) =>
        event.title.toLowerCase().includes(associate.name.toLowerCase()) ||
        (event.detail ?? "").toLowerCase().includes(associate.name.toLowerCase()),
    )
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
    .slice(0, 4);

  const shortlist = () => {
    if (!shortlistReqId) {
      toast("Select an open requirement", "error");
      return;
    }
    const existing = tessiant.candidates.find(
      (item) => item.requirementId === shortlistReqId && item.associateId === associate.id,
    );
    if (existing) {
      crm.setCandidateStatus(existing.id, "shortlisted");
    } else {
      crm.recordExternalCandidate(shortlistReqId, associate.id);
    }
    toast("Added to shortlist", "success");
    onClose();
    router.push(`/staffing/requirements/${shortlistReqId}`);
  };

  return (
    <Drawer
      kicker="Associate"
      title={
        <span className={styles.panelTitle}>
          <span className="avatar">{initials(associate.name)}</span>
          <span>
            {associate.name}
            <small>
              {roleLabel(associate.roleType)} · {associate.seniority}
            </small>
          </span>
        </span>
      }
      onClose={onClose}
      width={540}
      footer={
        <Link href={`/staffing/associates/${associate.id}`} className={styles.fullProfile} onClick={onClose}>
          Open full profile <Icon name="arrowRight" size={14} />
        </Link>
      }
    >
      <div className={styles.panelMeta}>
        <span className="chip chip-dot">{associate.availability}</span>
        <span className="chip">{engagement}</span>
        <span className="chip tabular">{freeCapacity}% free</span>
        <span className="chip">{associate.verifiedAt ? "Verified" : "Unverified"}</span>
      </div>

      <p className="muted" style={{ marginTop: 12 }}>
        {associate.headline || associate.notes || "No profile summary yet."}
      </p>

      <div className={styles.quickActions}>
        <Link href={`/staffing/associates/${associate.id}`} onClick={onClose}>
          <Button size="small">Full profile</Button>
        </Link>
        {assignment ? (
          <Link href={`/staffing/placements/${assignment.placementId}`} onClick={onClose}>
            <Button size="small" variant="soft">
              Current assignment
            </Button>
          </Link>
        ) : null}
      </div>

      <dl className={styles.facts}>
        <div>
          <dt>Availability</dt>
          <dd>
            <Select
              className="input"
              value={associate.availability}
              aria-label="Update availability"
              onChange={(event) => {
                const availability = event.target.value as AvailabilityStatus;
                crm.updateAssociate(associate.id, { availability });
                toast(`Availability → ${availability}`, "success");
              }}
            >
              {AVAILABILITY_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </Select>
            {associate.nextAvailableDate ? (
              <span className="muted" style={{ display: "block", marginTop: 6 }}>
                From {formatDate(associate.nextAvailableDate)}
              </span>
            ) : null}
          </dd>
        </div>
        <div>
          <dt>Assignment</dt>
          <dd>{assignment ? `${assignment.client} · ${assignment.role}` : "Bench"}</dd>
        </div>
        <div>
          <dt>Location</dt>
          <dd>
            {associate.location} · {associate.workingMode}
          </dd>
        </div>
        <div>
          <dt>Day rate</dt>
          <dd className="tabular">{showRates ? formatRate(associate.rate) : "Restricted"}</dd>
        </div>
      </dl>

      <h3 className={`kicker ${styles.panelSection}`}>Skills & experience</h3>
      <div className={styles.stack} style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
        {associate.skills.slice(0, 10).map((skill) => (
          <span key={skill} className="chip">
            {skill}
          </span>
        ))}
        {extras.slice(0, 4).map((item) => (
          <span key={item} className="chip chip-ai">
            {item}
          </span>
        ))}
      </div>
      <p className="muted" style={{ marginTop: 8 }}>
        Sectors: {associate.sectors.join(", ") || "—"} · Prior placements {associate.priorPlacementCount}
      </p>

      <h3 className={`kicker ${styles.panelSection}`}>CV preview</h3>
      {cv ? (
        <div className={styles.facts} style={{ marginTop: 0 }}>
          <div>
            <dt>Document</dt>
            <dd>{cv.name}</dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd>{cv.verifiedAt ? `Verified ${formatDate(cv.verifiedAt)}` : "Needs review"}</dd>
          </div>
        </div>
      ) : (
        <EmptyState title="No CV on file" icon="file" />
      )}

      <h3 className={`kicker ${styles.panelSection}`}>Shortlist</h3>
      <div className={styles.quickActions}>
        <Select
          className="input"
          style={{ flex: 1, minWidth: 180 }}
          value={shortlistReqId}
          onChange={(event) => setShortlistReqId(event.target.value)}
          aria-label="Requirement for shortlist"
        >
          <option value="">Select open requirement…</option>
          {openRequirements.map((req) => {
            const account = tessiant.accounts.find((item) => item.id === req.accountId);
            return (
              <option key={req.id} value={req.id}>
                {req.title} · {account?.name ?? "Client"}
              </option>
            );
          })}
        </Select>
        <Button size="small" onClick={shortlist} disabled={!shortlistReqId}>
          Shortlist
        </Button>
      </div>

      <h3 className={`kicker ${styles.panelSection}`}>Recent activity</h3>
      {recentRecruitment.length === 0 && recentEvents.length === 0 ? (
        <EmptyState title="No recent activity" icon="users" />
      ) : (
        <ol className={styles.miniTimeline}>
          {recentRecruitment.map((candidate) => {
            const requirement = tessiant.requirements.find((item) => item.id === candidate.requirementId);
            return (
              <li key={candidate.id}>
                <span>
                  <b>
                    <Link href={`/staffing/requirements/${candidate.requirementId}`} onClick={onClose}>
                      {requirement?.title ?? "Requirement"}
                    </Link>
                  </b>
                  <small>
                    {shortlistLabel(candidate.shortlistStatus)} · score {candidate.matchScore}
                  </small>
                </span>
              </li>
            );
          })}
          {recentEvents.map((event) => (
            <li key={event.id}>
              <span>
                <b>{event.title}</b>
                <small>{timeAgo(event.occurredAt)}</small>
              </span>
            </li>
          ))}
        </ol>
      )}
    </Drawer>
  );
}
