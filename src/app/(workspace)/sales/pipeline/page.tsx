"use client";

import Link from "next/link";
import { useMemo, useState, type DragEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Button from "@/components/ui/Button";
import { EmptyState, SkeletonRows, useWorkspaceData } from "@/components/ui/bits";
import { useWorkspace } from "@/components/shell/WorkspaceContext";
import { crm } from "@/lib/crm-store";
import { formatDate } from "@/lib/format";
import { commercialBuckets, OPPORTUNITY_STAGE_HINTS, weightedPipelineValue } from "@/lib/sales-crm";
import { OPPORTUNITY_STAGES, type Opportunity, type OpportunityStage } from "@/lib/types";
import styles from "./pipeline.module.css";

export default function OpportunitiesPipelinePage() {
  const { state } = useWorkspaceData();
  const { toast } = useWorkspace();
  const router = useRouter();
  const params = useSearchParams();
  const accountFilter = params.get("account");
  const [dragOver, setDragOver] = useState<OpportunityStage | null>(null);
  const [pending, setPending] = useState<{ opportunity: Opportunity; stage: OpportunityStage } | null>(null);

  const opportunities = useMemo(() => {
    if (!state) return [];
    return (state.opportunities ?? []).filter((item) => !accountFilter || item.accountId === accountFilter);
  }, [state, accountFilter]);

  const columns = useMemo(
    () =>
      OPPORTUNITY_STAGES.map((stage) => ({
        stage,
        hint: OPPORTUNITY_STAGE_HINTS[stage],
        items: opportunities.filter((item) => item.stage === stage),
      })),
    [opportunities],
  );

  const buckets = state ? commercialBuckets(state) : null;

  if (!state) {
    return (
      <div className="page">
        <SkeletonRows rows={4} height={120} />
      </div>
    );
  }

  const onDrop = (event: DragEvent, stage: OpportunityStage) => {
    event.preventDefault();
    const id = event.dataTransfer.getData("text/opportunity-id");
    const opportunity = opportunities.find((item) => item.id === id);
    setDragOver(null);
    if (!opportunity || opportunity.stage === stage) return;
    if (stage === "Closed Won" || stage === "Closed Lost") {
      setPending({ opportunity, stage });
      return;
    }
    crm.setOpportunityStage(opportunity.id, stage);
    toast(`Opportunity → ${stage}`, "success");
  };

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Opportunity pipeline</h1>
          <p className="subtitle">
            Salesforce-style stages for consultancy, augmentation and advisory deals. Pipeline value is not recognised revenue.
          </p>
        </div>
        <div className="page-actions">
          {accountFilter && (
            <Button variant="ghost" onClick={() => router.push("/sales/pipeline")}>
              Clear account filter
            </Button>
          )}
          <Link href="/sales/accounts">
            <Button variant="secondary">Accounts</Button>
          </Link>
        </div>
      </header>

      {buckets && (
        <div className={styles.metrics} aria-label="Commercial value distinctions">
          <div>
            <b className="tabular">£{buckets.pipeline.toLocaleString("en-GB")}</b>
            <span>Open pipeline (face value)</span>
          </div>
          <div>
            <b className="tabular">£{buckets.weighted.toLocaleString("en-GB")}</b>
            <span>Weighted pipeline</span>
          </div>
          <div>
            <b className="tabular">£{buckets.agreed.toLocaleString("en-GB")}</b>
            <span>Agreed contract (won)</span>
          </div>
          <div>
            <b className="tabular">£{buckets.expectedBilling.toLocaleString("en-GB")}</b>
            <span>Expected billing</span>
          </div>
          <div>
            <b className="tabular">£{buckets.recognised.toLocaleString("en-GB")}</b>
            <span>Recognised revenue</span>
          </div>
        </div>
      )}

      <section className={styles.board} aria-label="Opportunity stages">
        {columns.map((column) => (
          <div
            key={column.stage}
            className={`${styles.column} ${dragOver === column.stage ? styles.columnOver : ""}`}
            onDragOver={(event) => {
              event.preventDefault();
              setDragOver(column.stage);
            }}
            onDragLeave={() => setDragOver((current) => (current === column.stage ? null : current))}
            onDrop={(event) => onDrop(event, column.stage)}
          >
            <div className={styles.columnHead}>
              <div>
                <span className={styles.columnTitle}>{column.stage}</span>
                <div className={styles.columnHint}>{column.hint}</div>
              </div>
              <span className={styles.columnCount}>{column.items.length}</span>
            </div>
            <div className={styles.columnBody}>
              {column.items.length === 0 ? (
                <div className={styles.columnEmpty}>Drop opportunities here</div>
              ) : (
                column.items.map((opportunity) => {
                  const account = state.tessiant?.accounts.find((item) => item.id === opportunity.accountId);
                  const owner = state.members.find((item) => item.id === opportunity.ownerId);
                  return (
                    <article
                      key={opportunity.id}
                      className={styles.card}
                      draggable
                      onDragStart={(event) => {
                        event.dataTransfer.setData("text/opportunity-id", opportunity.id);
                        event.dataTransfer.effectAllowed = "move";
                      }}
                    >
                      <Link href={`/sales/accounts/${opportunity.accountId}`} className={styles.cardTitle}>
                        {opportunity.name}
                      </Link>
                      <div className={styles.cardMeta}>
                        {account?.name ?? "Account"} · {opportunity.type}
                      </div>
                      <div className={styles.cardMeta}>
                        £{opportunity.amount.toLocaleString("en-GB")} · weighted £
                        {weightedPipelineValue(opportunity).toLocaleString("en-GB")} · {opportunity.probability}%
                      </div>
                      <div className={styles.cardMeta}>
                        Close {formatDate(opportunity.expectedCloseDate)} · {owner?.name ?? "Unassigned"}
                      </div>
                      {opportunity.nextStep && <div className={styles.cardHint}>{opportunity.nextStep}</div>}
                      <div className={styles.cardActions}>
                        {(opportunity.stage === "Closed Won" ||
                          opportunity.stage === "Negotiation" ||
                          opportunity.stage === "Proposal") && (
                          <Button
                            size="small"
                            onClick={() => {
                              const result = crm.createRequirementFromOpportunity(opportunity.id);
                              if (!result.ok) {
                                toast(result.error, "error");
                                return;
                              }
                              toast("Staffing requirement created from opportunity", "success");
                              router.push(`/staffing/requirements/${result.requirementId}`);
                            }}
                          >
                            Generate requirement
                          </Button>
                        )}
                      </div>
                    </article>
                  );
                })
              )}
            </div>
          </div>
        ))}
      </section>

      {pending && (
        <div className={styles.confirm} role="dialog" aria-modal="true">
          <div className={styles.confirmCard}>
            <h2>Move to {pending.stage}?</h2>
            <p className="muted">
              {pending.stage === "Closed Won"
                ? "Agreed contract value is separate from expected billing and recognised revenue."
                : "Capture why the opportunity was lost."}
            </p>
            <div className={styles.cardActions}>
              <Button
                onClick={() => {
                  if (pending.stage === "Closed Won") {
                    crm.setOpportunityStage(pending.opportunity.id, "Closed Won", {
                      agreedContractValue: pending.opportunity.agreedContractValue ?? pending.opportunity.amount,
                      expectedBilling: pending.opportunity.expectedBilling ?? Math.round(pending.opportunity.amount * 0.6),
                      recognisedRevenue: pending.opportunity.recognisedRevenue ?? 0,
                      nextStep: "Hand to delivery / staffing",
                    });
                  } else {
                    crm.setOpportunityStage(pending.opportunity.id, "Closed Lost", {
                      lostReason: "DEMO — closed lost from pipeline",
                      nextStep: null,
                    });
                  }
                  toast(`Opportunity → ${pending.stage}`, "success");
                  setPending(null);
                }}
              >
                Confirm
              </Button>
              <Button variant="ghost" onClick={() => setPending(null)}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {opportunities.length === 0 && <EmptyState title="No opportunities yet" icon="sales" />}
    </div>
  );
}
