"use client";

import Link from "next/link";
import { EmptyState, SkeletonRows, useWorkspaceData } from "@/components/ui/bits";

export default function ContactsPage() {
  const { state } = useWorkspaceData();

  if (!state) {
    return (
      <div className="page">
        <SkeletonRows rows={4} height={56} />
      </div>
    );
  }

  const contacts = state.contacts ?? [];

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Contacts</h1>
          <p className="subtitle">Decision-makers, hiring managers, procurement and executives linked to client accounts.</p>
        </div>
      </header>

      <section className="card">
        <div className="card-body">
          {contacts.length === 0 ? (
            <EmptyState title="No contacts yet" icon="users" />
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th align="left">Contact</th>
                  <th align="left">Account</th>
                  <th align="left">Role</th>
                  <th align="left">Owner</th>
                </tr>
              </thead>
              <tbody>
                {contacts.map((contact) => {
                  const account = state.tessiant?.accounts.find((item) => item.id === contact.accountId);
                  const owner = state.members.find((item) => item.id === contact.ownerId);
                  return (
                    <tr key={contact.id}>
                      <td style={{ padding: "10px 8px" }}>
                        <b>{contact.name}</b>
                        <div className="muted">{contact.email}</div>
                      </td>
                      <td style={{ padding: "10px 8px" }}>
                        <Link href={`/sales/accounts/${contact.accountId}`}>{account?.name ?? contact.accountId}</Link>
                      </td>
                      <td style={{ padding: "10px 8px" }}>
                        {contact.role ?? "—"}
                        {contact.isPrimary ? " · Primary" : ""}
                      </td>
                      <td style={{ padding: "10px 8px" }}>{owner?.name ?? "Unassigned"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}
