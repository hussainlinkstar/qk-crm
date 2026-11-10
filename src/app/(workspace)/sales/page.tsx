"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { addDays, todayKey } from "@/lib/format";
import { commercialBuckets, isOpenLead } from "@/lib/sales-crm";
import { OPPORTUNITY_STAGES, type Opportunity } from "@/lib/types";
import { isOpen, sortTasks } from "@/lib/insights";
import Button from "@/components/ui/Button";
import EntityCard from "@/components/ui/EntityCard";
import { EmptyState, SkeletonRows, useWorkspaceData } from "@/components/ui/bits";
import OpportunityQuickPanel from "@/components/sales/OpportunityQuickPanel";
import { useWorkspace } from "@/components/shell/WorkspaceContext";
import styles from "./sales.module.css";

export default function SalesOverviewPage() {
  const { state, workspace } = useWorkspaceData();
  const { openAddLead, askQiko, openTask } = useWorkspace();
  const [previewId, setPreviewId] = useState<string | null>(null);

  const buckets = state ? commercialBuckets(state) : null;

  const openOpps = useMemo(() => {
    if (!state) return [];
    return (state.opportunities ?? []).filter((item) => item.stage !== "Closed Won" && item.stage !== "Closed Lost");
  }, [state]);

  const closingSoon = useMemo(() => {
    const horizon = addDays(21);
    return [...openOpps]
      .filter((item) => item.expectedCloseDate <= horizon)
      .sort((a, b) => a.expectedCloseDate.localeCompare(b.expectedCloseDate));
  }, [openOpps]);

  const priorityOpps = useMemo(() => {
    const score = (item: Opportunity) => {
      const soon = item.expectedCloseDate <= addDays(14) ? 2 : 0;
      const late = ["Proposal", "Negotiation"].includes(item.stage) ? 2 : 0;
      const value = item.amount >= 100000 ? 1 : 0;
      return soon + late + value + item.probability / 100;
    };
    return [...openOpps].sort((a, b) => score(b) - score(a) || b.amount - a.amount).slice(0, 5);
  }, [openOpps]);

  if (!state || !workspace) {
    return (
      <div className="page">
        <SkeletonRows rows={4} height={110} />
      </div>
    );
  }

  const followUps = sortTasks(
    state.tasks.filter(
      (task) => isOpen(task) && (task.leadId || task.accountId || task.opportunityId || task.contactId),
    ),
  ).slice(0, 5);

  const attentionLeads = workspace.leads
    .filter((lead) => isOpenLead(lead.status) && (lead.openTasks.length > 0 || workspace.suggestions.some((item) => item.leadId === lead.id)))
    .slice(0, 3);

  const stageCounts = OPPORTUNITY_STAGES.map((stage) => ({
    stage,
    count: (state.opportunities ?? []).filter((item) => item.stage === stage).length,
    value: (state.opportunities ?? [])
      .filter((item) => item.stage === stage)
      .reduce((sum, item) => sum + item.amount, 0),
  }));
  const maxStageValue = Math.max(1, ...stageCounts.map((item) => item.value));
  const accountName = (accountId: string) => state.tessiant?.accounts.find((item) => item.id === accountId)?.name ?? "Account";

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Sales overview</h1>
          <p className="subtitle">Pipeline health and next actions.</p>
        </div>
        <div className="page-actions">
          <Button variant="secondary" icon="sparkles" className="mobile-icon-button" aria-label="Summarise today" onClick={() => askQiko("What happened in sales today?")}>
            <span className="mobile-icon-label">Summarise today</span>
          </Button>
          <Button icon="userPlus" className="mobile-icon-button mobile-main-button" aria-label="Add lead" onClick={openAddLead}>
            <span className="mobile-icon-label">Add lead</span>
          </Button>
        </div>
      </header>

      {buckets && (
        <section className="metric-grid metric-grid-4" aria-label="Pipeline health">
          <Link href="/sales/pipeline" className="metric-card">
            <span className="metric-label">Open pipeline</span>
            <b className="tabular kpi-value">£{buckets.pipeline.toLocaleString("en-GB")}</b>
          </Link>
          <Link href="/sales/pipeline" className="metric-card">
            <span className="metric-label">Weighted pipeline</span>
            <b className="tabular kpi-value">£{buckets.weighted.toLocaleString("en-GB")}</b>
          </Link>
          <Link href="/sales/pipeline" className="metric-card">
            <span className="metric-label">Closing soon</span>
            <b className="tabular kpi-value">{closingSoon.length}</b>
          </Link>
          <Link href="/sales/actions" className="metric-card">
            <span className="metric-label">Follow-ups</span>
            <b className="tabular kpi-value">{followUps.length + attentionLeads.length}</b>
          </Link>
        </section>
      )}

      <section className="card">
        <div className="card-head">
          <div>
            <h2>Pipeline by stage</h2>
          </div>
          <Link href="/sales/pipeline" className="text-link">
            Open board
          </Link>
        </div>
        <div className={`card-body ${styles.pipelineViz}`}>
          {stageCounts.map((item) => (
            <Link key={item.stage} href="/sales/pipeline" className={styles.pipelineRow}>
              <span className={styles.pipelineLabel}>{item.stage}</span>
              <span className={styles.pipelineTrack}>
                <i style={{ width: `${Math.max(item.value ? 8 : 0, (item.value / maxStageValue) * 100)}%` }} />
              </span>
              <span className={styles.pipelineMeta}>
                <b className="tabular">{item.count}</b>
                <small className="tabular">£{item.value.toLocaleString("en-GB")}</small>
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section className={styles.split}>
        <article className="card">
          <div className="card-head">
            <h2>Priority opportunities</h2>
            <Link href="/sales/pipeline" className="text-link">
              All
            </Link>
          </div>
          <div className="card-body" style={{ paddingTop: 4, paddingBottom: 8 }}>
            {priorityOpps.length === 0 ? (
              <EmptyState title="No open opportunities" icon="sales" />
            ) : (
              priorityOpps.map((opportunity) => (
                <EntityCard
                  key={opportunity.id}
                  variant="list"
                  title={opportunity.name}
                  subtitle={accountName(opportunity.accountId)}
                  metric={`£${opportunity.amount.toLocaleString("en-GB")}`}
                  hint={`Close ${opportunity.expectedCloseDate}`}
                  meta={<span className="chip chip-dot">{opportunity.stage}</span>}
                  onOpen={() => setPreviewId(opportunity.id)}
                />
              ))
            )}
          </div>
        </article>

        <article className="card">
          <div className="card-head">
            <h2>Upcoming actions</h2>
            <Link href="/sales/actions" className="text-link">
              Activities
            </Link>
          </div>
          <div className="card-body stack-gap">
            {followUps.length === 0 && attentionLeads.length === 0 ? (
              <EmptyState title="No follow-ups due" icon="checkCircle" />
            ) : (
              <>
                {followUps.map((task) => (
                  <button key={task.id} type="button" className={styles.nextAction} onClick={() => openTask(task.id)}>
                    <span className={styles.actionDot} data-priority={task.priority} />
                    <span>
                      <b>{task.title}</b>
                      <small>
                        {task.due ? (task.due < todayKey() ? `Overdue · ${task.due}` : `Due ${task.due}`) : "No due date"}
                      </small>
                    </span>
                  </button>
                ))}
                {attentionLeads.map((lead) => (
                  <Link key={lead.id} href={`/sales/leads/${lead.id}`} className={styles.nextAction}>
                    <span className={styles.actionDot} data-priority="medium" />
                    <span>
                      <b>{lead.nextActionLabel}</b>
                      <small>
                        {lead.name}
                        {lead.company ? ` · ${lead.company}` : ""}
                      </small>
                    </span>
                  </Link>
                ))}
              </>
            )}
          </div>
        </article>
      </section>

      {previewId && <OpportunityQuickPanel opportunityId={previewId} onClose={() => setPreviewId(null)} />}
    </div>
  );
}
