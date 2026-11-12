"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import Button from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Overlay";
import { useWorkspace } from "@/components/shell/WorkspaceContext";
import { crm } from "@/lib/crm-store";
import { addDays, todayKey } from "@/lib/format";
import { opportunityBrief } from "@/lib/record-intelligence";
import {
  consultingFollowOnDraft,
  leadSourceSummary,
  salesGrowthInsights,
  type GrowthInsight,
} from "@/lib/sales-growth";
import type { CrmState, Opportunity } from "@/lib/types";
import styles from "@/app/(workspace)/sales/sales.module.css";

const KIND_LABEL: Record<GrowthInsight["kind"], string> = {
  single_owner: "Relationship coverage",
  staffing_no_consulting: "Service expansion",
  network_connection: "Network connection",
};

const MAX_DEAL_INSIGHTS = 3;

function dealSignal(why: string) {
  if (why.startsWith("Coverage")) return "Coverage";
  if (why.startsWith("Stalled")) return "Stalled";
  if (why.startsWith("Closing")) return "Closing";
  if (why.startsWith("Advisory")) return "Advisory";
  return "Deal";
}

function dealInsightScore(why: string, missing: string) {
  return (
    (why.startsWith("Coverage") ? 4 : 0) +
    (why.startsWith("Stalled") ? 3 : 0) +
    (why.startsWith("Closing") ? 2 : 0) +
    (missing !== "Nothing blocking" ? 1 : 0)
  );
}

function isDealSignal(why: string, missing: string) {
  return (
    why.startsWith("Coverage") ||
    why.startsWith("Stalled") ||
    why.startsWith("Closing") ||
    why.startsWith("Advisory") ||
    missing !== "Nothing blocking"
  );
}

function openDealInsights(state: CrmState) {
  const open = (state.opportunities ?? []).filter(
    (item) => item.stage !== "Closed Won" && item.stage !== "Closed Lost",
  );
  return open
    .map((opportunity) => {
      const brief = opportunityBrief(state, opportunity);
      return { opportunity, brief, score: dealInsightScore(brief.why, brief.missing) };
    })
    .filter((item) => isDealSignal(item.brief.why, item.brief.missing))
    .sort(
      (a, b) =>
        b.score - a.score || a.opportunity.expectedCloseDate.localeCompare(b.opportunity.expectedCloseDate),
    )
    .slice(0, MAX_DEAL_INSIGHTS);
}

export default function GrowthOpportunities({
  state,
  onOpenOpportunity,
}: {
  state: CrmState;
  onOpenOpportunity?: (opportunity: Opportunity) => void;
}) {
  const router = useRouter();
  const { toast, openTaskForm } = useWorkspace();
  const today = todayKey();
  const insights = useMemo(() => salesGrowthInsights(state, today), [state, today]);
  const dealInsights = useMemo(() => openDealInsights(state), [state]);
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

  const accountName = (accountId: string) =>
    state.tessiant?.accounts.find((item) => item.id === accountId)?.name ?? "Account";

  if (insights.length === 0 && dealInsights.length === 0 && sources.every((item) => item.count === 0)) return null;

  return (
    <>
      {insights.length > 0 || dealInsights.length > 0 ? (
        <section className={styles.growthSection} aria-label="Insights">
          <div className={styles.growthHead}>
            <div>
              <p className="kicker">Qiko</p>
              <h2>Insights</h2>
              <p className={styles.sourceSub}>Signals on open deals and recorded relationships.</p>
            </div>
          </div>
          <div className={styles.growthGrid}>
            {dealInsights.map(({ opportunity, brief }) => (
              <button
                key={opportunity.id}
                type="button"
                className={styles.growthCard}
                onClick={() => onOpenOpportunity?.(opportunity)}
              >
                <span className={styles.growthKind}>{dealSignal(brief.why)}</span>
                <p className={styles.growthDetected}>{opportunity.name}</p>
                <p className={styles.growthRisk}>{brief.why}</p>
                <p className={styles.growthEvidence}>
                  {accountName(opportunity.accountId)}
                  {brief.missing !== "Nothing blocking" ? ` · ${brief.missing}` : ""}
                </p>
                <p className={styles.growthActionLine}>{brief.next}</p>
              </button>
            ))}
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
  const nextStep =
    insight.kind === "single_owner"
      ? "Add a second senior relationship owner to reduce account dependency."
      : insight.kind === "staffing_no_consulting"
        ? "Review the recorded delivery context before qualifying a consulting follow-on."
        : "Use the recorded assignment as context for a careful client follow-up.";

  return (
    <Drawer
      kicker="Qiko"
      title={insight.accountName}
      onClose={onClose}
      width={480}
      footer={
        <div className={styles.insightFooter}>
          {insight.actions.includes("review") ? (
            <Link href={insight.accountHref} className={styles.insightSecondary}>
              Review account
            </Link>
          ) : null}
          {insight.actions.includes("followup") ? <Button onClick={onFollowUp}>Assign follow-up</Button> : null}
          {insight.actions.includes("opportunity") ? (
            <Button variant="secondary" onClick={onOpportunity}>
              Create opportunity
            </Button>
          ) : null}
        </div>
      }
    >
      <div className={styles.insightDrawer}>
        <section className={styles.insightHero}>
          <div className={styles.insightKindRow}>
            <span className={styles.insightKindBadge}>{KIND_LABEL[insight.kind]}</span>
            <span className={styles.insightSignal}>Recorded signal</span>
          </div>
          <h3>{insight.detected}</h3>
          <p>{insight.risk}</p>
        </section>

        <section className={styles.insightEvidence}>
          <span>Recorded evidence</span>
          <p>{insight.evidence}</p>
        </section>

        {showMap && associate ? (
          <section className={styles.path} aria-label="Documented connections">
            <h3>Documented connection</h3>
            <ol>
              <li>
                <Link href={`/staffing/associates/${associate.id}`}>
                  <b>{associate.name}</b>
                  <span>Associate</span>
                </Link>
              </li>
              <li>
                <Link href={insight.accountHref}>
                  <b>{insight.accountName}</b>
                  <span>Account</span>
                </Link>
              </li>
              {opportunity ? (
                <li>
                  <Link href={`/sales/pipeline?opportunity=${opportunity.id}`}>
                    <b>{opportunity.name}</b>
                    <span>Opportunity</span>
                  </Link>
                </li>
              ) : null}
            </ol>
            {insight.assignmentId ? (
              <Link href={`/staffing/placements/${insight.assignmentId}`} className={styles.pathLink}>
                Open recorded assignment
              </Link>
            ) : null}
          </section>
        ) : (
          <div className={styles.recordList}>
            <Link href={insight.accountHref}>
              <b>{insight.accountName}</b>
              <small>Account</small>
            </Link>
            {opportunity ? (
              <Link href={`/sales/pipeline?opportunity=${opportunity.id}`}>
                <b>{opportunity.name}</b>
                <small>Opportunity</small>
              </Link>
            ) : null}
          </div>
        )}

        <section className={styles.insightNextStep}>
          <span>Recommended next step</span>
          <h3>{insight.actionLabel}</h3>
          <p>{nextStep}</p>
        </section>

        {status ? <p className={styles.growthStatus}>{status}</p> : null}
      </div>
    </Drawer>
  );
}
