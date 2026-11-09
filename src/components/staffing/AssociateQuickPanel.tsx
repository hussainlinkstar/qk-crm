"use client";

import Link from "next/link";
import Button from "@/components/ui/Button";
import Icon from "@/components/ui/Icon";
import { Drawer } from "@/components/ui/Overlay";
import { EmptyState, useWorkspaceData } from "@/components/ui/bits";
import { associateCommittedCapacity } from "@/lib/assignments";
import { formatDate, initials } from "@/lib/format";
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
  const { state } = useWorkspaceData();
  const tessiant = state?.tessiant;
  const raw = tessiant?.associates.find((item) => item.id === associateId);
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
      width={520}
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

      <div className={styles.quickActions}>
        <Link href={`/staffing/associates/${associate.id}`} onClick={onClose}>
          <Button size="small">View profile</Button>
        </Link>
        <Link href={`/staffing/requirements?layout=board`} onClick={onClose}>
          <Button size="small" variant="secondary">
            Open requirements
          </Button>
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
          <dt>Capacity</dt>
          <dd className="tabular">
            {capacity}% committed · {freeCapacity}% free
          </dd>
        </div>
        <div>
          <dt>Location</dt>
          <dd>
            {associate.location} · {associate.workingMode}
          </dd>
        </div>
        <div>
          <dt>Assignment</dt>
          <dd>{assignment ? `${assignment.client} · ${assignment.role}` : "Bench"}</dd>
        </div>
        <div>
          <dt>Day rate</dt>
          <dd className="tabular">{showRates ? formatRate(associate.rate) : "Restricted"}</dd>
        </div>
        <div>
          <dt>CV</dt>
          <dd>{cv ? `${cv.name}${cv.verifiedAt ? " · verified" : ""}` : "No CV on file"}</dd>
        </div>
        <div>
          <dt>Next available</dt>
          <dd>{associate.nextAvailableDate ? formatDate(associate.nextAvailableDate) : "—"}</dd>
        </div>
      </dl>

      <h3 className={`kicker ${styles.panelSection}`}>Skills</h3>
      <div className={styles.stack} style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
        {associate.skills.slice(0, 8).map((skill) => (
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

      <h3 className={`kicker ${styles.panelSection}`}>Recent recruitment</h3>
      {recentRecruitment.length === 0 ? (
        <EmptyState title="No recent shortlists" icon="users" />
      ) : (
        <ol className={styles.miniTimeline}>
          {recentRecruitment.map((candidate) => {
            const requirement = tessiant.requirements.find((item) => item.id === candidate.requirementId);
            return (
              <li key={candidate.id}>
                <span>
                  <b>{requirement?.title ?? "Requirement"}</b>
                  <small>
                    {shortlistLabel(candidate.shortlistStatus)} · score {candidate.matchScore}
                  </small>
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </Drawer>
  );
}
