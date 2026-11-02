"use client";

import Link from "next/link";
import { useState } from "react";
import { addDays, formatDate, initials, timeAgo } from "@/lib/format";
import type { ConversationChannel } from "@/lib/types";
import Button from "@/components/ui/Button";
import Icon from "@/components/ui/Icon";
import { Drawer } from "@/components/ui/Overlay";
import { KIND_ICON } from "@/components/ui/kind-icons";
import { EmptyState, LeadStatusChip, useWorkspaceData } from "@/components/ui/bits";
import SuggestionCard from "@/components/tasks/SuggestionCard";
import TaskCard from "@/components/tasks/TaskCard";
import { useWorkspace } from "@/components/shell/WorkspaceContext";
import LogInteractionModal from "./LogInteractionModal";
import ComposeMessageModal from "./ComposeMessageModal";
import styles from "./Leads.module.css";

export default function LeadQuickPanel({ leadId, onClose }: { leadId: string; onClose: () => void }) {
  const { state, workspace } = useWorkspaceData();
  const { openTaskForm, askQiko } = useWorkspace();
  const [logOpen, setLogOpen] = useState(false);
  const [compose, setCompose] = useState<ConversationChannel | null>(null);
  if (!state || !workspace) return null;
  const lead = workspace.leadById.get(leadId);
  if (!lead) return null;

  const owner = state.members.find((member) => member.id === lead.ownerId);
  const events = (workspace.byLead.get(lead.id) ?? []).slice(0, 5);
  const suggestion = workspace.suggestions.find((item) => item.leadId === lead.id);
  const scans = state.scans.filter((scan) => scan.leadId === lead.id);
  const messages = (state.messages ?? []).filter((message) => message.leadId === lead.id).sort((a, b) => b.at.localeCompare(a.at)).slice(0, 4);

  return (
    <Drawer
      kicker="Lead"
      title={
        <span className={styles.panelTitle}>
          <span className="avatar">{initials(lead.name)}</span>
          <span>
            {lead.name}
            <small>{lead.role ? `${lead.role} · ` : ""}{lead.company ?? "No company"}</small>
          </span>
        </span>
      }
      onClose={onClose}
      width={540}
      footer={
        <Link href={`/sales/leads/${lead.id}`} className={styles.fullProfile} onClick={onClose}>
          Open full profile <Icon name="arrowRight" size={14} />
        </Link>
      }
    >
      <div className={styles.panelMeta}>
        <LeadStatusChip status={lead.status} />
        <span className="tag">{lead.source}</span>
        <span className="tag">Owner · {owner?.name ?? "Unassigned"}</span>
        <span className="tag">Engagement {lead.engagementScore}/100</span>
      </div>

      <div className={styles.quickActions}>
        <Button size="small" icon="plus" onClick={() => openTaskForm({ initial: { title: `Follow up with ${lead.name}`, leadId: lead.id, ownerId: lead.ownerId ?? "me", due: addDays(1) } })}>Task</Button>
        <Button size="small" variant="secondary" icon="phone" onClick={() => setLogOpen(true)}>Log interaction</Button>
        <Button size="small" variant="secondary" icon="mail" onClick={() => setCompose("email")}>Email</Button>
        <Button size="small" variant="secondary" icon="whatsapp" onClick={() => setCompose("whatsapp")}>WhatsApp</Button>
        <Button size="small" variant="soft" icon="sparkles" onClick={() => askQiko(`Tell me everything about ${lead.name}`, lead.id)}>Ask Qiko</Button>
      </div>

      <dl className={styles.facts}>
        <div><dt>Email</dt><dd>{lead.email}</dd></div>
        <div><dt>Phone</dt><dd>{lead.phone ?? "—"}</dd></div>
        <div><dt>Added</dt><dd>{formatDate(lead.createdAt, true)}</dd></div>
        <div><dt>Scans</dt><dd>{scans.length ? `${scans.length} · latest ${scans[0].score}/100` : "None"}</dd></div>
      </dl>

      <h3 className={`kicker ${styles.panelSection}`}>Conversation</h3>
      {messages.length === 0 ? (
        <EmptyState icon="message" title="No email or WhatsApp yet" />
      ) : (
        <ol className={styles.miniTimeline}>
          {messages.map((message) => (
            <li key={message.id}>
              <span className={styles.miniIcon}><Icon name={message.channel === "email" ? "mail" : "whatsapp"} size={13} /></span>
              <span>
                <b>{message.channel === "email" ? message.subject || "Email" : "WhatsApp"}</b>
                <small className={styles.detail}>{message.body}</small>
                <small>{message.actor} · {timeAgo(message.at)}</small>
              </span>
            </li>
          ))}
        </ol>
      )}

      <h3 className={`kicker ${styles.panelSection}`}>Next best action</h3>
      {suggestion ? (
        <SuggestionCard suggestion={suggestion} lead={lead} showLead={false} />
      ) : lead.openTasks.length ? (
        <div className={styles.stack}>
          {lead.openTasks.map((task) => <TaskCard key={task.id} task={task} owner={state.members.find((member) => member.id === task.ownerId)} showLead={false} />)}
        </div>
      ) : (
        <EmptyState icon="checkCircle" title={lead.nextActionLabel} />
      )}

      <h3 className={`kicker ${styles.panelSection}`}>Recent activity</h3>
      {events.length === 0 ? (
        <EmptyState title="No activity yet" />
      ) : (
        <ol className={styles.miniTimeline}>
          {events.map((event) => (
            <li key={event.id}>
              <span className={styles.miniIcon}><Icon name={KIND_ICON[event.kind]} size={13} /></span>
              <span>
                <b>{event.title}</b>
                {event.detail && <small className={styles.detail}>{event.detail}</small>}
                <small>{event.source} · {timeAgo(event.occurredAt)}</small>
              </span>
            </li>
          ))}
        </ol>
      )}

      {logOpen && <LogInteractionModal leadId={lead.id} leadName={lead.name} onClose={() => setLogOpen(false)} />}
      {compose && (
        <ComposeMessageModal
          channel={compose}
          leadId={lead.id}
          leadName={lead.name}
          address={compose === "email" ? lead.email : lead.phone ?? ""}
          onClose={() => setCompose(null)}
        />
      )}
    </Drawer>
  );
}
