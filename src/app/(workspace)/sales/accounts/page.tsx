"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import Icon from "@/components/ui/Icon";
import BrandMark from "@/components/ui/BrandMark";
import AccountQuickPanel from "@/components/sales/AccountQuickPanel";
import { EmptyState, SkeletonRows, useWorkspaceData } from "@/components/ui/bits";
import CommercialInsights from "@/components/sales/CommercialInsights";
import { engagementInsights } from "@/lib/commercial-intelligence";
import { opportunitiesForAccount } from "@/lib/sales-crm";
import { liveAssignments, resolveAssignmentAccountId } from "@/lib/assignments";
import { isOpen, sortTasks } from "@/lib/insights";

import { dependencyLabel, founderDependency } from "@/lib/founder-dependency";
import directory from "@/components/ui/Directory.module.css";
import styles from "../sales.module.css";

export default function SalesAccountsPage() {
  const { state } = useWorkspaceData();
  const tessiant = state?.tessiant;
  const [q, setQ] = useState("");
  const [previewId, setPreviewId] = useState<string | null>(null);

  const insights = useMemo(() => (state ? engagementInsights(state) : []), [state]);

  const rows = useMemo(() => {
    if (!state || !tessiant) return [];
    const term = q.trim().toLowerCase();
    return tessiant.accounts
      .filter((account) => {
        if (!term) return true;
        const primary = state.members.find((item) => item.id === account.primaryOwnerId)?.name ?? "";
        return `${account.name} ${account.sector} ${account.status} ${primary}`.toLowerCase().includes(term);
      })
      .map((account) => {
        const primary = state.members.find((item) => item.id === account.primaryOwnerId);
        const opps = opportunitiesForAccount(state, account.id).filter(
          (item) => item.stage !== "Closed Won" && item.stage !== "Closed Lost",
        );
        const deployed = liveAssignments(state).filter((item) => resolveAssignmentAccountId(state, item) === account.id);
        const nextTask = sortTasks(
          state.tasks.filter(
            (task) => isOpen(task) && (task.accountId === account.id || (account.linkedLeadId && task.leadId === account.linkedLeadId)),
          ),
        )[0];
        return {
          account,
          primary,
          opps,
          deployed,
          dependency: founderDependency(state, account.id),
          nextAction: nextTask?.title ?? opps[0]?.nextStep ?? (deployed.length ? "Review deployments" : "Plan next touch"),
        };
      });
  }, [state, tessiant, q]);

  if (!state || !tessiant) {
    return (
      <div className="page">
        <SkeletonRows rows={4} height={64} />
      </div>
    );
  }

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Accounts</h1>
          <p className="subtitle">Client organisations — open Client 360 for the full relationship.</p>
        </div>
      </header>

      <CommercialInsights
        label="Account intelligence"
        title="Account intelligence"
        summary={
          insights.length === 1
            ? "1 account has an engagement ending within 30 days."
            : `${insights.length} accounts have an engagement ending within 30 days.`
        }
        insights={insights}
        onOpen={(insight) => setPreviewId(insight.accountId)}
      />

      <section className="card">
        <div className="card-body">
          <label className="search-field">
            <Icon name="search" size={15} />
            <input value={q} onChange={(event) => setQ(event.target.value)} placeholder="Search accounts, sector or owner" aria-label="Search accounts" />
          </label>

          <div className={styles.accountHeader} aria-hidden="true">
            <span>Account</span>
            <span>Sector / status</span>
            <span>Owner</span>
            <span>Dependency</span>
            <span>Open / live</span>
            <span>Next action</span>
            <span />
          </div>

          {rows.length === 0 ? (
            <EmptyState title="No accounts match" icon="building" />
          ) : (
            <div className={directory.list}>
              {rows.map(({ account, primary, opps, deployed, nextAction, dependency }) => (
                <button
                  key={account.id}
                  type="button"
                  className={styles.accountRow}
                  onClick={() => setPreviewId(account.id)}
                >
                  <span className={directory.identity}>
                    <BrandMark name={account.name} size={36} radius={10} />
                    <span className={directory.copy}>
                      <b>{account.name}</b>
                      <small>{account.industry}</small>
                    </span>
                  </span>
                  <span className={directory.stat}>
                    <b>{account.sector}</b>
                    <small>{account.status}</small>
                  </span>
                  <span className={directory.stat}>
                    <b>{primary?.name ?? "Unassigned"}</b>
                    <small>Relationship owner</small>
                  </span>
                  <span className={`${directory.stat} ${styles.dependency}`} data-band={dependency?.band ?? "low"}>
                    <b className="tabular">
                      <i style={{ width: `${dependency?.score ?? 0}%` }} />
                      {dependency?.score ?? 0}
                      {dependency && dependency.delta !== 0 ? (
                        <Icon name={dependency.delta > 0 ? "trendUp" : "trendDown"} size={12} />
                      ) : null}
                    </b>
                    <small>{dependency ? dependencyLabel(dependency.band) : "—"}</small>
                  </span>
                  <span className={directory.stat}>
                    <b className="tabular">
                      {opps.length} opp{opps.length === 1 ? "" : "s"}
                    </b>
                    <small className="tabular">{deployed.length} live</small>
                  </span>
                  <span className={directory.stat}>
                    <b>{nextAction}</b>
                    <small>
                      <Link
                        href={`/sales/pipeline?account=${account.id}`}
                        className="text-link"
                        onClick={(event) => event.stopPropagation()}
                      >
                        Pipeline
                      </Link>
                    </small>
                  </span>
                  <span className={directory.trail}>
                    <Icon name="chevronRight" size={15} />
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      {previewId ? <AccountQuickPanel accountId={previewId} onClose={() => setPreviewId(null)} /> : null}
    </div>
  );
}
