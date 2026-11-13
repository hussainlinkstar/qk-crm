"use client";

import Link from "next/link";
import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { EmptyState, SkeletonRows, useNow, useWorkspaceData } from "@/components/ui/bits";
import BarList from "@/components/ui/BarList";
import ContactQuickPanel from "@/components/sales/ContactQuickPanel";
import InsightSignals, { type InsightSignalItem } from "@/components/sales/InsightSignals";
import { contactIntelligence, stakeholderCoverage } from "@/lib/contact-intelligence";
import { isOpen, sortTasks } from "@/lib/insights";
import { avatarStyle, initials, plural, timeAgo } from "@/lib/format";
import styles from "../leads/leads.module.css";
import salesStyles from "../sales.module.css";

const INITIAL_NOW = Date.now();

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
  const now = useNow();
  const contactParam = params.get("contact");
  const [previewId, setPreviewId] = useState<string | null>(contactParam);
  const [seenParam, setSeenParam] = useState(contactParam);
  // A deep link (?contact=) opens the panel; adjust state during render rather than in an effect.
  if (contactParam !== seenParam) {
    setSeenParam(contactParam);
    if (contactParam) setPreviewId(contactParam);
  }

  const signals = useMemo(() => (state ? contactIntelligence(state, now || INITIAL_NOW) : []), [state, now]);
  const coverage = useMemo(() => (state ? stakeholderCoverage(state).filter((row) => row.openOpportunities > 0 || row.contacts > 0).slice(0, 6) : []), [state]);

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

  const items: InsightSignalItem[] = signals.map((signal) => ({
    id: signal.id,
    kind: signal.kind,
    title: signal.title,
    detail: signal.detail,
    actionLabel: signal.actionLabel,
    href: signal.contactId ? undefined : `/sales/accounts/${signal.accountId}`,
    onClick: signal.contactId ? () => setPreviewId(signal.contactId) : undefined,
  }));

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Contacts</h1>
          <p className="subtitle">Stakeholders linked to accounts, and whether the relationship is multi-threaded.</p>
        </div>
      </header>

      <InsightSignals
        title="Contact intelligence"
        summary="Who is going quiet while a deal is live, where an account has no primary stakeholder, and which engagements are ending."
        items={items}
        emptyTitle="Every account with open pipeline has a primary contact who has been touched recently."
      />

      <div className={salesStyles.overviewGrid}>
        <section className="card">
          <div className="card-head">
            <div>
              <h2>All contacts</h2>
              <p className="card-sub">{plural(rows.length, "stakeholder")} across {new Set(rows.map((row) => row.contact.accountId)).size} accounts.</p>
            </div>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
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
                      <th>Last interaction</th>
                      <th>Next action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(({ contact, account, lastInteraction, nextAction }) => (
                      <tr key={contact.id} className="clickable" onClick={() => setPreviewId(contact.id)}>
                        <td>
                          <span className={styles.person}>
                            <span className="avatar avatar-sm" style={avatarStyle(contact.name)}>
                              {initials(contact.name)}
                            </span>
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
                          {contact.isPrimary ? <span className="chip" style={{ marginLeft: 6 }}>Primary</span> : null}
                        </td>
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

        <section className="card">
          <div className="card-head">
            <div>
              <h2>Stakeholder coverage</h2>
              <p className="card-sub">Named contacts per account, ordered by open pipeline. One contact is a single point of failure.</p>
            </div>
          </div>
          <div className="card-body">
            <BarList
              label="Contacts per account"
              max={Math.max(3, ...coverage.map((row) => row.contacts))}
              rows={coverage.map((row) => ({
                key: row.accountId,
                label: row.accountName,
                value: row.contacts,
                caption: `${plural(row.openOpportunities, "open deal")}${row.hasPrimary ? "" : " · no primary"}`,
                href: `/sales/accounts/${row.accountId}`,
                tone: row.contacts <= 1 && row.openOpportunities > 0 ? ("warning" as const) : ("brand" as const),
              }))}
            />
          </div>
        </section>
      </div>

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
