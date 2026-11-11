"use client";

import Link from "next/link";
import Button from "@/components/ui/Button";
import Icon from "@/components/ui/Icon";
import { Drawer } from "@/components/ui/Overlay";
import { useWorkspaceData } from "@/components/ui/bits";
import { useWorkspace } from "@/components/shell/WorkspaceContext";
import { formatDate } from "@/lib/format";
import RecordInsightChip from "@/components/pulse/RecordInsightChip";
import { formatCandidateProgress, mapRequirementToOpsStage } from "@/lib/tessiant-insights";
import { daysOpen, requirementPriority, requisitionCounts } from "@/lib/requisition";
import styles from "@/components/leads/Leads.module.css";

export default function RequirementQuickPanel({
  requirementId,
  onClose,
}: {
  requirementId: string;
  onClose: () => void;
}) {
  const { state } = useWorkspaceData();
  const { askQiko } = useWorkspace();
  if (!state?.tessiant) return null;

  const requirement = state.tessiant.requirements.find((item) => item.id === requirementId);
  if (!requirement) return null;

  const account = state.tessiant.accounts.find((item) => item.id === requirement.accountId);
  const owner = state.members.find((item) => item.id === requirement.ownerId);
  const counts = requisitionCounts(state, requirement.id);
  const priority = requirementPriority(requirement);
  const opsStage = mapRequirementToOpsStage(requirement);

  return (
    <Drawer
      kicker="Requirement"
      title={
        <span className={styles.panelTitle}>
          <span>
            {requirement.title}
            <small>
              {account?.name ?? "Client"} · {requirement.category}
            </small>
          </span>
        </span>
      }
      onClose={onClose}
      width={520}
      footer={
        <Link href={`/staffing/requirements/${requirement.id}`} className={styles.fullProfile} onClick={onClose}>
          Open requirement workspace <Icon name="arrowRight" size={14} />
        </Link>
      }
    >
      <RecordInsightChip requirementId={requirement.id} accountId={requirement.accountId} />

      <div className={styles.panelMeta}>
        <span className="chip chip-dot">{opsStage}</span>
        <span className={`chip ${priority === "high" ? "chip-ai" : ""}`}>{priority}</span>
        <span className="chip tabular">{requirement.headcount} pos</span>
        <span className="chip tabular">{daysOpen(requirement)}d open</span>
      </div>

      <div className={styles.quickActions}>
        <Link href={`/staffing/requirements/${requirement.id}`} onClick={onClose}>
          <Button size="small">Open workspace</Button>
        </Link>
        <Link href={`/staffing/requirements/${requirement.id}`} onClick={onClose}>
          <Button size="small" variant="secondary">
            Candidates
          </Button>
        </Link>
        <Button
          size="small"
          variant="soft"
          icon="sparkles"
          onClick={() => askQiko(`Summarise requirement ${requirement.title} and suggest next staffing actions`)}
        >
          Ask Qiko
        </Button>
      </div>

      <dl className={styles.facts}>
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
          <dt>Owner</dt>
          <dd>{owner?.name ?? "Unassigned"}</dd>
        </div>
        <div>
          <dt>Start</dt>
          <dd>{formatDate(requirement.startDate)}</dd>
        </div>
        <div>
          <dt>Pipeline</dt>
          <dd>{formatCandidateProgress(counts)}</dd>
        </div>
      </dl>

      <p className="muted" style={{ marginTop: 12 }}>
        {requirement.notes || "No brief notes yet."}
      </p>
    </Drawer>
  );
}
