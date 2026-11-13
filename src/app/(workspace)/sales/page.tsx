"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { addDays, formatDate, plural, todayKey } from "@/lib/format";
import { commercialBuckets, isOpenLead } from "@/lib/sales-crm";
import { compactMoney } from "@/lib/home-tessiant";
import { opportunityBrief } from "@/lib/record-intelligence";
import { isOpen, sortTasks } from "@/lib/insights";
import Button from "@/components/ui/Button";
import BarList from "@/components/ui/BarList";
import CountUp from "@/components/ui/CountUp";
import IconTile from "@/components/ui/IconTile";
import Icon, { type IconName } from "@/components/ui/Icon";

const DEAL_TYPE_ICON: Record<string, IconName> = {
  augmentation: "users",
  consultancy: "compass",
  advisory: "star",
  "project team": "layers",
  mixed: "layers",
};

/** Collapse the brief's "why" into one short chip so the row reads at a glance. */
function dealSignalChip(why: string): { label: string; chip: string } {
  if (why.startsWith("Coverage")) return { label: "Coverage gap", chip: "chip-high" };
  if (why.startsWith("Closing")) return { label: why, chip: "chip-new" };
  if (why.startsWith("Stalled")) return { label: "Stalled", chip: "chip-medium" };
  if (why.startsWith("Advisory")) return { label: "Advisory · pipeline only", chip: "chip-ai" };
  return { label: why.split(" · ")[0], chip: "" };
}
import { EmptyState, SkeletonRows, useWorkspaceData } from "@/components/ui/bits";
import { OPPORTUNITY_STAGES } from "@/lib/types";
import OpportunityQuickPanel from "@/components/sales/OpportunityQuickPanel";
import GrowthOpportunities from "@/components/sales/GrowthOpportunities";
import JourneysInFlight from "@/components/journey/JourneysInFlight";
import PricingIntelligence from "@/components/sales/PricingIntelligence";
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
  const stageRows = OPPORTUNITY_STAGES.filter((stage) => stage !== "Closed Won" && stage !== "Closed Lost").map((stage) => {
    const items = openOpps.filter((item) => item.stage === stage);
    const amount = items.reduce((sum, item) => sum + item.amount, 0);
    return {
      key: stage,
      label: stage,
      value: amount,
      display: compactMoney(amount),
      caption: items.length ? plural(items.length, "deal") : "empty",
      href: "/sales/pipeline",
    };
  });

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
        <section className="metric-grid metric-grid-4" aria-label="Commercial position">
          <Link href="/sales/pipeline" className="metric-card">
            <IconTile name="trendUp" tone="brand" className="metric-icon" />
            <span className="metric-label">Open pipeline</span>
            <b className="tabular">
              <CountUp value={buckets.pipeline} format={(n) => compactMoney(n)} />
            </b>
            <span className="metric-delta">
              {plural(openOpps.length, "deal")} · {closingSoon} closing in 21d
            </span>
          </Link>
          <Link href="/sales/pipeline" className="metric-card">
            <IconTile name="chart" tone="info" className="metric-icon" />
            <span className="metric-label">Weighted pipeline</span>
            <b className="tabular">
              <CountUp value={buckets.weighted} format={(n) => compactMoney(n)} />
            </b>
            <span className="metric-delta">Amount × stage probability</span>
          </Link>
          <Link href="/sales/pipeline" className="metric-card">
            <IconTile name="handshake" tone="success" className="metric-icon" />
            <span className="metric-label">Agreed contracts</span>
            <b className="tabular">
              <CountUp value={buckets.agreed} format={(n) => compactMoney(n)} />
            </b>
            <span className="metric-delta">Closed won · not yet recognised</span>
          </Link>
          <Link href="/sales/actions" className="metric-card">
            <IconTile name="tasks" tone="warning" className="metric-icon" />
            <span className="metric-label">Follow-ups due</span>
            <b className="tabular">
              <CountUp value={followUps.length + attentionLeads.length} />
            </b>
            <span className={`metric-delta ${buckets.recognised > 0 ? "positive" : ""}`}>
              Recognised revenue {compactMoney(buckets.recognised)}
            </span>
          </Link>
        </section>
      )}

      <GrowthOpportunities state={state} onOpenOpportunity={(opportunity) => setPreviewId(opportunity.id)} />

      <JourneysInFlight state={state} limit={3} />

      <div className={styles.overviewGrid}>
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
                <span>Signal</span>
                <span>Next step</span>
              </div>
              {nextDeals.map((opportunity) => {
                const brief = opportunityBrief(state, opportunity);
                const signal = dealSignalChip(brief.why);
                return (
                  <button
                    key={opportunity.id}
                    type="button"
                    className={styles.dealsRow}
                    role="row"
                    onClick={() => setPreviewId(opportunity.id)}
                  >
                    <span className={styles.dealCell}>
                      <IconTile name={DEAL_TYPE_ICON[brief.type] ?? "layers"} tone="muted" size="sm" />
                      <span className={styles.dealCopy}>
                        <b>{opportunity.name}</b>
                        <small>
                          {accountName(opportunity.accountId)} · {compactMoney(opportunity.amount)} · {brief.type}
                        </small>
                      </span>
                    </span>
                    <span className={styles.dealSignal}>
                      <span className={`chip ${signal.chip}`}>{signal.label}</span>
                      {brief.missing !== "Nothing blocking" ? <small>{brief.missing}</small> : null}
                    </span>
                    <span className={styles.dealNext}>
                      {brief.next}
                      <Icon name="arrowRight" size={13} />
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <section className="card">
        <div className="card-head">
          <div>
            <h2>Pipeline by stage</h2>
            <p className="card-sub">
              Open amount per stage. Weighted total {buckets ? compactMoney(buckets.weighted) : "—"}. Not revenue.
            </p>
          </div>
        </div>
        <div className="card-body">
          <BarList rows={stageRows} label="Open pipeline by stage" />
        </div>
      </section>
      </div>

      <PricingIntelligence state={state} />

      <section className="card">
        <div className="card-head">
          <h2>Upcoming actions</h2>
          <Link href="/sales/actions" className="text-link">
            Activities
          </Link>
        </div>
        <div className="card-body">
          {followUps.length === 0 && attentionLeads.length === 0 ? (
            <EmptyState title="No follow-ups due" icon="checkCircle" />
          ) : (
            <div className={styles.actionGrid}>
              {followUps.map((task) => {
                const overdue = Boolean(task.due && task.due < todayKey());
                return (
                  <button key={task.id} type="button" className={styles.nextAction} onClick={() => openTask(task.id)}>
                    <span className={styles.actionDot} data-priority={task.priority} />
                    <span className={styles.actionCopy}>
                      <b>{task.title}</b>
                    </span>
                    <span className={styles.actionWhen} data-overdue={overdue ? "true" : "false"}>
                      {task.due ? (overdue ? `Overdue · ${formatDate(task.due)}` : formatDate(task.due)) : "No date"}
                    </span>
                  </button>
                );
              })}
              {attentionLeads.map((lead) => (
                <Link key={lead.id} href={`/sales/leads/${lead.id}`} className={styles.nextAction}>
                  <span className={styles.actionDot} data-priority="medium" />
                  <span className={styles.actionCopy}>
                    <b>{lead.nextActionLabel}</b>
                    <small>
                      {lead.name}
                      {lead.company ? ` · ${lead.company}` : ""}
                    </small>
                  </span>
                  <span className={styles.actionWhen}>Lead</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      {previewId && <OpportunityQuickPanel opportunityId={previewId} onClose={() => setPreviewId(null)} />}
    </div>
  );
}
