"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { addDays, todayKey } from "@/lib/format";
import { commercialBuckets, isOpenLead } from "@/lib/sales-crm";
import { opportunityBrief } from "@/lib/record-intelligence";
import { isOpen, sortTasks } from "@/lib/insights";
import Button from "@/components/ui/Button";
import { EmptyState, SkeletonRows, useWorkspaceData } from "@/components/ui/bits";
import OpportunityQuickPanel from "@/components/sales/OpportunityQuickPanel";
import GrowthOpportunities from "@/components/sales/GrowthOpportunities";
import { useWorkspace } from "@/components/shell/WorkspaceContext";
import styles from "./sales.module.css";

export default function SalesOverviewPage() {
  const { state, workspace } = useWorkspaceData();
  const { openAddLead, openTask } = useWorkspace();
  const [previewId, setPreviewId] = useState<string | null>(null);

  const buckets = state ? commercialBuckets(state) : null;

  const openOpps = useMemo(() => {
    if (!state) return [];
    return (state.opportunities ?? []).filter((item) => item.stage !== "Closed Won" && item.stage !== "Closed Lost");
  }, [state]);

  const nextDeals = useMemo(() => {
    if (!state) return [];
    const horizon = addDays(21);
    const score = (item: (typeof openOpps)[number]) => {
      const brief = opportunityBrief(state, item);
      const soon = item.expectedCloseDate <= horizon ? 2 : 0;
      const stalled = brief.why.startsWith("Stalled") ? 3 : 0;
      const coverage = brief.missing.includes("0 verified") ? 3 : 0;
      return soon + stalled + coverage + (["Proposal", "Negotiation"].includes(item.stage) ? 1 : 0);
    };
    return [...openOpps].sort((a, b) => score(b) - score(a) || a.expectedCloseDate.localeCompare(b.expectedCloseDate)).slice(0, 8);
  }, [openOpps, state]);

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

  const accountName = (accountId: string) => state.tessiant?.accounts.find((item) => item.id === accountId)?.name ?? "Account";
  const closingSoon = openOpps.filter((item) => item.expectedCloseDate <= addDays(21)).length;

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Sales overview</h1>
          <p className="subtitle">Next deals with why, what is missing, and the next step.</p>
        </div>
        <div className="page-actions">
          <Button icon="userPlus" className="mobile-icon-button mobile-main-button" aria-label="Add lead" onClick={openAddLead}>
            <span className="mobile-icon-label">Add lead</span>
          </Button>
        </div>
      </header>

      {buckets && (
        <p className="muted">
          Open pipeline <b className="tabular">£{buckets.pipeline.toLocaleString("en-GB")}</b>
          {" · "}
          Weighted <b className="tabular">£{buckets.weighted.toLocaleString("en-GB")}</b>
          {" · "}
          Closing soon <b className="tabular">{closingSoon}</b>
          {" · "}
          Follow-ups <b className="tabular">{followUps.length + attentionLeads.length}</b>
        </p>
      )}

      <GrowthOpportunities state={state} />

      <section className="card">
        <div className="card-head">
          <h2>Next deals</h2>
          <Link href="/sales/pipeline" className="text-link">
            Open board
          </Link>
        </div>
        <div className="card-body" style={{ paddingTop: 4 }}>
          {nextDeals.length === 0 ? (
            <EmptyState title="No open opportunities" icon="sales" />
          ) : (
            <div className={styles.dealsTable} role="table" aria-label="Next deals">
              <div className={styles.dealsHead} role="row">
                <span>Deal</span>
                <span>Type</span>
                <span>Why</span>
                <span>Missing</span>
                <span>Next</span>
              </div>
              {nextDeals.map((opportunity) => {
                const brief = opportunityBrief(state, opportunity);
                return (
                  <button
                    key={opportunity.id}
                    type="button"
                    className={styles.dealsRow}
                    role="row"
                    onClick={() => setPreviewId(opportunity.id)}
                  >
                    <span>
                      <b>{opportunity.name}</b>
                      <small>
                        {accountName(opportunity.accountId)} · £{opportunity.amount.toLocaleString("en-GB")}
                      </small>
                    </span>
                    <span className="chip">{brief.type}</span>
                    <span>{brief.why}</span>
                    <span className="muted">{brief.missing}</span>
                    <span>{brief.next}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <section className="card">
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
      </section>

      {previewId && <OpportunityQuickPanel opportunityId={previewId} onClose={() => setPreviewId(null)} />}
    </div>
  );
}
