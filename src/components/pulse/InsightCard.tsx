"use client";

import Link from "next/link";
import { useState } from "react";
import Button from "@/components/ui/Button";
import { PriorityChip } from "@/components/ui/bits";
import { useWorkspace } from "@/components/shell/WorkspaceContext";
import { crm } from "@/lib/crm-store";
import type { TessiantInsight } from "@/lib/tessiant-pulse-types";
import styles from "@/app/(workspace)/pulse/pulse.module.css";

const REJECT_REASONS = ["Not relevant", "Poor data", "Already handled", "Inappropriate suggestion"] as const;

export default function InsightCard({ insight, compact = false }: { insight: TessiantInsight; compact?: boolean }) {
  const { toast } = useWorkspace();
  const [reason, setReason] = useState<string>(REJECT_REASONS[0]);
  const [showReject, setShowReject] = useState(false);

  return (
    <article className={styles.insight}>
      <div className={styles.insightHead}>
        <span className="chip chip-ai">{insight.knowledgeBlockId}</span>
        <span className="chip">{insight.ruleId}</span>
        <PriorityChip priority={insight.priority} />
        <span className="chip">{insight.confidence}</span>
        <span className="chip">{insight.reviewStatus}</span>
      </div>
      <div>
        <b>{insight.title}</b>
        <p className="muted" style={{ marginTop: 4 }}>
          {insight.summary}
        </p>
      </div>
      {!compact && (
        <ul className={styles.evidence}>
          {insight.evidence.map((item, index) => (
            <li key={`${item.entityId}-${index}`}>
              {item.href ? (
                <Link href={item.href}>
                  {item.entityType}/{item.entityId}
                </Link>
              ) : (
                <span>
                  {item.entityType}/{item.entityId}
                </span>
              )}
              {item.field ? ` · ${item.field}` : ""}
              {item.observedValue !== undefined ? ` = ${item.observedValue}` : ""}
            </li>
          ))}
        </ul>
      )}
      <p className="muted">
        Recommended: <b>{insight.recommendedAction.label}</b>
      </p>
      {insight.reviewStatus === "pending" && (
        <div className={styles.actions}>
          <Button
            size="small"
            icon="check"
            onClick={() => {
              crm.acceptPulseInsight(insight);
              toast("Insight accepted — task created. Feedback stored for future rule review (no auto-training).");
            }}
          >
            Accept
          </Button>
          <Button size="small" variant="secondary" onClick={() => setShowReject((v) => !v)}>
            Reject
          </Button>
          {showReject && (
            <>
              <select className="input" value={reason} onChange={(e) => setReason(e.target.value)} aria-label="Reject reason">
                {REJECT_REASONS.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
              <Button
                size="small"
                variant="ghost"
                onClick={() => {
                  crm.rejectPulseInsight(insight.id, reason);
                  toast("Rejection recorded as feedback for future tuning");
                  setShowReject(false);
                }}
              >
                Confirm reject
              </Button>
            </>
          )}
        </div>
      )}
      {insight.reviewStatus === "accepted" && insight.taskId && (
        <p className="muted">
          Task linked: <code>{insight.taskId}</code> ·{" "}
          <Link href="/pulse/actions" className="text-link">
            Open Pulse actions
          </Link>
        </p>
      )}
      {insight.reviewStatus === "rejected" && <p className="muted">Rejected{insight.reviewReason ? `: ${insight.reviewReason}` : ""}</p>}
    </article>
  );
}
