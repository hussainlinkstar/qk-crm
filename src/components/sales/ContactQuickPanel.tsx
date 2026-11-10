"use client";

import Link from "next/link";
import Button from "@/components/ui/Button";
import Icon from "@/components/ui/Icon";
import { Drawer } from "@/components/ui/Overlay";
import { EmptyState, useWorkspaceData } from "@/components/ui/bits";
import { useWorkspace } from "@/components/shell/WorkspaceContext";
import { addDays, formatDate, initials, timeAgo } from "@/lib/format";
import styles from "@/components/leads/Leads.module.css";

export default function ContactQuickPanel({ contactId, onClose }: { contactId: string; onClose: () => void }) {
  const { state } = useWorkspaceData();
  const { openTaskForm } = useWorkspace();
  if (!state) return null;

  const contact = (state.contacts ?? []).find((item) => item.id === contactId);
  if (!contact) return null;

  const account = state.tessiant?.accounts.find((item) => item.id === contact.accountId);
  const owner = state.members.find((item) => item.id === contact.ownerId);
  const notes = (state.notes ?? [])
    .filter((note) => note.accountId === contact.accountId || note.contactId === contact.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 4);
  const events = (state.events ?? [])
    .filter(
      (event) =>
        event.accountId === contact.accountId ||
        event.contactId === contact.id ||
        event.title.toLowerCase().includes(contact.name.toLowerCase()),
    )
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
    .slice(0, 5);
  const lastInteraction = events[0] ?? null;
  const openTasks = state.tasks.filter(
    (task) =>
      task.status !== "completed" &&
      task.status !== "dismissed" &&
      (task.contactId === contact.id ||
        task.accountId === contact.accountId ||
        (account?.linkedLeadId && task.leadId === account.linkedLeadId)),
  );

  return (
    <Drawer
      kicker="Contact"
      title={
        <span className={styles.panelTitle}>
          <span className="avatar">{initials(contact.name)}</span>
          <span>
            {contact.name}
            <small>
              {contact.role ?? "Contact"}
              {account ? ` · ${account.name}` : ""}
            </small>
          </span>
        </span>
      }
      onClose={onClose}
      width={500}
      footer={
        <Link href={`/sales/accounts/${contact.accountId}`} className={styles.fullProfile} onClick={onClose}>
          Open account 360 <Icon name="arrowRight" size={14} />
        </Link>
      }
    >
      <div className={styles.panelMeta}>
        {contact.isPrimary ? <span className="chip chip-completed">Primary</span> : <span className="chip">Stakeholder</span>}
        <span className="tag">Owner · {owner?.name ?? "Unassigned"}</span>
        {lastInteraction ? <span className="tag">Last · {timeAgo(lastInteraction.occurredAt)}</span> : null}
      </div>

      <div className={styles.quickActions}>
        <Button
          size="small"
          icon="plus"
          onClick={() =>
            openTaskForm({
              initial: {
                title: `Follow up with ${contact.name}`,
                description: `Contact ${contact.id} · Account ${contact.accountId}`,
                leadId: account?.linkedLeadId ?? null,
                ownerId: contact.ownerId ?? "me",
                due: addDays(1),
                priority: "medium",
              },
            })
          }
        >
          Task
        </Button>
        <Link href={`/sales/accounts/${contact.accountId}`} onClick={onClose}>
          <Button size="small" variant="secondary">
            Account
          </Button>
        </Link>
      </div>

      <dl className={styles.facts}>
        <div>
          <dt>Email</dt>
          <dd>{contact.email}</dd>
        </div>
        <div>
          <dt>Phone</dt>
          <dd>{contact.phone ?? "—"}</dd>
        </div>
        <div>
          <dt>Last interaction</dt>
          <dd>{lastInteraction ? `${lastInteraction.title} · ${formatDate(lastInteraction.occurredAt, true)}` : "None recorded"}</dd>
        </div>
        <div>
          <dt>Next action</dt>
          <dd>{openTasks[0]?.title ?? "No open follow-up"}</dd>
        </div>
      </dl>

      {contact.notes ? (
        <>
          <h3 className={`kicker ${styles.panelSection}`}>Contact notes</h3>
          <p className="muted" style={{ fontSize: 13.5, lineHeight: 1.45 }}>
            {contact.notes}
          </p>
        </>
      ) : null}

      <h3 className={`kicker ${styles.panelSection}`}>Activity</h3>
      {events.length === 0 ? (
        <EmptyState title="No recent activity" icon="calendar" />
      ) : (
        <ol className={styles.miniTimeline}>
          {events.map((event) => (
            <li key={event.id}>
              <span>
                <b>{event.title}</b>
                <small>
                  {timeAgo(event.occurredAt)}
                  {event.detail ? ` · ${event.detail}` : ""}
                </small>
              </span>
            </li>
          ))}
        </ol>
      )}

      <h3 className={`kicker ${styles.panelSection}`}>Notes</h3>
      {notes.length === 0 ? (
        <EmptyState title="No CRM notes yet" icon="note" />
      ) : (
        <ol className={styles.miniTimeline}>
          {notes.map((note) => (
            <li key={note.id}>
              <span>
                <b>{note.body.slice(0, 120)}</b>
                <small>{formatDate(note.createdAt, true)}</small>
              </span>
            </li>
          ))}
        </ol>
      )}
    </Drawer>
  );
}
