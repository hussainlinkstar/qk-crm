"use client";

import Link from "next/link";
import { useState } from "react";
import Button from "@/components/ui/Button";
import { Drawer, Modal } from "@/components/ui/Overlay";
import { useWorkspace } from "@/components/shell/WorkspaceContext";
import { crm } from "@/lib/crm-store";
import { formatRate } from "@/lib/tessiant-insights";
import { addDays } from "@/lib/format";
import { availabilityFitLabel, suitabilityBandLabel } from "@/lib/tessiant-matching";
import {
  clientShortlistSummary,
  recommendedMatches,
  roleTitleFor,
  type RecommendedMatch,
} from "@/lib/requirement-recommendations";
import type { ClientRequirement } from "@/lib/tessiant-types";
import type { CrmState } from "@/lib/types";
import styles from "@/app/(workspace)/staffing/staffing.module.css";

function Flags({ item }: { item: RecommendedMatch }) {
  return (
    <div className={styles.recFlags}>
      {item.missingSkills.map((skill) => (
        <span key={skill} className="chip">
          Missing {skill}
        </span>
      ))}
      {item.unavailable ? <span className="chip">Unavailable / unconfirmed</span> : null}
      {item.unverified ? <span className="chip">Unverified information</span> : null}
    </div>
  );
}

function CompactCard({
  item,
  onOpen,
  onShortlist,
}: {
  item: RecommendedMatch;
  onOpen: () => void;
  onShortlist: () => void;
}) {
  const { presentation, associate } = item;
  return (
    <article className={styles.recCard}>
      <button type="button" className={styles.recHit} onClick={onOpen}>
        <div className={styles.recTitle}>
          <b>{associate.name}</b>
          <span className="chip">{suitabilityBandLabel(presentation.suitabilityBand)}</span>
        </div>
        <p className={styles.recRole}>{roleTitleFor(associate)}</p>
        <p className={styles.recMeta}>
          {presentation.skillsMatched.slice(0, 3).join(", ") || "No mandatory skills matched"}
          {" · "}
          {presentation.sectorLabel}
        </p>
        <p className={styles.recMeta}>
          {presentation.availabilityConfirmed ? "Availability confirmed" : availabilityFitLabel(presentation.availabilityFit)}
          {" · "}
          {presentation.rateLabel}
        </p>
        <p className={styles.recReason}>{item.reason}</p>
        <Flags item={item} />
      </button>
      <div className={styles.recActions}>
        <Link href={`/staffing/associates/${associate.id}`} className={styles.recLink}>
          View profile
        </Link>
        <Button size="small" onClick={onShortlist} disabled={!item.canShortlist}>
          {item.canShortlist ? "Add to shortlist" : item.pipelineLabel ?? "On shortlist"}
        </Button>
      </div>
    </article>
  );
}

export default function RecommendedMatches({
  state,
  requirement,
  compact = false,
}: {
  state: CrmState;
  requirement: ClientRequirement;
  compact?: boolean;
}) {
  const { toast, openTaskForm } = useWorkspace();
  const set = recommendedMatches(state, requirement);
  const pack = clientShortlistSummary(state, requirement);
  const [detail, setDetail] = useState<RecommendedMatch | null>(null);
  const [packOpen, setPackOpen] = useState(false);

  const shortlist = (item: RecommendedMatch) => {
    const result = crm.shortlistAssociate(requirement.id, item.associate.id);
    if (!result.ok) {
      toast(result.error, "error");
      return;
    }
    toast(result.already ? `${item.associate.name} is already on the pipeline` : `${item.associate.name} added to shortlist`, "success");
  };

  return (
    <section className={compact ? styles.recCompact : styles.recSection} aria-label="Qiko recommended matches">
      <div className={styles.recHead}>
        <div>
          <p className="kicker">Qiko</p>
          <h2>Recommended matches</h2>
        </div>
        {!compact ? (
          <Button size="small" variant="secondary" onClick={() => setPackOpen(true)}>
            Prepare client shortlist
          </Button>
        ) : null}
      </div>
      {set.emptyMessage ? <p className={styles.recEmpty}>{set.emptyMessage}</p> : null}
      {set.items.length === 0 ? (
        <p className="muted">No ranked associates for this brief yet.</p>
      ) : (
        <div className={compact ? styles.recCompactList : styles.recGrid}>
          {set.items.map((item) =>
            compact ? (
              <div key={item.associate.id} className={styles.recMini}>
                <Link href={`/staffing/associates/${item.associate.id}`}>{item.associate.name}</Link>
                <span className="muted">
                  {" "}
                  · {suitabilityBandLabel(item.presentation.suitabilityBand)} ·{" "}
                  {availabilityFitLabel(item.presentation.availabilityFit)}
                </span>
                {item.missingSkills.length || item.unavailable || item.unverified ? (
                  <span className="muted"> · gaps flagged</span>
                ) : null}
              </div>
            ) : (
              <CompactCard
                key={item.associate.id}
                item={item}
                onOpen={() => setDetail(item)}
                onShortlist={() => shortlist(item)}
              />
            ),
          )}
        </div>
      )}
      {compact ? (
        <Link href={`/staffing/requirements/${requirement.id}`} className={styles.recReqLink}>
          Open requirement
        </Link>
      ) : set.emptyMessage ? (
        <div className={styles.recFollow}>
          <Button
            size="small"
            variant="secondary"
            onClick={() =>
              openTaskForm({
                title: "Create sourcing task",
                initial: {
                  title: `Source verified available matches · ${requirement.title}`,
                  description: set.emptyMessage ?? "",
                  leadId: null,
                  priority: "high",
                  due: addDays(2),
                  ownerId: requirement.ownerId ?? "me",
                },
              })
            }
          >
            Create sourcing task
          </Button>
        </div>
      ) : null}

      {detail && !compact ? (
        <Drawer
          kicker="Match detail"
          title={detail.associate.name}
          onClose={() => setDetail(null)}
          width={480}
          footer={
            <div className={styles.recActions}>
              <Link href={`/staffing/associates/${detail.associate.id}`} className={styles.recLink}>
                View profile
              </Link>
              <Button
                onClick={() => {
                  shortlist(detail);
                  setDetail(null);
                }}
                disabled={!detail.canShortlist}
              >
                {detail.canShortlist ? "Add to shortlist" : detail.pipelineLabel ?? "On shortlist"}
              </Button>
            </div>
          }
        >
          <p className="muted">{roleTitleFor(detail.associate)}</p>
          <p>{detail.reason}</p>
          <dl className={styles.recFacts}>
            <div>
              <dt>Suitability</dt>
              <dd>
                {suitabilityBandLabel(detail.presentation.suitabilityBand)} · {detail.presentation.suitabilityScore}/100
              </dd>
            </div>
            <div>
              <dt>Availability</dt>
              <dd>{detail.presentation.availabilityLabel}</dd>
            </div>
            <div>
              <dt>Rate</dt>
              <dd>
                {formatRate(detail.presentation.associateRate)} · {detail.presentation.rateLabel}
              </dd>
            </div>
            <div>
              <dt>Skills matched</dt>
              <dd>{detail.presentation.skillsMatched.join(", ") || "None"}</dd>
            </div>
            <div>
              <dt>Mandatory missing</dt>
              <dd>{detail.missingSkills.join(", ") || "None"}</dd>
            </div>
            <div>
              <dt>Sector</dt>
              <dd>{detail.presentation.sectorLabel}</dd>
            </div>
          </dl>
          <Flags item={detail} />
        </Drawer>
      ) : null}

      {packOpen ? (
        <Modal
          kicker="Client pack"
          title="Prepare client shortlist"
          description="Review-only summary of consultants you have already shortlisted. Nothing is sent until you choose to."
          onClose={() => setPackOpen(false)}
          footer={
            <Button variant="secondary" onClick={() => setPackOpen(false)}>
              Close
            </Button>
          }
        >
          {pack.length === 0 ? (
            <p className="muted">Shortlist at least one consultant to assemble a client summary.</p>
          ) : (
            <ul className={styles.recPack}>
              {pack.map((item) => (
                <li key={item.associate.id}>
                  <b>{item.associate.name}</b>
                  <span>
                    {roleTitleFor(item.associate)} · {suitabilityBandLabel(item.presentation.suitabilityBand)} ·{" "}
                    {availabilityFitLabel(item.presentation.availabilityFit)} · {item.presentation.rateLabel}
                  </span>
                  <small>{item.reason}</small>
                </li>
              ))}
            </ul>
          )}
        </Modal>
      ) : null}
    </section>
  );
}
