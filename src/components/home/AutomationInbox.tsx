"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { CrmState } from "@/lib/types";
import { automationHistory, automationProposals } from "@/lib/automations";
import { crm } from "@/lib/crm-store";
import Button from "@/components/ui/Button";
import Icon from "@/components/ui/Icon";
import IconTile from "@/components/ui/IconTile";
import { useWorkspace } from "@/components/shell/WorkspaceContext";
import styles from "./AutomationInbox.module.css";

const SHOW = 3;

/**
 * Waiting for your OK: what Qiko's automations would do next. Nothing runs without a click, and
 * every answer is remembered so the same proposal never nags twice.
 */
export default function AutomationInbox({ state, now }: { state: CrmState; now: number }) {
  const { toast, openTask } = useWorkspace();
  const proposals = useMemo(() => automationProposals(state, now), [state, now]);
  const history = useMemo(() => automationHistory(state), [state]);
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? proposals : proposals.slice(0, SHOW);
  const approved = history.filter((item) => item.decision === "done").length;

  return (
    <section className={`card ${styles.panel}`} aria-labelledby="auto-title" data-tour="inbox">
      <div className={styles.head}>
        <div>
          <span className="kicker-qiko">Automations · human in the loop</span>
          <h2 id="auto-title">Waiting for your OK</h2>
        </div>
        <span className={styles.count} data-empty={proposals.length === 0 || undefined}>
          <b className="tabular">{proposals.length}</b>
        </span>
      </div>

      {proposals.length === 0 ? (
        <p className={styles.empty}>
          <Icon name="checkCircle" size={14} /> Nothing proposed right now. {approved ? `${approved} approved so far.` : "Rules are on; Qiko will propose when a record qualifies."}
        </p>
      ) : (
        <ul className={styles.list}>
          {visible.map((proposal, index) => (
            <li key={proposal.id} className={styles.item} style={{ animationDelay: `${index * 40}ms` }}>
              <IconTile name={proposal.rule.id === "won_to_requirement" ? "flag" : proposal.rule.id === "renewal_outreach" ? "clock" : proposal.rule.id === "coverage_sweep" ? "search" : "users"} tone="qiko" size="sm" />
              <div className={styles.copy}>
                <span className={styles.rule}>{proposal.rule.name}</span>
                <b title={proposal.why}>{proposal.title}</b>
                <small>
                  <Icon name="check" size={10} strokeWidth={2.6} /> {proposal.evidence}
                  {proposal.href ? (
                    <>
                      {" · "}
                      <Link href={proposal.href}>open record</Link>
                    </>
                  ) : null}
                </small>
                <div className={styles.actions}>
                  <Button
                    size="small"
                    variant="qiko"
                    icon="check"
                    onClick={() => {
                      const result = proposal.approve();
                      toast(result.message, "success");
                      if (result.taskId) openTask(result.taskId);
                    }}
                  >
                    Approve
                  </Button>
                  <button
                    type="button"
                    className="link-button"
                    onClick={() => {
                      crm.recordAutomationDecision(proposal.id, "dismissed");
                      toast("Dismissed. Qiko will not propose this again.", "info");
                    }}
                  >
                    Not this one
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className={styles.foot}>
        {proposals.length > SHOW ? (
          <button type="button" className="link-button" onClick={() => setExpanded((value) => !value)} aria-expanded={expanded}>
            {expanded ? "Show fewer" : `${proposals.length - SHOW} more`}
          </button>
        ) : (
          <span>{approved ? `${approved} approved · ${history.length - approved} dismissed` : "Nothing approved yet"}</span>
        )}
        <Link href="/settings#automations" className="link-button">
          Rules <Icon name="arrowRight" size={12} />
        </Link>
      </div>
    </section>
  );
}
