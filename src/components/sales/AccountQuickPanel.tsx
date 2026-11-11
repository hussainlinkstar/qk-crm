"use client";

import Link from "next/link";
import Button from "@/components/ui/Button";
import Icon from "@/components/ui/Icon";
import { Drawer } from "@/components/ui/Overlay";
import { EmptyState, useWorkspaceData } from "@/components/ui/bits";
import { liveAssignments, resolveAssignmentAccountId } from "@/lib/assignments";
import { opportunitiesForAccount } from "@/lib/sales-crm";
import RecordInsightChip from "@/components/pulse/RecordInsightChip";
import styles from "@/components/leads/Leads.module.css";

export default function AccountQuickPanel({ accountId, onClose }: { accountId: string; onClose: () => void }) {
  const { state } = useWorkspaceData();
  if (!state?.tessiant) return null;

  const account = state.tessiant.accounts.find((item) => item.id === accountId);
  if (!account) return null;

  const primary = state.members.find((item) => item.id === account.primaryOwnerId);
  const secondary = state.members.find((item) => item.id === account.secondaryOwnerId);
  const openOpps = opportunitiesForAccount(state, account.id).filter(
    (item) => item.stage !== "Closed Won" && item.stage !== "Closed Lost",
  );
  const pipelineValue = openOpps.reduce((sum, item) => sum + item.amount, 0);
  const reqs = state.tessiant.requirements.filter((item) => item.accountId === account.id && item.outcome === "active");
  const deployed = liveAssignments(state).filter((item) => resolveAssignmentAccountId(state, item) === account.id);
  const contacts = (state.contacts ?? []).filter((item) => item.accountId === account.id).slice(0, 4);

  return (
    <Drawer
      kicker="Account"
      title={
        <span className={styles.panelTitle}>
          <span>
            {account.name}
            <small>
              {account.sector} · {account.status}
            </small>
          </span>
        </span>
      }
      onClose={onClose}
      width={520}
      footer={
        <Link href={`/sales/accounts/${account.id}`} className={styles.fullProfile} onClick={onClose}>
          Open full account <Icon name="arrowRight" size={14} />
        </Link>
      }
    >
      <RecordInsightChip accountId={account.id} />

      <div className={styles.panelMeta}>
        <span className="chip tabular">{openOpps.length} open opps</span>
        <span className="chip tabular">£{pipelineValue.toLocaleString("en-GB")}</span>
        <span className="chip tabular">{reqs.length} requirements</span>
        <span className="chip tabular">{deployed.length} deployed</span>
      </div>

      <div className={styles.quickActions}>
        <Link href={`/sales/accounts/${account.id}`} onClick={onClose}>
          <Button size="small">Open account</Button>
        </Link>
        <Link href={`/sales/pipeline?account=${account.id}`} onClick={onClose}>
          <Button size="small" variant="secondary">
            Pipeline
          </Button>
        </Link>
        <Link href={`/staffing/requirements?client=${account.id}`} onClick={onClose}>
          <Button size="small" variant="soft">
            Requirements
          </Button>
        </Link>
      </div>

      <dl className={styles.facts}>
        <div>
          <dt>Primary owner</dt>
          <dd>{primary?.name ?? "—"}</dd>
        </div>
        <div>
          <dt>Secondary owner</dt>
          <dd>{secondary?.name ?? "No secondary"}</dd>
        </div>
        {!account.secondaryOwnerId && account.primaryOwnerId ? (
          <div>
            <dt>Risk</dt>
            <dd>Founder / single-owner dependency</dd>
          </div>
        ) : null}
      </dl>

      <h3 className={`kicker ${styles.panelSection}`}>Open opportunities</h3>
      {openOpps.length === 0 ? (
        <EmptyState title="No open opportunities" icon="sales" />
      ) : (
        <ol className={styles.miniTimeline}>
          {openOpps.slice(0, 4).map((opp) => (
            <li key={opp.id}>
              <span>
                <b>{opp.name}</b>
                <small>
                  {opp.stage} · £{opp.amount.toLocaleString("en-GB")}
                </small>
              </span>
            </li>
          ))}
        </ol>
      )}

      <h3 className={`kicker ${styles.panelSection}`}>Contacts</h3>
      {contacts.length === 0 ? (
        <EmptyState title="No contacts linked" icon="users" />
      ) : (
        <ol className={styles.miniTimeline}>
          {contacts.map((contact) => (
            <li key={contact.id}>
              <span>
                <b>{contact.name}</b>
                <small>
                  {contact.role ?? "Contact"}
                  {contact.isPrimary ? " · Primary" : ""}
                </small>
              </span>
            </li>
          ))}
        </ol>
      )}
    </Drawer>
  );
}
