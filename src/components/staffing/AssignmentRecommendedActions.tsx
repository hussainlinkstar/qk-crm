"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import Button from "@/components/ui/Button";
import IconTile from "@/components/ui/IconTile";
import { useWorkspace } from "@/components/shell/WorkspaceContext";
import { crm } from "@/lib/crm-store";
import {
  assignmentRecommendations,
  recommendationStatus,
  setAssignmentRecStatus,
  useAssignmentRecStatuses,
  type AssignmentRecommendation,
  type AssignmentRecStatus,
} from "@/lib/assignment-recommendations";
import { todayKey } from "@/lib/format";
import type { CrmState } from "@/lib/types";
import styles from "@/app/(workspace)/staffing/staffing.module.css";

const STATUS_LABEL: Record<AssignmentRecStatus, string> = {
  new: "New",
  actioned: "Actioned",
  dismissed: "Dismissed",
};

function SourceLinks({ rec }: { rec: AssignmentRecommendation }) {
  return (
    <p className={styles.recSource}>
      Source:{" "}
      <Link href={rec.assignmentHref} className={styles.recLink}>
        Assignment
      </Link>
      {rec.matchRequirementId ? (
        <>
          {" · "}
          <Link href={`/staffing/requirements/${rec.matchRequirementId}`} className={styles.recLink}>
            Matching requirement
          </Link>
        </>
      ) : rec.requirementId ? (
        <>
          {" · "}
          <Link href={`/staffing/requirements/${rec.requirementId}`} className={styles.recLink}>
            Requirement
          </Link>
        </>
      ) : null}
      <span className="muted"> · {rec.sourceLabel}</span>
    </p>
  );
}

export default function AssignmentRecommendedActions({
  state,
  assignmentId,
  compact = false,
}: {
  state: CrmState;
  assignmentId?: string;
  compact?: boolean;
}) {
  const router = useRouter();
  const { toast, openTask } = useWorkspace();
  const stored = useAssignmentRecStatuses();
  const today = todayKey();

  const recs = useMemo(() => {
    const all = assignmentRecommendations(state, today);
    const scoped = assignmentId ? all.filter((item) => item.assignmentId === assignmentId) : all;
    return scoped.map((item) => ({ item, status: recommendationStatus(item, stored, state) }));
  }, [state, stored, today, assignmentId]);

  if (recs.length === 0) return null;

  const act = (rec: AssignmentRecommendation, status: AssignmentRecStatus) => {
    if (status === "dismissed") return;
    if (rec.kind === "renewal") {
      const existing = state.tessiant?.placements.find((item) => item.id === rec.assignmentId)?.followUpTaskId;
      const taskId = crm.ensureAssignmentRenewalFollowUp(rec.assignmentId);
      setAssignmentRecStatus(rec.id, "actioned");
      if (existing) {
        toast("Opening the linked follow-up", "info");
        openTask(existing);
        return;
      }
      if (taskId) {
        toast("Renewal follow-up created", "success");
        openTask(taskId);
        return;
      }
      toast("Could not create a follow-up — open the assignment to continue", "info");
      router.push(rec.assignmentHref);
      return;
    }
    setAssignmentRecStatus(rec.id, "actioned");
    router.push(rec.actionHref);
  };

  return (
    <section className={compact ? styles.recCompact : styles.recSection} aria-label="Recommended actions">
      <div className={styles.recHead}>
        <div className={styles.recHeadCopy}>
          <IconTile name="sparkles" tone="qiko" size="lg" />
          <div>
            <p className="kicker kicker-qiko">Qiko</p>
            <h2>Recommended actions</h2>
          </div>
        </div>
      </div>
      <div className={compact ? styles.recActionStack : styles.recActionGrid}>
        {recs.map(({ item, status }) => (
          <article key={item.id} className={styles.recActionCard} data-status={status}>
            <div className={styles.recActionTop}>
              <IconTile name={item.kind === "renewal" ? "refresh" : "rocket"} tone={item.kind === "renewal" ? "warning" : "qiko"} size="sm" />
              <span className={styles.recKind}>{item.kind === "renewal" ? "Assignment renewal" : "Redeployment"}</span>
              <span className={`chip ${status === "new" ? "chip-high" : ""}`} style={{ marginLeft: "auto" }}>
                {STATUS_LABEL[status]}
              </span>
            </div>
            <p className={styles.recDetected}>{item.detected}</p>
            <p className={styles.recWhy}>{item.why}</p>
            <SourceLinks rec={item} />
            <div className={styles.recActionBar}>
              <Button
                size="small"
                variant={status === "new" ? "primary" : "secondary"}
                disabled={status === "dismissed"}
                onClick={() => act(item, status)}
              >
                {item.kind === "renewal" && status === "actioned" ? "Open follow-up" : item.actionLabel}
              </Button>
              {status === "new" ? (
                <Button size="small" variant="ghost" onClick={() => setAssignmentRecStatus(item.id, "dismissed")}>
                  Dismiss
                </Button>
              ) : null}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
