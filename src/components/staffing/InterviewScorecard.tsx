"use client";

import { useState } from "react";
import type { InterviewRatings, InterviewRecommendation, RequirementCandidate } from "@/lib/tessiant-types";
import { crm } from "@/lib/crm-store";
import { formatDate } from "@/lib/format";
import Button from "@/components/ui/Button";
import Icon from "@/components/ui/Icon";
import { useWorkspace } from "@/components/shell/WorkspaceContext";
import styles from "./InterviewScorecard.module.css";

const DIMENSIONS: Array<{ key: keyof InterviewRatings; label: string; hint: string }> = [
  { key: "technical", label: "Technical depth", hint: "Can they do the work on this brief?" },
  { key: "communication", label: "Communication", hint: "Will the client enjoy working with them?" },
  { key: "fit", label: "Fit for the brief", hint: "Sector, pace, stakeholders, ways of working." },
];

const RECOMMEND: Array<{ key: InterviewRecommendation; label: string; tone: string }> = [
  { key: "advance", label: "Advance", tone: "success" },
  { key: "hold", label: "Hold", tone: "warning" },
  { key: "reject", label: "Not this time", tone: "danger" },
];

export function averageRating(ratings?: InterviewRatings): number | null {
  if (!ratings) return null;
  return Math.round(((ratings.technical + ratings.communication + ratings.fit) / 3) * 10) / 10;
}

/**
 * Structured interview feedback on a shortlisted candidate: three 1–5 ratings, a recommendation,
 * strengths and concerns, and who gave it. Recorded on the candidate so the comparison on the
 * Interviews tab and the client digest read the same numbers.
 */
export default function InterviewScorecard({ candidate, associateName }: { candidate: RequirementCandidate; associateName: string }) {
  const { toast } = useWorkspace();
  const existing = candidate.interview;
  const [editing, setEditing] = useState(!existing.ratings);
  const [ratings, setRatings] = useState<InterviewRatings>(existing.ratings ?? { technical: 0, communication: 0, fit: 0 });
  const [recommend, setRecommend] = useState<InterviewRecommendation | null>(existing.recommend ?? null);
  const [by, setBy] = useState<"team" | "client">(existing.by ?? "team");
  const [strengths, setStrengths] = useState(existing.strengths ?? "");
  const [concerns, setConcerns] = useState(existing.concerns ?? "");
  const [summary, setSummary] = useState(existing.summary ?? "");

  const complete = ratings.technical > 0 && ratings.communication > 0 && ratings.fit > 0 && recommend !== null;

  const save = () => {
    if (!complete) {
      toast("Rate all three and pick a recommendation", "info");
      return;
    }
    const outcome = recommend === "advance" ? "positive" : recommend === "hold" ? "neutral" : "negative";
    crm.completeInterview(candidate.id, { outcome, summary: summary || `${by === "client" ? "Client" : "Tessiant"} scorecard recorded`, ratings, recommend: recommend!, by, strengths, concerns });
    toast(`Scorecard saved for ${associateName}`);
    setEditing(false);
  };

  if (!editing && existing.ratings) {
    const avg = averageRating(existing.ratings);
    return (
      <div className={styles.card} data-recommend={existing.recommend}>
        <div className={styles.readHead}>
          <span className={styles.avg}>
            <b className="tabular">{avg}</b>
            <small>/5</small>
          </span>
          <div className={styles.readCopy}>
            <b>
              {RECOMMEND.find((item) => item.key === existing.recommend)?.label ?? "Recorded"} · {existing.by === "client" ? "client panel" : "Tessiant interview"}
            </b>
            <small>{existing.heldAt ? formatDate(existing.heldAt) : ""}</small>
          </div>
          <button type="button" className="link-button" onClick={() => setEditing(true)}>
            Edit
          </button>
        </div>
        <ul className={styles.bars}>
          {DIMENSIONS.map((dimension) => (
            <li key={dimension.key}>
              <span>{dimension.label}</span>
              <i>
                <b style={{ width: `${(existing.ratings![dimension.key] / 5) * 100}%` }} />
              </i>
              <small className="tabular">{existing.ratings![dimension.key]}</small>
            </li>
          ))}
        </ul>
        {existing.strengths || existing.concerns ? (
          <div className={styles.notes}>
            {existing.strengths ? (
              <p>
                <Icon name="check" size={12} strokeWidth={2.6} /> {existing.strengths}
              </p>
            ) : null}
            {existing.concerns ? (
              <p data-kind="concern">
                <Icon name="alert" size={12} /> {existing.concerns}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className={styles.card}>
      <div className={styles.formHead}>
        <b>Interview scorecard · {associateName}</b>
        <div className="segmented" role="group" aria-label="Feedback from">
          <button type="button" aria-pressed={by === "team"} onClick={() => setBy("team")}>
            Tessiant
          </button>
          <button type="button" aria-pressed={by === "client"} onClick={() => setBy("client")}>
            Client panel
          </button>
        </div>
      </div>
      <ul className={styles.dims}>
        {DIMENSIONS.map((dimension) => (
          <li key={dimension.key}>
            <span className={styles.dimLabel}>
              <b>{dimension.label}</b>
              <small>{dimension.hint}</small>
            </span>
            <span className={styles.dots} role="radiogroup" aria-label={dimension.label}>
              {[1, 2, 3, 4, 5].map((value) => (
                <button key={value} type="button" role="radio" aria-checked={ratings[dimension.key] === value} data-on={ratings[dimension.key] >= value || undefined} onClick={() => setRatings({ ...ratings, [dimension.key]: value })} aria-label={`${value} of 5`}>
                  {value}
                </button>
              ))}
            </span>
          </li>
        ))}
      </ul>
      <div className={styles.recommend} role="radiogroup" aria-label="Recommendation">
        {RECOMMEND.map((item) => (
          <button key={item.key} type="button" role="radio" aria-checked={recommend === item.key} data-tone={item.tone} onClick={() => setRecommend(item.key)}>
            {item.label}
          </button>
        ))}
      </div>
      <div className={styles.fields}>
        <label className="field">
          <span>Strengths</span>
          <input className="input" value={strengths} onChange={(event) => setStrengths(event.target.value)} placeholder="e.g. Ran a comparable migration; clear on trade-offs." />
        </label>
        <label className="field">
          <span>Concerns</span>
          <input className="input" value={concerns} onChange={(event) => setConcerns(event.target.value)} placeholder="e.g. Limited hands-on with the integration layer." />
        </label>
        <label className="field">
          <span>Summary for the client</span>
          <input className="input" value={summary} onChange={(event) => setSummary(event.target.value)} placeholder="One line the client will read." />
        </label>
      </div>
      <div className={styles.actions}>
        <Button size="small" variant="qiko" icon="check" onClick={save} disabled={!complete}>
          Save scorecard
        </Button>
        {existing.ratings ? (
          <button type="button" className="link-button" onClick={() => setEditing(false)}>
            Cancel
          </button>
        ) : null}
      </div>
    </div>
  );
}
