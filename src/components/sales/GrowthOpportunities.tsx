"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import Button from "@/components/ui/Button";
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
              <article key={insight.id} className={styles.growthCard}>
                <span className={styles.growthKind}>{KIND_LABEL[insight.kind]}</span>
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
                  {insight.opportunityId ? (
                    <>
                      {" · "}
                      <Link href={`/sales/pipeline?opportunity=${insight.opportunityId}`} className={styles.growthLink}>
                        Opportunity
                      </Link>
                    </>
                  ) : null}
                </p>
                <div className={styles.growthActions}>
                  {insight.actions.includes("review") ? (
                    <Link href={insight.accountHref} className={styles.growthLinkBtn}>
                      Review account
                    </Link>
                  ) : null}
                  {insight.actions.includes("followup") ? (
                    <Button size="small" variant={insight.actionLabel === "Assign follow-up" ? "primary" : "secondary"} onClick={() => followUp(insight)}>
                      Assign follow-up
                    </Button>
                  ) : null}
                  {insight.actions.includes("opportunity") ? (
                    <Button size="small" onClick={() => createOpportunity(insight)}>
                      Create opportunity
                    </Button>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
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
