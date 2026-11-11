"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import Button from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Overlay";
import { useWorkspace } from "@/components/shell/WorkspaceContext";
import { crm } from "@/lib/crm-store";
import { addDays, todayKey } from "@/lib/format";
import {
  consultingFollowOnDraft,
  leadSourceSummary,
  salesGrowthInsights,
  type GrowthInsight,
} from "@/lib/sales-growth";
import type { CrmState } from "@/lib/types";
import styles from "@/app/(workspace)/sales/sales.module.css";

const KIND_LABEL: Record<GrowthInsight["kind"], string> = {
  single_owner: "Relationship coverage",
  staffing_no_consulting: "Service expansion",
  network_connection: "Network connection",
};

export default function GrowthOpportunities({ state }: { state: CrmState }) {
  const router = useRouter();
  const { toast, openTaskForm } = useWorkspace();
  const today = todayKey();
  const insights = useMemo(() => salesGrowthInsights(state, today), [state, today]);
  const sources = useMemo(() => leadSourceSummary(state), [state]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [acted, setActed] = useState<Record<string, string>>({});
  const selected = insights.find((item) => item.id === openId) ?? null;

  const followUp = (insight: GrowthInsight) => {
    openTaskForm({
      title: "Assign follow-up",
      evidence: [{ label: insight.evidence, source: "Tessiant relationships", kind: "fact" }],
      initial: {
        title:
          insight.kind === "single_owner"
            ? `Second relationship owner · ${insight.accountName}`
            : `Follow up · ${insight.accountName}`,
        description: `[account:${insight.accountId}] ${insight.detected} ${insight.risk}`,
        priority: "medium",
        due: addDays(5),
        ownerId: "me",
        leadId: insight.leadId,
        accountId: insight.accountId,
        opportunityId: insight.opportunityId,
      },
      onCreated: () => setActed((current) => ({ ...current, [insight.id]: "Follow-up tasked" })),
    });
  };

  const createOpportunity = (insight: GrowthInsight) => {
    const draft = consultingFollowOnDraft(state, insight.accountId);
    if (!draft) {
      toast("Account missing", "error");
      return;
    }
    const id = crm.createOpportunity(draft);
    toast("Consultancy opportunity created — pipeline only, not realised revenue", "success");
    setActed((current) => ({ ...current, [insight.id]: "Opportunity created" }));
    setOpenId(null);
    router.push(`/sales/pipeline?opportunity=${id}`);
  };

  if (insights.length === 0 && sources.every((item) => item.count === 0)) return null;

  return (
    <>
      {insights.length > 0 ? (
        <section className={styles.growthSection} aria-label="Growth opportunities">
          <div className={styles.growthHead}>
            <div>
              <p className="kicker">Qiko</p>
              <h2>Growth opportunities</h2>
            </div>
          </div>
          <div className={styles.growthGrid}>
            {insights.map((insight) => (
              <button key={insight.id} type="button" className={styles.growthCard} onClick={() => setOpenId(insight.id)}>
                <span className={styles.growthKind}>{KIND_LABEL[insight.kind]}</span>
                <p className={styles.growthDetected}>{insight.detected}</p>
                <p className={styles.growthRisk}>{insight.risk}</p>
                <p className={styles.growthActionLine}>{insight.actionLabel}</p>
                {acted[insight.id] ? <span className={styles.growthStatus}>{acted[insight.id]}</span> : null}
              </button>
            ))}
          </div>
          {selected ? (
            <GrowthDrawer
              insight={selected}
              state={state}
              status={acted[selected.id]}
              onClose={() => setOpenId(null)}
              onFollowUp={() => followUp(selected)}
              onOpportunity={() => createOpportunity(selected)}
            />
          ) : null}
        </section>
      ) : null}

      <section className={styles.sourceSection} aria-label="Lead sources">
        <div className={styles.growthHead}>
          <div>
            <h2>Lead sources</h2>
            <p className={styles.sourceSub}>Recorded origin, kept when a lead converts.</p>
          </div>
          <Link href="/sales/leads" className="text-link">
            Leads
          </Link>
        </div>
        <div className={styles.sourceStrip}>
          {sources.map((bucket) => (
            <Link key={bucket.id} href={bucket.href} className={styles.sourceCell}>
              <span>{bucket.label}</span>
              <b className="tabular">{bucket.count}</b>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}

function GrowthDrawer({
  insight,
  state,
  status,
  onClose,
  onFollowUp,
  onOpportunity,
}: {
  insight: GrowthInsight;
  state: CrmState;
  status?: string;
  onClose: () => void;
  onFollowUp: () => void;
  onOpportunity: () => void;
}) {
  const associate = insight.associateId ? state.tessiant?.associates.find((item) => item.id === insight.associateId) : null;
  const opportunity = insight.opportunityId ? state.opportunities.find((item) => item.id === insight.opportunityId) : null;
  const showMap = insight.kind === "network_connection" && Boolean(associate);

  return (
    <Drawer kicker="Qiko" title={insight.accountName} onClose={onClose} width={440}>
      <p className={styles.growthKind}>{KIND_LABEL[insight.kind]}</p>
      <p className={styles.growthDetected}>{insight.detected}</p>
      <p className={styles.growthRisk}>{insight.risk}</p>
      <p className={styles.growthEvidence}>{insight.evidence}</p>
      <p className={styles.growthSource}>
        <Link href={insight.accountHref} className={styles.growthLink}>
          {insight.accountName}
        </Link>
        {insight.assignmentId ? (
          <>
            {" · "}
            <Link href={`/staffing/placements/${insight.assignmentId}`} className={styles.growthLink}>
              Assignment
            </Link>
          </>
        ) : null}
        {opportunity ? (
          <>
            {" · "}
            <Link href={`/sales/pipeline?opportunity=${opportunity.id}`} className={styles.growthLink}>
              {opportunity.name}
            </Link>
          </>
        ) : null}
      </p>
      {showMap && associate ? (
        <div className={styles.relMap} aria-label="Documented connections">
          <span>{associate.name}</span>
          <i />
          <span>{insight.accountName}</span>
          {opportunity ? (
            <>
              <i />
              <span>{opportunity.name}</span>
            </>
          ) : null}
        </div>
      ) : null}
      {status ? <p className={styles.growthStatus}>{status}</p> : null}
      <div className={styles.growthActions}>
        {insight.actions.includes("review") ? (
          <Link href={insight.accountHref} className={styles.growthLinkBtn}>
            Review account
          </Link>
        ) : null}
        {insight.actions.includes("followup") ? (
          <Button size="small" onClick={onFollowUp}>
            Assign follow-up
          </Button>
        ) : null}
        {insight.actions.includes("opportunity") ? (
          <Button size="small" variant="secondary" onClick={onOpportunity}>
            Create opportunity
          </Button>
        ) : null}
      </div>
    </Drawer>
  );
}
