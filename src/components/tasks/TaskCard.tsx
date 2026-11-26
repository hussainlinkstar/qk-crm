"use client";

import { useState } from "react";
import { crm } from "@/lib/crm-store";
import { dueLabel, todayKey } from "@/lib/format";
import type { Member, Task } from "@/lib/types";
import Icon from "@/components/ui/Icon";
import { MemberAvatar, PriorityChip } from "@/components/ui/bits";
import { useWorkspace } from "@/components/shell/WorkspaceContext";
import styles from "./Tasks.module.css";

interface TaskCardProps {
  task: Task;
  leadName?: string | null;
  relatedLabel?: string | null;
  owner?: Member | null;
  dragging?: boolean;
  /** When false, hide related-record chip (e.g. already on a lead page). */
  showLead?: boolean;
  /** When set, the check control uses this instead of the CRM task store. */
  onToggle?: () => void;
  /** When set, the card body uses this instead of opening the CRM task drawer. */
  onOpen?: () => void;
}

export function TaskCardView({
  title,
  done,
  closed,
  overdue,
  completing = false,
  dragging = false,
  priority,
  dueText,
  dueTone,
  owner,
  related,
  onToggle,
  onOpen,
}: {
  title: string;
  done: boolean;
  closed: boolean;
  overdue: boolean;
  completing?: boolean;
  dragging?: boolean;
  priority: Task["priority"];
  dueText: string;
  dueTone: "overdue" | "today" | "soon" | "later" | "none";
  owner?: Member | null;
  related?: string | null;
  onToggle?: () => void;
  onOpen?: () => void;
}) {
  return (
    <article
      className={`${styles.card} ${styles.compact} ${closed ? styles.cardDone : ""} ${overdue ? styles.cardOverdue : ""} ${
        completing ? styles.cardCompleting : ""
      } ${dragging ? styles.cardDragging : ""}`}
    >
      <button
        type="button"
        className={`${styles.check} ${done ? styles.checked : ""}`}
        aria-label={done ? `Reopen ${title}` : `Mark ${title} completed`}
        onClick={(event) => {
          event.stopPropagation();
          onToggle?.();
        }}
      >
        {done && <Icon name="check" size={12} strokeWidth={3} />}
      </button>
      <button type="button" className={styles.cardMain} onClick={() => onOpen?.()}>
        <span className={styles.cardTitle}>{title}</span>
        <span className={styles.cardMeta}>
          <PriorityChip priority={priority} />
          <span className={`${styles.due} ${styles[dueTone]}`}>{dueText}</span>
        </span>
        <span className={styles.cardFoot}>
          <span className={styles.owner}>
            <MemberAvatar member={owner} />
            <span>{owner?.name ?? "Unassigned"}</span>
          </span>
          {related ? (
            <span className={styles.related} title={related}>
              <Icon name="users" size={11} />
              {related}
            </span>
          ) : null}
        </span>
      </button>
    </article>
  );
}

export default function TaskCard({
  task,
  leadName,
  relatedLabel,
  owner,
  dragging = false,
  showLead = true,
  onToggle,
  onOpen,
}: TaskCardProps) {
  const { openTask, toast } = useWorkspace();
  const [completing, setCompleting] = useState(false);
  const due = dueLabel(task.due, task.status);
  const done = task.status === "completed";
  const closed = done || task.status === "dismissed";
  const overdue = !closed && task.due !== null && task.due < todayKey();
  const related = showLead ? relatedLabel || leadName : null;

  return (
    <TaskCardView
      title={task.title}
      done={done}
      closed={closed}
      overdue={overdue}
      completing={completing}
      dragging={dragging}
      priority={task.priority}
      dueText={due.text}
      dueTone={due.tone}
      owner={owner}
      related={related}
      onOpen={onOpen ?? (() => openTask(task.id))}
      onToggle={() => {
        if (onToggle) {
          onToggle();
          return;
        }
        if (completing) return;
        if (done) {
          crm.setTaskStatus(task.id, "pending");
          toast("Task reopened");
          return;
        }
        setCompleting(true);
        window.setTimeout(() => {
          crm.setTaskStatus(task.id, "completed");
          toast("Task completed");
          setCompleting(false);
        }, 240);
      }}
    />
  );
}
