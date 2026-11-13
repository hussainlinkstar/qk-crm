"use client";

import Link from "next/link";
import Button from "@/components/ui/Button";
import Icon from "@/components/ui/Icon";
import { Drawer } from "@/components/ui/Overlay";
import { useWorkspaceData } from "@/components/ui/bits";
import { useWorkspace } from "@/components/shell/WorkspaceContext";
import { crm } from "@/lib/crm-store";
import {
  assignmentRoleTitle,
  assignmentStatusLabel,
  deriveAssignmentStatus,
  resolveAssignmentAccountId,
} from "@/lib/assignments";
import { addDays, formatDate, todayKey } from "@/lib/format";
import { assignmentRenewalStatus } from "@/lib/tessiant-insights";
import { assignmentInsight } from "@/lib/record-insights";
import RecordInsight from "@/components/ui/RecordInsight";
import styles from "@/components/leads/Leads.module.css";

export default function AssignmentQuickPanel({
  assignmentId,
  onClose,
}: {
  assignmentId: string;
  onClose: () => void;
}) {
  const { state } = useWorkspaceData();
  const { toast, openTask } = useWorkspace();
  if (!state?.tessiant) return null;

  const assignment = state.tessiant.placements.find((item) => item.id === assignmentId);
  if (!assignment) return null;

  const today = todayKey();
  const associate = state.tessiant.associates.find((item) => item.id === assignment.associateId);
  const accountId = resolveAssignmentAccountId(state, assignment);
  const account = state.tessiant.accounts.find((item) => item.id === accountId);
  const status = deriveAssignmentStatus(assignment, today);
  const renewal = assignmentRenewalStatus(assignment, today);
  const live = status === "upcoming" || status === "active" || status === "extended";
  const ending = renewal === "ending" || renewal === "renewal_due";

  return (
    <Drawer
      kicker="Assignment"
      title={
        <span className={styles.panelTitle}>
          <span>
            {assignmentRoleTitle(state, assignment)}
            <small>
              {associate?.name ?? "Associate"} · {account?.name ?? "Client"}
            </small>
          </span>
        </span>
      }
      onClose={onClose}
      width={520}
      footer={
        <Link href={`/staffing/placements/${assignment.id}`} className={styles.fullProfile} onClick={onClose}>
          Open assignment <Icon name="arrowRight" size={14} />
        </Link>
      }
    >
      <RecordInsight
        subject="assignment"
        data={assignmentInsight(state, assignment, today)}
        actions={
          live && ending ? (
            <Button
              size="small"
              variant="qiko"
              icon="tasks"
              onClick={() => {
                const existing = assignment.followUpTaskId;
                const taskId = crm.ensureAssignmentRenewalFollowUp(assignment.id);
                if (existing) {
                  openTask(existing);
                  return;
                }
                toast(taskId ? "Renewal follow-up created" : "Follow-up already exists or end date missing", taskId ? "success" : "info");
                if (taskId) openTask(taskId);
              }}
            >
              {assignment.followUpTaskId ? "Open renewal follow-up" : "Create renewal follow-up"}
            </Button>
          ) : null
        }
      />

      <div className={styles.panelMeta}>
        <span className="chip">{assignmentStatusLabel(status)}</span>
        <span className={`chip ${ending ? "chip-high" : ""}`}>{renewal.replaceAll("_", " ")}</span>
        <span className="chip tabular">{assignment.capacityPercent ?? 100}% capacity</span>
      </div>

      {live ? (
        <div className={styles.quickActions}>
          <Button
            size="small"
            variant="secondary"
            onClick={() => {
              const endDate = addDays(30, new Date(`${assignment.terms.endDate || today}T12:00:00`));
              const result = crm.extendAssignment(assignment.id, {
                endDate,
                renewalDate: endDate,
                note: "Extended +30 days from quick view",
              });
              if (!result.ok) {
                toast(result.error, "error");
                return;
              }
              toast("Assignment extended +30 days", "success");
            }}
          >
            Extend +30d
          </Button>
          <Button
            size="small"
            variant="secondary"
            onClick={() => {
              crm.completeAssignment(assignment.id, {
                confirmedAvailableDate: assignment.terms.endDate || today,
                note: "Completed from quick view",
              });
              toast("Assignment completed", "success");
              onClose();
            }}
          >
            Complete
          </Button>
          <Button
            size="small"
            variant="ghost"
            onClick={() => {
              const taskId = crm.ensureAssignmentRenewalFollowUp(assignment.id);
              toast(taskId ? "Redeploy follow-up created" : "Follow-up already exists or end date missing", taskId ? "success" : "info");
            }}
          >
            Redeploy
          </Button>
        </div>
      ) : null}

      <dl className={styles.facts}>
        <div>
          <dt>Associate</dt>
          <dd>
            <Link href={`/staffing/associates/${assignment.associateId}`} onClick={onClose}>
              {associate?.name ?? "—"}
            </Link>
          </dd>
        </div>
        <div>
          <dt>Client</dt>
          <dd>
            {account ? (
              <Link href={`/sales/accounts/${account.id}`} onClick={onClose}>
                {account.name}
              </Link>
            ) : (
              "—"
            )}
          </dd>
        </div>
        <div>
          <dt>Dates</dt>
          <dd className="tabular">
            {assignment.terms.startDate ? formatDate(assignment.terms.startDate) : "—"}
            {" → "}
            {assignment.terms.endDate ? formatDate(assignment.terms.endDate) : "open"}
          </dd>
        </div>
        <div>
          <dt>Client rate</dt>
          <dd className="tabular">
            {assignment.terms.clientRate
              ? `£${assignment.terms.clientRate.amount.toLocaleString("en-GB")} / ${assignment.terms.clientRate.unit}`
              : "—"}
          </dd>
        </div>
      </dl>
    </Drawer>
  );
}
