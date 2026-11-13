"use client";

import { crm } from "@/lib/crm-store";
import type { FeedbackVerdict, QikoFeedback } from "@/lib/types";
import { useWorkspace } from "@/components/shell/WorkspaceContext";
import { useWorkspaceData } from "@/components/ui/bits";
import Icon from "./Icon";
import styles from "./FeedbackThumbs.module.css";

/**
 * "Was this right?" on anything Qiko put in front of the user. Stores one verdict per key in the
 * feedback ledger and shows the recorded state. Compact variant is for list rows (reveals on hover).
 */
export default function FeedbackThumbs({
  feedbackKey,
  context,
  compact = false,
  label = "Was this right?",
}: {
  feedbackKey: string;
  context: QikoFeedback["context"];
  compact?: boolean;
  label?: string;
}) {
  const { state } = useWorkspaceData();
  const { toast } = useWorkspace();
  const current = state?.feedback?.[feedbackKey] ?? null;

  const set = (verdict: FeedbackVerdict) => {
    if (current?.verdict === verdict) {
      crm.clearFeedback(feedbackKey);
      return;
    }
    crm.recordFeedback(feedbackKey, context, verdict);
    toast(verdict === "right" ? "Noted — Qiko got this right" : verdict === "partly" ? "Noted — partly useful" : "Noted — Qiko will weigh this down", "info");
  };

  return (
    <span className={`${styles.wrap} ${compact ? styles.compact : ""}`} data-state={current?.verdict ?? "none"} role="group" aria-label={label}>
      {!compact ? <span className={styles.label}>{current ? "Your call:" : label}</span> : null}
      <button type="button" className={styles.btn} data-verdict="right" data-on={current?.verdict === "right" || undefined} onClick={(event) => { event.preventDefault(); event.stopPropagation(); set("right"); }} aria-pressed={current?.verdict === "right"} title="Right call">
        <Icon name="check" size={12} strokeWidth={2.6} />
      </button>
      <button type="button" className={styles.btn} data-verdict="partly" data-on={current?.verdict === "partly" || undefined} onClick={(event) => { event.preventDefault(); event.stopPropagation(); set("partly"); }} aria-pressed={current?.verdict === "partly"} title="Partly useful">
        <Icon name="circle" size={10} strokeWidth={2.6} />
      </button>
      <button type="button" className={styles.btn} data-verdict="wrong" data-on={current?.verdict === "wrong" || undefined} onClick={(event) => { event.preventDefault(); event.stopPropagation(); set("wrong"); }} aria-pressed={current?.verdict === "wrong"} title="Not useful">
        <Icon name="x" size={12} strokeWidth={2.6} />
      </button>
    </span>
  );
}
