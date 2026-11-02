"use client";

import { crm } from "@/lib/crm-store";
import { dueLabel } from "@/lib/format";
import type { Member, Task } from "@/lib/types";
import Icon from "@/components/ui/Icon";
import { AiChip, MemberAvatar, PriorityChip } from "@/components/ui/bits";
import { useWorkspace } from "@/components/shell/WorkspaceContext";
import styles from "./Tasks.module.css";

interface TaskCardProps {
  task: Task;
  leadName?: string | null;
  owner?: Member | null;
  showLead?: boolean;
}

export default function TaskCard({ task, leadName, owner, showLead = true }: TaskCardProps) {
  const { openTask, toast } = useWorkspace();
  const due = dueLabel(task.due);
  const done = task.status === "completed";
  const closed = done || task.status === "dismissed";

  return (
    <article className={`${styles.card} ${closed ? styles.cardDone : ""}`}>
      <button
        type="button"
        className={`${styles.check} ${done ? styles.checked : ""}`}
        aria-label={done ? `Reopen ${task.title}` : `Mark ${task.title} completed`}
        onClick={() => {
          crm.setTaskStatus(task.id, done ? "pending" : "completed");
          toast(done ? "Task reopened" : "Task completed");
        }}
      >
        {done && <Icon name="check" size={12} strokeWidth={3} />}
      </button>
      <button type="button" className={styles.cardMain} onClick={() => openTask(task.id)}>
        <span className={styles.cardTitle}>{task.title}</span>
        <span className={styles.cardChips}>
          <PriorityChip priority={task.priority} />
          {task.origin === "suggestion" && <AiChip label="Suggested" />}
          {showLead && leadName && (
            <span className="tag">
              <Icon name="users" size={11} /> &nbsp;{leadName}
            </span>
          )}
        </span>
        <span className={styles.cardFoot}>
          <MemberAvatar member={owner} />
          <span className={`${styles.due} ${styles[due.tone]}`}>{due.text}</span>
          <span className={styles.open}>
            Open <Icon name="arrowRight" size={12} />
          </span>
        </span>
      </button>
    </article>
  );
}
