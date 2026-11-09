"use client";

import Link from "next/link";
import { SkeletonRows, useWorkspaceData } from "@/components/ui/bits";
import { opportunitiesForAccount } from "@/lib/sales-crm";
import { liveAssignments, resolveAssignmentAccountId } from "@/lib/assignments";
export default function SalesAccountsPage() {
  const { state } = useWorkspaceData();
  const tessiant = state?.tessiant;

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
          <p className="subtitle">
            Client and prospect organisations — relationship owners, pipeline, requirements and deployments in one place.
          </p>
        </div>
      </header>

      <section className="card">
        <div className="card-body">
          <div>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th align="left">Account</th>
                  <th align="left">Owners</th>
                  <th align="left">Open pipeline</th>
                  <th align="left">Requirements</th>
                  <th align="left">Deployed</th>
                </tr>
              </thead>
              <tbody>
                {tessiant.accounts.map((account) => {
                  const primary = state.members.find((item) => item.id === account.primaryOwnerId);
                  const secondary = state.members.find((item) => item.id === account.secondaryOwnerId);
                  const opps = opportunitiesForAccount(state, account.id).filter(
                    (item) => item.stage !== "Closed Won" && item.stage !== "Closed Lost",
                  );
                  const reqs = tessiant.requirements.filter((item) => item.accountId === account.id && item.outcome === "active");
                  const deployed = liveAssignments(state).filter((item) => resolveAssignmentAccountId(state, item) === account.id);
                  return (
                    <tr key={account.id}>
                      <td style={{ padding: "10px 8px" }}>
                        <Link href={`/sales/accounts/${account.id}`}>{account.name}</Link>
                        <div className="muted">
                          {account.sector} · {account.status}
                          {!account.secondaryOwnerId && account.primaryOwnerId ? " · founder dependency risk" : ""}
                        </div>
                      </td>
                      <td style={{ padding: "10px 8px" }}>
                        <div>{primary?.name ?? "—"}</div>
                        <div className="muted">{secondary?.name ?? "No secondary"}</div>
                      </td>
                      <td style={{ padding: "10px 8px" }} className="tabular">
                        {opps.length} · £{opps.reduce((sum, item) => sum + item.amount, 0).toLocaleString("en-GB")}
                      </td>
                      <td style={{ padding: "10px 8px" }} className="tabular">
                        {reqs.length}
                      </td>
                      <td style={{ padding: "10px 8px" }} className="tabular">
                        {deployed.length}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}
