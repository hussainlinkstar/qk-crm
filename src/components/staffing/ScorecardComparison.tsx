"use client";

import type { RequirementCandidate } from "@/lib/tessiant-types";
import { averageRating } from "./InterviewScorecard";
import IconTile from "@/components/ui/IconTile";
import styles from "./ScorecardComparison.module.css";

/** Side-by-side interview scorecards so the shortlist reads as one decision, not five opinions. */
export default function ScorecardComparison({ candidates, nameOf }: { candidates: RequirementCandidate[]; nameOf: (associateId: string) => string }) {
  const scored = candidates.filter((candidate) => candidate.interview.ratings);
  if (scored.length === 0) return null;
  const ranked = [...scored].sort((a, b) => (averageRating(b.interview.ratings) ?? 0) - (averageRating(a.interview.ratings) ?? 0));
  const top = ranked[0];

  return (
    <section className={styles.card} aria-labelledby="scorecard-title">
      <div className={styles.head}>
        <IconTile name="star" tone="qiko" size="sm" />
        <div>
          <p className="kicker kicker-qiko">Qiko · Interview scorecards</p>
          <h3 id="scorecard-title">
            {nameOf(top.associateId)} leads on {averageRating(top.interview.ratings)}/5
            {ranked.length > 1 ? `, ${ranked.length - 1} other${ranked.length - 1 === 1 ? "" : "s"} scored` : ""}
          </h3>
        </div>
      </div>
      <div className={styles.table} role="table" aria-label="Scorecard comparison">
        <div className={styles.row} role="row" data-head>
          <span>Candidate</span>
          <span>Technical</span>
          <span>Communication</span>
          <span>Fit</span>
          <span>Avg</span>
          <span>Call</span>
        </div>
        {ranked.map((candidate) => {
          const r = candidate.interview.ratings!;
          return (
            <div key={candidate.id} className={styles.row} role="row" data-top={candidate.id === top.id || undefined}>
              <span className={styles.name}>
                {nameOf(candidate.associateId)}
                <small>{candidate.interview.by === "client" ? "client panel" : "Tessiant"}</small>
              </span>
              {(["technical", "communication", "fit"] as const).map((key) => (
                <span key={key} className={styles.cell}>
                  <i>
                    <b style={{ width: `${(r[key] / 5) * 100}%` }} />
                  </i>
                  <small className="tabular">{r[key]}</small>
                </span>
              ))}
              <span className={`tabular ${styles.avg}`}>{averageRating(r)}</span>
              <span className={styles.call} data-recommend={candidate.interview.recommend}>
                {candidate.interview.recommend === "advance" ? "Advance" : candidate.interview.recommend === "hold" ? "Hold" : "Not this time"}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
