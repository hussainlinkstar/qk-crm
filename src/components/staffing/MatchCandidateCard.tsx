"use client";

import Link from "next/link";
import Button from "@/components/ui/Button";
import { formatRate } from "@/lib/tessiant-insights";
import {
  availabilityFitLabel,
  suitabilityBandLabel,
  type MatchPresentation,
} from "@/lib/tessiant-matching";
import { candidateStatusLabel, type CandidateAction } from "@/lib/requisition";
import type { RequirementCandidate } from "@/lib/tessiant-types";
import styles from "@/app/(workspace)/staffing/staffing.module.css";

interface MatchCandidateCardProps {
  associateName: string;
  associateId: string;
  headline: string;
  candidate: RequirementCandidate;
  presentation: MatchPresentation;
  actions: CandidateAction[];
  onAction: (action: CandidateAction) => void;
  quoteAmount?: number;
  onQuoteChange?: (amount: number) => void;
  noteValue?: string;
  onNoteChange?: (value: string) => void;
  compact?: boolean;
}

export default function MatchCandidateCard({
  associateName,
  associateId,
  headline,
  candidate,
  presentation,
  actions,
  onAction,
  quoteAmount,
  onQuoteChange,
  noteValue,
  onNoteChange,
  compact,
}: MatchCandidateCardProps) {
  const needsNote = actions.some((action) => ("needsNote" in action && action.needsNote) || ("needsReason" in action && action.needsReason));
  const showOfferInput = actions.some((action) => action.type === "offer" || action.type === "place");

  return (
    <article className={styles.matchCard}>
      <div>
        <div className={styles.metaRow}>
          <Link href={`/staffing/associates/${associateId}`} className={styles.rowLink}>
            {associateName}
          </Link>
          <span className="chip">{candidateStatusLabel(candidate.shortlistStatus)}</span>
          <span className="chip" data-tone={presentation.suitabilityBand}>
            {suitabilityBandLabel(presentation.suitabilityBand)}
          </span>
        </div>
        <div className="muted">
          {headline} · {formatRate(presentation.associateRate)} ·{" "}
          {presentation.availabilityConfirmed ? "Availability confirmed" : availabilityFitLabel(presentation.availabilityFit)}
          {candidate.sourcedExternally ? " · external" : ""}
          {candidate.matchFlags.includes("manual_override") ? " · override" : ""}
        </div>

        {!compact && (
          <>
            <div className={styles.matchDimensions} aria-label="Match dimensions">
              <div>
                <b>Suitability</b>
                <span className="tabular">{presentation.suitabilityScore}/100</span>
                <small>Skills / sector / seniority — not availability</small>
              </div>
              <div>
                <b>Availability</b>
                <span>{presentation.availabilityLabel}</span>
                <small>{presentation.currentlyAvailable ? "May still need confirmation" : "Do not treat as ready to submit"}</small>
              </div>
              <div>
                <b>Commercial</b>
                <span>{presentation.rateLabel}</span>
                <small>
                  Target {presentation.targetRateMin ?? "—"}–{presentation.targetRateMax ?? "—"} GBP/day
                </small>
              </div>
            </div>

            <div className={styles.matchFacts}>
              <div>
                <b>Mandatory skills matched</b>
                <div className={styles.metaRow}>
                  {presentation.skillsMatched.length === 0 ? (
                    <span className="muted">None</span>
                  ) : (
                    presentation.skillsMatched.map((skill) => (
                      <span key={skill} className="chip">
                        {skill}
                      </span>
                    ))
                  )}
                </div>
              </div>
              <div>
                <b>Mandatory skills missing</b>
                <div className={styles.metaRow}>
                  {presentation.skillsMissing.length === 0 ? (
                    <span className="muted">None</span>
                  ) : (
                    presentation.skillsMissing.map((skill) => (
                      <span key={skill} className="chip">
                        {skill}
                      </span>
                    ))
                  )}
                </div>
              </div>
              <div>
                <b>Sector experience</b>
                <p className="muted" style={{ margin: "4px 0 0" }}>
                  {presentation.sectorLabel}
                  {presentation.associateSectors.length ? ` · Profile: ${presentation.associateSectors.join(", ")}` : ""}
                </p>
              </div>
              <div>
                <b>Relevant previous placements</b>
                {presentation.relevantPlacements.length === 0 ? (
                  <p className="muted" style={{ margin: "4px 0 0" }}>
                    {presentation.priorPlacementCount
                      ? `${presentation.priorPlacementCount} prior placement(s) on record — none tagged to this sector`
                      : "No prior placements on record"}
                  </p>
                ) : (
                  <ul className={styles.reasonList}>
                    {presentation.relevantPlacements.map((placement) => (
                      <li key={placement.id}>
                        {placement.requirementTitle} · {placement.sector} · {placement.status}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <div className={styles.splitHints}>
              <div>
                <b>Reasons for recommendation</b>
                <ul className={styles.reasonList}>
                  {presentation.matchReasons.map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
              </div>
              <div>
                <b>Needs verification</b>
                {presentation.verificationGaps.length === 0 && presentation.skillsMissing.length === 0 ? (
                  <p className="muted" style={{ margin: "4px 0 0" }}>
                    No critical gaps flagged
                  </p>
                ) : (
                  <ul className={`${styles.reasonList} ${styles.gapList}`}>
                    {presentation.verificationGaps.map((gap) => (
                      <li key={gap}>{gap}</li>
                    ))}
                    {presentation.skillsMissing.map((skill) => (
                      <li key={`miss_${skill}`}>Confirm workaround for missing: {skill}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {!presentation.commerciallySuitable && presentation.suitabilityBand !== "weak" && (
              <p className={styles.signal} style={{ marginTop: 10 }}>
                High skills fit does not equal commercial readiness — review rate band before offer.
              </p>
            )}
            {presentation.suitabilityBand === "strong" && !presentation.currentlyAvailable && (
              <p className={styles.signal} style={{ marginTop: 10 }}>
                Strong suitability, but availability is not clear or not free — confirm before submitting to client.
              </p>
            )}
          </>
        )}

        {candidate.rejectionReason && (
          <p className="muted" style={{ marginTop: 8 }}>
            Rejection reason: {candidate.rejectionReason}
          </p>
        )}
        {candidate.lastContactAt && (
          <p className="muted" style={{ marginTop: 8 }}>
            Last contact: {candidate.lastContactNote || "Logged"} 
          </p>
        )}

        {(needsNote || showOfferInput) && (
          <div className={styles.actions}>
            {needsNote && (
              <input
                className="input"
                style={{ minWidth: 220, flex: 1 }}
                placeholder="Contact / interview / rejection note"
                value={noteValue ?? ""}
                onChange={(e) => onNoteChange?.(e.target.value)}
                aria-label={`Note for ${associateName}`}
              />
            )}
            {showOfferInput && onQuoteChange && (
              <input
                className="input"
                style={{ width: 110 }}
                type="number"
                value={quoteAmount ?? presentation.associateRate?.amount ?? 900}
                onChange={(e) => onQuoteChange(Number(e.target.value))}
                aria-label={`Client rate for ${associateName}`}
              />
            )}
          </div>
        )}

        <div className={styles.actions}>
          {actions.length === 0 ? (
            <span className="muted">No further actions — terminal state</span>
          ) : (
            actions.map((action) => (
              <Button
                key={`${action.type}_${action.label}`}
                size="small"
                variant={action.type === "reject" || action.type === "remove_shortlist" ? "ghost" : action.type === "place" || action.type === "shortlist" ? "primary" : "secondary"}
                icon={action.type === "place" ? "check" : undefined}
                onClick={() => onAction(action)}
              >
                {action.label}
              </Button>
            ))
          )}
        </div>
      </div>
      <div className={styles.matchScore}>
        <b className="tabular">{presentation.suitabilityScore}</b>
        <small>suitability</small>
        <span className="muted tabular" style={{ marginTop: 6 }}>
          rank {presentation.matchScore}
        </span>
      </div>
    </article>
  );
}
