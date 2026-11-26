"use client";

import type { ReactNode } from "react";
import Button from "@/components/ui/Button";
import Icon, { type IconName } from "@/components/ui/Icon";
import { KIND_ICON } from "@/components/ui/kind-icons";
import type { ActivityKind } from "@/lib/types";
import { formatDate, formatDateTime, initials, timeAgo } from "@/lib/format";
import styles from "@/app/(workspace)/sales/leads/[id]/profile.module.css";

export function RecordStack({ children }: { children: ReactNode }) {
  return <div className={styles.stack}>{children}</div>;
}

export function PanelCard({
  title,
  extra,
  children,
  stack = false,
}: {
  title: ReactNode;
  extra?: ReactNode;
  children: ReactNode;
  stack?: boolean;
}) {
  return (
    <section className="card">
      <div className="card-head">
        <div>
          <h2>{title}</h2>
        </div>
        {extra}
      </div>
      <div className={stack ? `card-body ${styles.stack}` : "card-body"}>{children}</div>
    </section>
  );
}

export function EngagementCard({ name, stats }: { name: string; stats: Array<{ label: string; value: ReactNode }> }) {
  return (
    <section className="card">
      <div className="card-head">
        <div>
          <h2>How {name} is engaging</h2>
        </div>
      </div>
      <div className="card-body">
        <dl className={styles.stats}>
          {stats.map((item) => (
            <div key={item.label}>
              <dt>{item.label}</dt>
              <dd>{item.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

export function FilterBar({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ key: string; label: string; count?: number }>;
  onChange: (key: string) => void;
}) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {options.map((option) => (
        <button type="button" key={option.key} aria-pressed={value === option.key} onClick={() => onChange(option.key)}>
          {option.label}
          {option.count !== undefined ? <span className="count">{option.count}</span> : null}
        </button>
      ))}
    </div>
  );
}

export interface RecordEvent {
  id: string;
  kind: string;
  title: string;
  detail?: string | null;
  source: string;
  actor?: string | null;
  occurredAt: string;
  icon?: IconName;
}

export function LeadTimeline({
  groups,
  now,
  hideDay = false,
}: {
  groups: Array<{ day: string; items: RecordEvent[] }>;
  now: number;
  hideDay?: boolean;
}) {
  return (
    <div className={styles.timeline}>
      {groups.map((group) => (
        <div key={group.day}>
          {!hideDay && <p className={styles.day}>{formatDate(group.day, true)}</p>}
          <ol>
            {group.items.map((event) => {
              const icon = event.icon ?? KIND_ICON[event.kind as ActivityKind] ?? "clock";
              const tone = styles[`kind_${event.kind}` as keyof typeof styles] ?? "";
              return (
                <li key={event.id}>
                  <span className={`${styles.timelineIcon} ${tone}`}>
                    <Icon name={icon} size={13} />
                  </span>
                  <div>
                    <b>{event.title}</b>
                    {event.detail ? <p>{event.detail}</p> : null}
                    <small>
                      {event.source}
                      {event.actor ? ` · ${event.actor}` : ""} · <span title={formatDateTime(event.occurredAt)}>{timeAgo(event.occurredAt, now || undefined)}</span>
                    </small>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      ))}
    </div>
  );
}

export interface RecordMessage {
  id: string;
  channel: string;
  subject?: string;
  body: string;
  actor: string;
  at: string;
  direction?: "in" | "out";
}

export function MessageThread({ messages, now }: { messages: RecordMessage[]; now: number }) {
  return (
    <div className={styles.thread}>
      {messages.map((message) => (
        <article key={message.id} className={`${styles.bubble} ${message.direction === "out" ? styles.bubbleOut : styles.bubbleIn}`}>
          <b>{message.channel === "email" ? message.subject || "Email" : message.channel === "whatsapp" ? "WhatsApp" : message.subject || message.channel}</b>
          <p>{message.body}</p>
          <small>
            {message.actor} · {message.channel === "email" ? "Email" : message.channel === "whatsapp" ? "WhatsApp" : message.channel} · <span title={formatDateTime(message.at)}>{timeAgo(message.at, now || undefined)}</span>
          </small>
        </article>
      ))}
    </div>
  );
}

export function OriginCard({
  source,
  firstSeen,
  systems,
  summary,
}: {
  source: string;
  firstSeen: string;
  systems: string;
  summary: ReactNode;
}) {
  return (
    <section className="card">
      <div className="card-head">
        <div>
          <h2>Where this lead came from</h2>
        </div>
      </div>
      <div className="card-body">
        <dl className={styles.details}>
          <div><dt>Original source</dt><dd>{source}</dd></div>
          <div><dt>First seen</dt><dd>{firstSeen}</dd></div>
          <div><dt>Systems with activity</dt><dd>{systems}</dd></div>
        </dl>
        <p className={styles.dedupe}>
          <Icon name="checkCircle" size={13} /> {summary}
        </p>
      </div>
    </section>
  );
}

export function NoteArticle({
  author,
  when,
  whenTitle,
  body,
  onDelete,
}: {
  author: string;
  when: string;
  whenTitle?: string;
  body: string;
  onDelete?: () => void;
}) {
  return (
    <article className={styles.note}>
      <div className={styles.noteHead}>
        <span className="avatar avatar-sm">{initials(author)}</span>
        <b>{author}</b>
        <small title={whenTitle}>{when}</small>
        {onDelete ? <Button size="small" variant="ghost" icon="trash" aria-label="Delete note" onClick={onDelete} /> : null}
      </div>
      <p>{body}</p>
    </article>
  );
}

export const profileStyles = styles;
