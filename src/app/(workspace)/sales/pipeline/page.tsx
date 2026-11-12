"use client";

import Link from "next/link";
import { useMemo, useState, type DragEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Button from "@/components/ui/Button";
import { EmptyState, MemberAvatar, SkeletonRows, useWorkspaceData } from "@/components/ui/bits";
import OpportunityQuickPanel from "@/components/sales/OpportunityQuickPanel";
import { useWorkspace } from "@/components/shell/WorkspaceContext";
import { crm } from "@/lib/crm-store";
import { addDays, formatDate, todayKey } from "@/lib/format";
import { opportunitySignal } from "@/lib/commercial-intelligence";
import { OPPORTUNITY_STAGES, type Opportunity, type OpportunityStage } from "@/lib/types";
import styles from "./pipeline.module.css";

export default function OpportunitiesPipelinePage() {
  const { state } = useWorkspaceData();
  const { toast } = useWorkspace();
  const router = useRouter();
  const params = useSearchParams();
  const accountFilter = params.get("account");
  const opportunityParam = params.get("opportunity");
  const [layout, setLayout] = useState<"board" | "list">("board");
  const [dragOver, setDragOver] = useState<OpportunityStage | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [pending, setPending] = useState<{ opportunity: Opportunity; stage: OpportunityStage } | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(opportunityParam);
  const [createRequirement, setCreateRequirement] = useState(true);

  const opportunities = useMemo(() => {
    if (!state) return [];
    return (state.opportunities ?? []).filter((item) => !accountFilter || item.accountId === accountFilter);
  }, [state, accountFilter]);

  const columns = useMemo(
    () =>
      OPPORTUNITY_STAGES.map((stage) => ({
        stage,
        items: opportunities.filter((item) => item.stage === stage),
      })),
    [opportunities],
  );

  const openOpportunities = opportunities.filter((item) => item.stage !== "Closed Won" && item.stage !== "Closed Lost");
  const negotiationOpportunities = opportunities.filter((item) => item.stage === "Negotiation");
  const closedOpportunities = opportunities.filter((item) => item.stage === "Closed Won" || item.stage === "Closed Lost");
  const focusOpportunity =
    negotiationOpportunities[0] ??
    opportunities.find((item) => item.stage === "Proposal") ??
    opportunities.find((item) => item.stage === "Discovery") ??
    openOpportunities[0] ??
    null;

  if (!state) {
    return (
      <div className="page">
        <SkeletonRows rows={4} height={120} />
      </div>
    );
  }

  const accountName = (accountId: string) => state.tessiant?.accounts.find((item) => item.id === accountId)?.name ?? "Account";
  const ownerOf = (ownerId: string | null) => state.members.find((item) => item.id === ownerId) ?? null;

  const onDrop = (event: DragEvent, stage: OpportunityStage) => {
    event.preventDefault();
    const id = event.dataTransfer.getData("text/opportunity-id");
    const opportunity = opportunities.find((item) => item.id === id);
    setDragOver(null);
    setDraggingId(null);
    if (!opportunity || opportunity.stage === stage) return;
    if (stage === "Closed Won" || stage === "Closed Lost") {
      setCreateRequirement(true);
      setPending({ opportunity, stage });
      return;
    }
    crm.setOpportunityStage(opportunity.id, stage);
    toast(`Opportunity → ${stage}`, "success");
  };

  const confirmPending = () => {
    if (!pending) return;
    if (pending.stage === "Closed Won") {
      crm.setOpportunityStage(pending.opportunity.id, "Closed Won", {
        agreedContractValue: pending.opportunity.agreedContractValue ?? pending.opportunity.amount,
        expectedBilling: pending.opportunity.expectedBilling ?? Math.round(pending.opportunity.amount * 0.6),
        recognisedRevenue: pending.opportunity.recognisedRevenue ?? 0,
        nextStep: "Hand to delivery / staffing",
      });
      toast("Opportunity → Closed Won", "success");
      if (createRequirement) {
        const result = crm.createRequirementFromOpportunity(pending.opportunity.id);
        if (result.ok) {
          toast("Staffing requirement created", "success");
          setPending(null);
          router.push(`/staffing/requirements/${result.requirementId}`);
          return;
        }
        toast(result.error, "error");
      }
    } else {
      crm.setOpportunityStage(pending.opportunity.id, "Closed Lost", {
        lostReason: "Closed from pipeline",
        nextStep: null,
      });
      toast("Opportunity → Closed Lost", "success");
    }
    setPending(null);
  };

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Opportunities</h1>
          <p className="subtitle">Consultancy pipeline by stage.</p>
        </div>
        <div className="page-actions">
          {accountFilter && (
            <Button variant="ghost" onClick={() => router.push("/sales/pipeline")}>
              Clear account filter
            </Button>
          )}
          <div className="segmented" role="group" aria-label="Layout">
            <button type="button" aria-pressed={layout === "board"} onClick={() => setLayout("board")}>
              Board
            </button>
            <button type="button" aria-pressed={layout === "list"} onClick={() => setLayout("list")}>
              List
            </button>
          </div>
          <Link href="/sales/accounts">
            <Button variant="secondary">Accounts</Button>
          </Link>
        </div>
      </header>

      <div className={styles.metrics} aria-label="Pipeline health">
          <div>
            <b className="tabular kpi-value">{openOpportunities.length}</b>
            <span>Open deals · £{openOpportunities.reduce((sum, item) => sum + item.amount, 0).toLocaleString("en-GB")}</span>
          </div>
          <div>
            <b className="tabular kpi-value">{negotiationOpportunities.length}</b>
            <span>Under negotiation · £{negotiationOpportunities.reduce((sum, item) => sum + item.amount, 0).toLocaleString("en-GB")}</span>
          </div>
          <div>
            <b className="tabular kpi-value">{closedOpportunities.length}</b>
            <span>
              Closed deals · {opportunities.filter((item) => item.stage === "Closed Won").length} won,{" "}
              {opportunities.filter((item) => item.stage === "Closed Lost").length} lost
            </span>
          </div>
          <div>
            <b className="tabular kpi-value">
              {
                opportunities.filter(
                  (item) =>
                    item.expectedCloseDate >= todayKey() &&
                    item.expectedCloseDate <= addDays(21) &&
                    item.stage !== "Closed Won" &&
                    item.stage !== "Closed Lost",
                ).length
              }
            </b>
            <span>Closing in 21 days</span>
          </div>
      </div>

      {focusOpportunity && (
        <button type="button" className={styles.pipelineInsight} onClick={() => setPreviewId(focusOpportunity.id)}>
          <span>
            <small>Pipeline insight</small>
            <b>
              {negotiationOpportunities.length > 0
                ? `${negotiationOpportunities.length} ${negotiationOpportunities.length === 1 ? "deal is" : "deals are"} in negotiation`
                : `${openOpportunities.length} open ${openOpportunities.length === 1 ? "deal" : "deals"} need progression`}
            </b>
          </span>
          <span>
            {focusOpportunity.name}: {focusOpportunity.nextStep?.trim() || `Set the next action to progress from ${focusOpportunity.stage}.`}
          </span>
          <span aria-hidden="true">→</span>
        </button>
      )}

      {layout === "board" ? (
        <section className={`kanban-board ${styles.board}`} aria-label="Opportunity stages">
          {columns.map((column) => (
            <div
              key={column.stage}
              className={`kanban-column ${styles.column} ${dragOver === column.stage ? styles.columnOver : ""}`}
              data-over={dragOver === column.stage ? "true" : undefined}
              onDragOver={(event) => {
                event.preventDefault();
                setDragOver(column.stage);
              }}
              onDragLeave={() => setDragOver((current) => (current === column.stage ? null : current))}
              onDrop={(event) => onDrop(event, column.stage)}
            >
              <div className={styles.columnHead}>
                <span className={styles.columnTitle}>{column.stage}</span>
                <span className={styles.columnCount}>{column.items.length}</span>
              </div>
              <div className={styles.columnBody}>
                {column.items.length === 0 ? (
                  <div className={styles.columnEmpty}>Drop here</div>
                ) : (
                  column.items.map((opportunity) => {
                    const owner = ownerOf(opportunity.ownerId);
                    const risk = opportunitySignal(state, opportunity);
                    return (
                      <article
                        key={opportunity.id}
                        className={`kanban-card ${styles.oppCard} ${draggingId === opportunity.id ? styles.oppCardDragging : ""}`}
                        draggable
                        onDragStart={(event) => {
                          event.dataTransfer.setData("text/opportunity-id", opportunity.id);
                          event.dataTransfer.effectAllowed = "move";
                          setDraggingId(opportunity.id);
                        }}
                        onDragEnd={() => {
                          setDraggingId(null);
                          setDragOver(null);
                        }}
                        onClick={() => setPreviewId(opportunity.id)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            setPreviewId(opportunity.id);
                          }
                        }}
                        role="button"
                        tabIndex={0}
                      >
                        <div className={styles.oppTop}>
                          <b className={styles.oppTitle}>{opportunity.name}</b>
                          <span className="tabular">£{opportunity.amount.toLocaleString("en-GB")}</span>
                        </div>
                        <div className={styles.oppAccount}>{accountName(opportunity.accountId)}</div>
                        <div className={styles.oppFoot}>
                          <span className={styles.oppOwner}>
                            <MemberAvatar member={owner} />
                            <span>{owner?.name ?? "Unassigned"}</span>
                          </span>
                          <span className={styles.oppClose}>{formatDate(opportunity.expectedCloseDate)}</span>
                        </div>
                        {risk ? <span className={styles.risk}>{risk}</span> : null}
                      </article>
                    );
                  })
                )}
              </div>
            </div>
          ))}
        </section>
      ) : (
        <section className="card">
          <div className="card-body" style={{ padding: 0 }}>
            {opportunities.length === 0 ? (
              <EmptyState title="No opportunities yet" icon="sales" />
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Opportunity</th>
                      <th>Account</th>
                      <th>Stage</th>
                      <th>Value</th>
                      <th>Close</th>
                      <th>Owner</th>
                    </tr>
                  </thead>
                  <tbody>
                    {opportunities.map((opportunity) => {
                      const owner = ownerOf(opportunity.ownerId);
                      const risk = opportunitySignal(state, opportunity);
                      return (
                        <tr key={opportunity.id} className="clickable" onClick={() => setPreviewId(opportunity.id)}>
                          <td>
                            <div className={styles.oppNameCell}>
                              <b>{opportunity.name}</b>
                              {risk ? <span className={styles.risk}>{risk}</span> : null}
                            </div>
                          </td>
                          <td>{accountName(opportunity.accountId)}</td>
                          <td>
                            <span className="chip chip-dot">{opportunity.stage}</span>
                          </td>
                          <td className="tabular">£{opportunity.amount.toLocaleString("en-GB")}</td>
                          <td className={opportunity.expectedCloseDate < todayKey() && opportunity.stage !== "Closed Won" && opportunity.stage !== "Closed Lost" ? styles.overdueText : undefined}>
                            {formatDate(opportunity.expectedCloseDate)}
                          </td>
                          <td>{owner?.name ?? "Unassigned"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      )}

      {pending && (
        <div className={styles.confirm} role="dialog" aria-modal="true">
          <div className={styles.confirmCard}>
            <h2>Move to {pending.stage}?</h2>
            <p className="muted">
              {pending.stage === "Closed Won"
                ? "Confirm the win. You can create a staffing requirement from this deal."
                : "This marks the opportunity as lost."}
            </p>
            {pending.stage === "Closed Won" && (
              <label className={styles.confirmCheck}>
                <input type="checkbox" checked={createRequirement} onChange={(event) => setCreateRequirement(event.target.checked)} />
                Create staffing requirement
              </label>
            )}
            <div className={styles.cardActions}>
              <Button onClick={confirmPending}>Confirm</Button>
              <Button variant="ghost" onClick={() => setPending(null)}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {previewId && (
        <OpportunityQuickPanel
          opportunityId={previewId}
          onClose={() => {
            setPreviewId(null);
            if (opportunityParam) {
              const next = new URLSearchParams(params.toString());
              next.delete("opportunity");
              router.replace(`/sales/pipeline${next.size ? `?${next}` : ""}`, { scroll: false });
            }
          }}
        />
      )}
    </div>
  );
}
