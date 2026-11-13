"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import type { CrmState, Opportunity } from "@/lib/types";
import { capacityCheck } from "@/lib/capacity-check";
import { crm } from "@/lib/crm-store";
import { avatarStyle, initials } from "@/lib/format";
import Button from "@/components/ui/Button";
import Icon from "@/components/ui/Icon";
import IconTile, { type IconTone } from "@/components/ui/IconTile";
import { useWorkspace } from "@/components/shell/WorkspaceContext";
import styles from "./CapacityCheck.module.css";

const TONE: Record<string, IconTone> = { covered: "success", thin: "warning", uncovered: "danger", advisory: "qiko", "n/a": "muted" };

/**
 * Pre-sales capacity check on a Proposal or Negotiation deal: can we staff it if it closes?
 * One honest line, the people behind it, and the action that de-risks the proposal.
 */
export default function CapacityCheck({ state, opportunity, onNavigate }: { state: CrmState; opportunity: Opportunity; onNavigate?: () => void }) {
  const router = useRouter();
  const { toast, askQiko } = useWorkspace();
  const check = useMemo(() => capacityCheck(state, opportunity), [state, opportunity]);
  if (check.status === "n/a") return null;

  const openRequirement = () => {
    const result = crm.createRequirementFromOpportunity(opportunity.id);
    if (!result.ok) {
      toast(result.error, "error");
      return;
    }
    toast("Requirement opened so sourcing starts before the deal closes", "success");
    onNavigate?.();
    router.push(`/staffing/requirements/${result.requirementId}`);
  };

  return (
    <section className={styles.card} data-status={check.status} aria-label="Capacity check">
      <div className={styles.head}>
        <IconTile name={check.status === "covered" ? "shield" : check.status === "advisory" ? "star" : "alert"} tone={TONE[check.status]} size="md" />
        <div className={styles.copy}>
          <span className={styles.kicker}>
            Capacity check · {opportunity.stage}
            <span className={styles.badge}>{check.label}</span>
          </span>
          <b>{check.headline}</b>
          <p>{check.detail}</p>
        </div>
      </div>

      {check.names.length > 0 ? (
        <ul className={styles.names}>
          {check.names.map((item) => (
            <li key={item.associate.id}>
              <Link href={`/staffing/associates/${item.associate.id}`} onClick={onNavigate}>
                <span className="avatar avatar-sm" style={avatarStyle(item.associate.name)}>
                  {initials(item.associate.name)}
                </span>
                <span>
                  <b>{item.associate.name}</b>
                  <small>
                    {item.band} · {item.availability}
                  </small>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}

      <div className={styles.foot}>
        <span className={styles.next}>
          <Icon name="arrowRight" size={12} /> {check.next}
        </span>
        <div className={styles.actions}>
          {check.status !== "advisory" && !check.linked ? (
            <Button size="small" variant={check.status === "covered" ? "secondary" : "qiko"} icon="flag" onClick={openRequirement}>
              Open requirement
            </Button>
          ) : null}
          {check.linked && check.requirement ? (
            <Link href={`/staffing/requirements/${check.requirement.id}`} className="link-button" onClick={onNavigate}>
              {check.status === "covered" ? "Open requirement" : "Run sourcing sweep"} <Icon name="arrowRight" size={12} />
            </Link>
          ) : null}
          <button type="button" className="link-button" onClick={() => askQiko(`Can we staff ${opportunity.name} if it closes? What would de-risk the proposal?`)}>
            Ask Qiko
          </button>
        </div>
      </div>
    </section>
  );
}
