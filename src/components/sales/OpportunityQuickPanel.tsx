"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import Button from "@/components/ui/Button";
import Icon from "@/components/ui/Icon";
import { Drawer } from "@/components/ui/Overlay";
import { useWorkspaceData } from "@/components/ui/bits";
import { useWorkspace } from "@/components/shell/WorkspaceContext";
import RecordInsightChip from "@/components/pulse/RecordInsightChip";
import { crm } from "@/lib/crm-store";
import { formatDate } from "@/lib/format";
import { staffingCoveragePreview } from "@/lib/record-intelligence";
import { opportunityInsight } from "@/lib/record-insights";
import RecordInsight from "@/components/ui/RecordInsight";
import DealJourney from "@/components/journey/DealJourney";
import CapacityCheck from "@/components/sales/CapacityCheck";
import { needsCapacityCheck } from "@/lib/capacity-check";
import { dealJourneyFor } from "@/lib/deal-journey";
import { salesRelationshipIntel } from "@/lib/sales-relationship";
import RelationshipIntelligence from "@/components/sales/RelationshipIntelligence";
import RecommendedMatches from "@/components/staffing/RecommendedMatches";
import { weightedPipelineValue } from "@/lib/sales-crm";
import styles from "@/components/leads/Leads.module.css";
import salesStyles from "@/app/(workspace)/sales/sales.module.css";

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
  // Re-seed the draft when the record (or its stored next step) changes; adjusted during render, not in an effect.
  const seedKey = `${opportunity?.id ?? ""}|${opportunity?.nextStep ?? ""}`;
  const [seenSeed, setSeenSeed] = useState(seedKey);
  if (seedKey !== seenSeed) {
    setSeenSeed(seedKey);
    setNextStep(opportunity?.nextStep ?? "");
  }

  if (!state) return null;
  if (!opportunity) return null;

  const account = state.tessiant?.accounts.find((item) => item.id === opportunity.accountId);
  const owner = state.members.find((item) => item.id === opportunity.ownerId);
  const contact = (state.contacts ?? []).find((item) => item.id === opportunity.contactId);
  const canGenerateRequirement = opportunity.stage === "Closed Won";
  const coverage = staffingCoveragePreview(state, opportunity);
  const relationship = salesRelationshipIntel(state, { opportunityId });
  const linkedRequirement = (state.tessiant?.requirements ?? []).find((item) => item.linkedOpportunityId === opportunity.id);

  return (
    <Drawer
      kicker="Opportunity"
      title={
        <span className={styles.panelTitle}>
          <span>
            {opportunity.name}
            <small>
              {account?.name ?? "Account"} · <span className={salesStyles.oppType}>{opportunity.type}</span>
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
      <div className={salesStyles.oppPanel}>
        <div className={salesStyles.oppStats}>
          <div className={salesStyles.oppStat}>
            <span>Stage</span>
            <b>{opportunity.stage}</b>
          </div>
          <div className={salesStyles.oppStat}>
            <span>Close</span>
            <b>{formatDate(opportunity.expectedCloseDate)}</b>
          </div>
          <div className={salesStyles.oppStat}>
            <span>Value</span>
            <b className="tabular">£{opportunity.amount.toLocaleString("en-GB")}</b>
          </div>
          <div className={salesStyles.oppStat}>
            <span>Weighted</span>
            <b className="tabular">
              {opportunity.probability}% · £{weightedPipelineValue(opportunity).toLocaleString("en-GB")}
            </b>
          </div>
        </div>

        <RecordInsight
          subject="deal"
          data={opportunityInsight(state, opportunity)}
          actions={
            <Button size="small" variant="qiko" icon="sparkles" onClick={() => askQiko(`Summarise opportunity ${opportunity.name} and recommend the next sales step`)}>
              Ask Qiko
            </Button>
          }
        />

        {needsCapacityCheck(opportunity) ? <CapacityCheck state={state} opportunity={opportunity} onNavigate={onClose} /> : null}

        {(() => {
          const journey = dealJourneyFor(state, { opportunityId: opportunity.id });
          return journey ? <DealJourney journey={journey} compact onNavigate={onClose} /> : null;
        })()}

        <RecordInsightChip opportunityId={opportunity.id} accountId={opportunity.accountId} />

        <div className={salesStyles.oppStep}>
          <label htmlFor="opp-next-step">Update next step</label>
          <div className={salesStyles.oppStepRow}>
            <input
              id="opp-next-step"
              className="input"
              value={nextStep}
              onChange={(event) => setNextStep(event.target.value)}
              placeholder="What should happen next?"
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
        </div>

        <RelationshipIntelligence intel={relationship} />

        {linkedRequirement ? (
          <RecommendedMatches state={state} requirement={linkedRequirement} compact />
        ) : (
          <div className={salesStyles.oppCoverage}>
            <p>{coverage.sentence}</p>
            {coverage.associates.length > 0 ? (
              <ul className={salesStyles.coverageList}>
                {coverage.associates.map((associate) => (
                  <li key={associate.id}>
                    <Link href={associate.href} onClick={onClose}>
                      {associate.name}
                    </Link>
                    <span className="muted">
                      {" "}
                      · {associate.band} · {associate.availability}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        )}

        <dl className={salesStyles.oppPeople}>
          <div>
            <dt>Owner</dt>
            <dd>{owner?.name ?? "Unassigned"}</dd>
          </div>
          <div>
            <dt>Contact</dt>
            <dd>{contact?.name ?? "—"}</dd>
          </div>
          <div className={salesStyles.oppWide}>
            <dt>Services</dt>
            <dd>{opportunity.services.length ? opportunity.services.join(", ") : "—"}</dd>
          </div>
          {opportunity.stage === "Closed Won" ? (
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
          ) : null}
          {opportunity.lostReason ? (
            <div className={salesStyles.oppWide}>
              <dt>Lost reason</dt>
              <dd>{opportunity.lostReason}</dd>
            </div>
          ) : null}
        </dl>

        <div className={salesStyles.oppActions}>
          {canGenerateRequirement ? (
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
          ) : null}
        </div>
      </div>
    </Drawer>
  );
}
