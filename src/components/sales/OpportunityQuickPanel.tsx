"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Button from "@/components/ui/Button";
import Icon from "@/components/ui/Icon";
import { Drawer } from "@/components/ui/Overlay";
import { useWorkspaceData } from "@/components/ui/bits";
import { useWorkspace } from "@/components/shell/WorkspaceContext";
import { crm } from "@/lib/crm-store";
import { formatDate } from "@/lib/format";
import { weightedPipelineValue } from "@/lib/sales-crm";
import styles from "@/components/leads/Leads.module.css";

export default function OpportunityQuickPanel({
  opportunityId,
  onClose,
}: {
  opportunityId: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const { state } = useWorkspaceData();
  const { toast, askQiko } = useWorkspace();
  const opportunity = (state?.opportunities ?? []).find((item) => item.id === opportunityId);
  const [nextStep, setNextStep] = useState(opportunity?.nextStep ?? "");

  useEffect(() => {
    setNextStep(opportunity?.nextStep ?? "");
  }, [opportunity?.id, opportunity?.nextStep]);

  if (!state) return null;
  if (!opportunity) return null;

  const account = state.tessiant?.accounts.find((item) => item.id === opportunity.accountId);
  const owner = state.members.find((item) => item.id === opportunity.ownerId);
  const contact = (state.contacts ?? []).find((item) => item.id === opportunity.contactId);
  const canGenerateRequirement = opportunity.stage === "Closed Won";

  return (
    <Drawer
      kicker="Opportunity"
      title={
        <span className={styles.panelTitle}>
          <span>
            {opportunity.name}
            <small>
              {account?.name ?? "Account"} · {opportunity.type}
            </small>
          </span>
        </span>
      }
      onClose={onClose}
      width={520}
      footer={
        <Link href={`/sales/accounts/${opportunity.accountId}`} className={styles.fullProfile} onClick={onClose}>
          Open account record <Icon name="arrowRight" size={14} />
        </Link>
      }
    >
      <div className={styles.panelMeta}>
        <span className="chip chip-dot">{opportunity.stage}</span>
        <span className="chip tabular">£{opportunity.amount.toLocaleString("en-GB")}</span>
        <span className="chip tabular">{opportunity.probability}% · £{weightedPipelineValue(opportunity).toLocaleString("en-GB")} weighted</span>
        <span className="tag">Close {formatDate(opportunity.expectedCloseDate)}</span>
      </div>

      <div className={styles.quickActions}>
        {canGenerateRequirement && (
          <Button
            size="small"
            onClick={() => {
              const result = crm.createRequirementFromOpportunity(opportunity.id);
              if (!result.ok) {
                toast(result.error, "error");
                return;
              }
              toast("Staffing requirement created from opportunity", "success");
              onClose();
              router.push(`/staffing/requirements/${result.requirementId}`);
            }}
          >
            Generate requirement
          </Button>
        )}
        <Button size="small" variant="secondary" onClick={() => router.push(`/sales/accounts/${opportunity.accountId}`)}>
          View account
        </Button>
        <Button
          size="small"
          variant="soft"
          icon="sparkles"
          onClick={() => askQiko(`Summarise opportunity ${opportunity.name} and recommend the next sales step`)}
        >
          Ask Qiko
        </Button>
      </div>

      <dl className={styles.facts}>
        <div>
          <dt>Next step</dt>
          <dd>
            <div className={styles.quickActions} style={{ marginTop: 0 }}>
              <input
                className="input"
                style={{ flex: 1, minWidth: 0 }}
                value={nextStep}
                onChange={(event) => setNextStep(event.target.value)}
                placeholder="What should happen next?"
                aria-label="Opportunity next step"
              />
              <Button
                size="small"
                variant="secondary"
                disabled={(nextStep.trim() || "") === (opportunity.nextStep ?? "")}
                onClick={() => {
                  const value = nextStep.trim();
                  crm.updateOpportunity(opportunity.id, { nextStep: value || null });
                  toast(value ? "Next step updated" : "Next step cleared", "success");
                }}
              >
                Save
              </Button>
            </div>
          </dd>
        </div>
        <div>
          <dt>Owner</dt>
          <dd>{owner?.name ?? "Unassigned"}</dd>
        </div>
        <div>
          <dt>Contact</dt>
          <dd>{contact?.name ?? "—"}</dd>
        </div>
        <div>
          <dt>Services</dt>
          <dd>{opportunity.services.length ? opportunity.services.join(", ") : "—"}</dd>
        </div>
        {opportunity.stage === "Closed Won" && (
          <>
            <div>
              <dt>Agreed contract</dt>
              <dd className="tabular">£{(opportunity.agreedContractValue ?? opportunity.amount).toLocaleString("en-GB")}</dd>
            </div>
            <div>
              <dt>Expected billing</dt>
              <dd className="tabular">£{(opportunity.expectedBilling ?? 0).toLocaleString("en-GB")}</dd>
            </div>
          </>
        )}
        {opportunity.lostReason && (
          <div>
            <dt>Lost reason</dt>
            <dd>{opportunity.lostReason}</dd>
          </div>
        )}
      </dl>
    </Drawer>
  );
}
