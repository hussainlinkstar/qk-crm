"use client";

import Link from "next/link";
import { useState } from "react";
import Button from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Overlay";
import { PriorityChip, useWorkspaceData } from "@/components/ui/bits";
import { useWorkspace } from "@/components/shell/WorkspaceContext";
import { crm } from "@/lib/crm-store";
import {
  confidenceNote,
  evidenceKindLabel,
  evidenceLabel,
  expectedBenefit,
  knowledgeBlockTitle,
  rulePlainLanguage,
} from "@/lib/pulse-presentation";
import type { TessiantInsight } from "@/lib/tessiant-pulse-types";
import styles from "@/app/(workspace)/pulse/pulse.module.css";

const REJECT_REASONS = ["Not relevant", "Poor data", "Already handled", "Inappropriate suggestion"] as const;

function primarySource(insight: TessiantInsight) {
  return (
    insight.evidence.find((item) => item.entityType === "requirement") ??
    insight.evidence.find((item) => item.entityType === "associate") ??
    insight.evidence.find((item) => item.entityType === "account") ??
    insight.evidence.find((item) => item.entityType === "opportunity") ??
    insight.evidence[0] ??
    null
  );
}

export default function InsightCard({
  insight,
  compact = false,
  reviewOnClick = false,
}: {
  insight: TessiantInsight;
  compact?: boolean;
  reviewOnClick?: boolean;
}) {
  const { toast, openTask } = useWorkspace();
  const { state } = useWorkspaceData();
  const [reason, setReason] = useState<string>(REJECT_REASONS[0]);
  const [showReject, setShowReject] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);

  const source = primarySource(insight);
  const alreadyAccepted = insight.reviewStatus === "accepted" || Boolean(insight.taskId);
  const outcome = state?.tessiant?.pulse?.outcomes.find((item) => item.insightId === insight.id);
  const linkedTask = insight.taskId ? state?.tasks.find((item) => item.id === insight.taskId) : null;

  const accept = () => {
    if (alreadyAccepted) {
      if (insight.taskId) openTask(insight.taskId);
      toast(insight.taskId ? "Already accepted — linked to-do is ready" : "Already accepted");
      return;
    }
    const taskId = crm.acceptPulseInsight(insight);
    toast("Insight accepted — to-do added to My Tasks");
    setReviewOpen(false);
    if (taskId) openTask(taskId);
  };

  const reject = () => {
    if (insight.reviewStatus !== "pending") return;
    crm.rejectPulseInsight(insight.id, reason);
    toast("Rejection recorded for future evaluation");
    setShowReject(false);
    setReviewOpen(false);
  };

  const openLinkedTask = () => {
    if (insight.taskId) openTask(insight.taskId);
    setReviewOpen(false);
  };

  return (
    <>
      <article className={`${styles.insight} ${compact ? styles.insightCompact : ""} ${reviewOnClick ? styles.insightHit : ""}`}>
        <div className={styles.insightHead}>
          <span className="chip chip-ai">{knowledgeBlockTitle(insight.knowledgeBlockId)}</span>
          <PriorityChip priority={insight.priority} />
          {insight.reviewStatus !== "pending" ? <span className="chip">{insight.reviewStatus}</span> : null}
          {outcome ? <span className="chip">{outcome.status === "completed" ? "outcome recorded" : outcome.status.replace("_", " ")}</span> : null}
        </div>

        <div>
          {reviewOnClick ? (
            <button type="button" className={styles.insightTitleBtn} onClick={() => setReviewOpen(true)}>
              <b>{insight.title}</b>
            </button>
          ) : (
            <b>{insight.title}</b>
          )}
          <p className="muted" style={{ marginTop: 4 }}>
            {insight.summary}
          </p>
        </div>

        <p className={styles.insightMeta}>
          <span>
            Suggested: <b>{insight.recommendedAction.label}</b>
          </span>
          {source ? (
            <span className={styles.sourceRef}>
              Source:{" "}
              {source.href ? (
                <Link href={source.href} className="text-link">
                  {evidenceLabel(state, source)}
                </Link>
              ) : (
                evidenceLabel(state, source)
              )}
            </span>
          ) : null}
        </p>

        <div className={styles.actions}>
          <Button size="small" variant="secondary" onClick={() => setReviewOpen(true)}>
            Review Insight
          </Button>
          {insight.reviewStatus === "pending" && !alreadyAccepted ? (
            <>
              <Button size="small" icon="check" onClick={accept}>
                Accept
              </Button>
              <Button size="small" variant="ghost" onClick={() => setShowReject((value) => !value)}>
                Reject
              </Button>
            </>
          ) : null}
          {insight.reviewStatus === "accepted" && insight.taskId ? (
            <>
              <Button size="small" variant="secondary" onClick={openLinkedTask}>
                Open task
              </Button>
              <Link href="/tasks" className="text-link">
                My Tasks
              </Link>
            </>
          ) : null}
          {insight.reviewStatus === "rejected" ? <span className="muted">Rejected{insight.reviewReason ? ` · ${insight.reviewReason}` : ""}</span> : null}
        </div>

        {showReject && insight.reviewStatus === "pending" ? (
          <div className={styles.actions}>
            <select className="input" value={reason} onChange={(event) => setReason(event.target.value)} aria-label="Reject reason">
              {REJECT_REASONS.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
            <Button size="small" variant="ghost" onClick={reject}>
              Confirm reject
            </Button>
          </div>
        ) : null}
      </article>

      {reviewOpen ? (
        <Drawer
          kicker="Insight review"
          title={insight.title}
          onClose={() => setReviewOpen(false)}
          width={560}
          footer={
            insight.reviewStatus === "pending" && !alreadyAccepted ? (
              <div className={styles.actions}>
                <Button icon="check" onClick={accept}>
                  Accept → create to-do
                </Button>
                <Button variant="secondary" onClick={() => setShowReject(true)}>
                  Reject
                </Button>
              </div>
            ) : insight.taskId ? (
              <div className={styles.actions}>
                <Button variant="secondary" onClick={openLinkedTask}>
                  Open linked task
                </Button>
                <Link href="/tasks" className="text-link" onClick={() => setReviewOpen(false)}>
                  My Tasks
                </Link>
              </div>
            ) : null
          }
        >
          <div className={styles.panelMeta}>
            <span className="chip chip-ai">{knowledgeBlockTitle(insight.knowledgeBlockId)}</span>
            <PriorityChip priority={insight.priority} />
            <span className="chip">{insight.confidence}</span>
            {linkedTask ? <span className="chip">{linkedTask.status.replace("_", " ")}</span> : null}
            {outcome ? <span className="chip">{outcome.status.replace("_", " ")}</span> : null}
          </div>

          <h3 className={styles.panelSection}>What was detected</h3>
          <p className="muted">{insight.summary}</p>

          <h3 className={styles.panelSection}>Supporting records</h3>
          <ul className={styles.evidence}>
            {insight.evidence.map((item, index) => (
              <li key={`${item.entityId}-${index}`}>
                <span className="muted">{evidenceKindLabel(item)} · </span>
                {item.href ? (
                  <Link href={item.href} onClick={() => setReviewOpen(false)}>
                    {evidenceLabel(state, item)}
                  </Link>
                ) : (
                  <span>{evidenceLabel(state, item)}</span>
                )}
                {item.field && item.observedValue != null ? (
                  <span className="muted"> — {item.field}: {String(item.observedValue)}</span>
                ) : null}
              </li>
            ))}
          </ul>

          <h3 className={styles.panelSection}>Why it matters</h3>
          <p>{rulePlainLanguage(insight.ruleId)}</p>
          <p className="muted">{expectedBenefit(insight)}</p>

          <h3 className={styles.panelSection}>Recommended next action</h3>
          <p>{insight.recommendedAction.label}</p>

          <h3 className={styles.panelSection}>Confidence & limits</h3>
          <p className="muted">{confidenceNote(insight)}</p>

          {outcome ? (
            <>
              <h3 className={styles.panelSection}>Recorded outcome</h3>
              <p>{outcome.summary}</p>
              <p className="muted">
                Status {outcome.status.replace("_", " ")}. Completing the task is not realised revenue.
              </p>
            </>
          ) : null}

          {showReject && insight.reviewStatus === "pending" ? (
            <div style={{ marginTop: 16 }}>
              <h3 className={styles.panelSection}>Reject reason</h3>
              <div className={styles.actions}>
                <select className="input" value={reason} onChange={(event) => setReason(event.target.value)} aria-label="Reject reason">
                  {REJECT_REASONS.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
                <Button size="small" variant="ghost" onClick={reject}>
                  Confirm reject
                </Button>
              </div>
            </div>
          ) : null}
        </Drawer>
      ) : null}
    </>
  );
}
