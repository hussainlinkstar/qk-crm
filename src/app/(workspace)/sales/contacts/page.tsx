"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { EmptyState, SkeletonRows, useWorkspaceData } from "@/components/ui/bits";
import ContactQuickPanel from "@/components/sales/ContactQuickPanel";
import CommercialInsights from "@/components/sales/CommercialInsights";
import { engagementInsights } from "@/lib/commercial-intelligence";
import { isOpen, sortTasks } from "@/lib/insights";
import { initials, timeAgo } from "@/lib/format";
import styles from "../leads/leads.module.css";

export default function ContactsPage() {
  return (
    <Suspense
      fallback={
        <div className="page">
          <SkeletonRows rows={4} height={56} />
        </div>
      }
    >
      <ContactsView />
    </Suspense>
  );
}

function ContactsView() {
  const { state } = useWorkspaceData();
  const router = useRouter();
  const params = useSearchParams();
  const contactParam = params.get("contact");
  const [previewId, setPreviewId] = useState<string | null>(contactParam);

  useEffect(() => {
    if (contactParam) setPreviewId(contactParam);
  }, [contactParam]);

  const insights = useMemo(
    () => (state ? engagementInsights(state).filter((item) => item.contactId) : []),
    [state],
  );

  const rows = useMemo(() => {
    if (!state) return [];
    return (state.contacts ?? []).map((contact) => {
      const account = state.tessiant?.accounts.find((item) => item.id === contact.accountId);
      const owner = state.members.find((item) => item.id === contact.ownerId);
      const events = (state.events ?? [])
        .filter(
          (event) =>
            event.contactId === contact.id ||
            event.accountId === contact.accountId ||
            event.title.toLowerCase().includes(contact.name.toLowerCase()),
        )
        .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
      const nextTask = sortTasks(
        state.tasks.filter(
          (task) =>
            isOpen(task) &&
            (task.contactId === contact.id ||
              task.accountId === contact.accountId ||
              (account?.linkedLeadId && task.leadId === account.linkedLeadId)),
        ),
      )[0];
      return {
        contact,
        account,
        owner,
        lastInteraction: events[0] ?? null,
        nextAction: nextTask?.title ?? "No open follow-up",
      };
    });
  }, [state]);

  if (!state) {
    return (
      <div className="page">
        <SkeletonRows rows={4} height={56} />
      </div>
    );
  }

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Contacts</h1>
          <p className="subtitle">Stakeholders linked to accounts.</p>
        </div>
      </header>

      <CommercialInsights
        label="Contact intelligence"
        title="Contact intelligence"
        summary="Named contacts on accounts whose recorded engagement ends within 30 days."
        insights={insights}
        onOpen={(insight) => insight.contactId && setPreviewId(insight.contactId)}
      />

      <section className="card">
        <div className="card-body" style={{ paddingTop: 0 }}>
          {rows.length === 0 ? (
            <EmptyState title="No contacts yet" icon="users" />
          ) : (
            <div className="table-wrap">
              <table className={`table ${styles.table}`}>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Account</th>
                    <th>Role</th>
                    <th>Owner</th>
                    <th>Last interaction</th>
                    <th>Next action</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ contact, account, owner, lastInteraction, nextAction }) => (
                    <tr key={contact.id} className="clickable" onClick={() => setPreviewId(contact.id)}>
                      <td>
                        <span className={styles.person}>
                          <span className="avatar avatar-sm">{initials(contact.name)}</span>
                          <span>
                            <b>{contact.name}</b>
                            <small>{contact.email}</small>
                          </span>
                        </span>
                      </td>
                      <td onClick={(event) => event.stopPropagation()}>
                        <Link href={`/sales/accounts/${contact.accountId}`}>{account?.name ?? contact.accountId}</Link>
                      </td>
                      <td>
                        {contact.role ?? "—"}
                        {contact.isPrimary ? " · Primary" : ""}
                      </td>
                      <td>{owner?.name ?? "Unassigned"}</td>
                      <td>
                        {lastInteraction ? (
                          <span className={styles.activity}>
                            <b>{lastInteraction.title}</b>
                            <small>{timeAgo(lastInteraction.occurredAt)}</small>
                          </span>
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </td>
                      <td className={styles.next}>{nextAction}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {previewId && (
        <ContactQuickPanel
          contactId={previewId}
          onClose={() => {
            setPreviewId(null);
            if (contactParam) {
              const next = new URLSearchParams(params.toString());
              next.delete("contact");
              router.replace(`/sales/contacts${next.size ? `?${next}` : ""}`, { scroll: false });
            }
          }}
        />
      )}
    </div>
  );
}
