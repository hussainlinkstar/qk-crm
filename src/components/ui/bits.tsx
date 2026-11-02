"use client";

import { useMemo, useSyncExternalStore, type ReactNode } from "react";
import { useCrm } from "@/lib/crm-store";
import { buildWorkspace } from "@/lib/insights";
import { formatDate, initials, timeAgo } from "@/lib/format";
import type { Evidence, LeadStatus, Member, Priority, TaskStatus } from "@/lib/types";
import Icon, { type IconName } from "./Icon";

export function useWorkspaceData() {
  const state = useCrm();
  const workspace = useMemo(() => (state ? buildWorkspace(state) : null), [state]);
  return { state, workspace };
}

const subscribeClock = (callback: () => void) => {
  const timer = window.setInterval(callback, 30_000);
  return () => window.clearInterval(timer);
};
const readClock = () => Math.floor(Date.now() / 60_000) * 60_000;

/** Minute-resolution clock that re-renders relative times without impure render calls. */
export function useNow(): number {
  return useSyncExternalStore(subscribeClock, readClock, () => 0);
}

export function LeadStatusChip({ status }: { status: LeadStatus }) {
  return <span className={`chip chip-dot chip-${status.toLowerCase()}`}>{status}</span>;
}

const TASK_STATUS_LABEL: Record<TaskStatus, string> = { pending: "Pending", in_progress: "In progress", completed: "Completed", dismissed: "Dismissed" };

export function taskStatusLabel(status: TaskStatus) {
  return TASK_STATUS_LABEL[status];
}

export function TaskStatusChip({ status }: { status: TaskStatus }) {
  return <span className={`chip chip-${status}`}>{TASK_STATUS_LABEL[status]}</span>;
}

export function PriorityChip({ priority }: { priority: Priority }) {
  return <span className={`chip chip-${priority}`}>{priority[0].toUpperCase() + priority.slice(1)}</span>;
}

export function AiChip({ label = "Qiko suggestion" }: { label?: string }) {
  return (
    <span className="chip chip-ai">
      <Icon name="sparkles" size={11} />
      {label}
    </span>
  );
}

export function MemberAvatar({ member, size = "sm" }: { member: Member | null | undefined; size?: "sm" | "md" }) {
  return (
    <span className={`avatar ${size === "sm" ? "avatar-sm" : ""}`} title={member?.name ?? "Unassigned"} style={member ? undefined : { background: "var(--well)", color: "var(--subtle)" }}>
      {member ? initials(member.name) : "–"}
    </span>
  );
}

export function EmptyState({ icon = "info", title, children, actions }: { icon?: IconName; title: string; children?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="empty-state">
      <span className="empty-icon">
        <Icon name={icon} size={18} />
      </span>
      <b>{title}</b>
      {children && <span>{children}</span>}
      {actions && <div className="empty-actions">{actions}</div>}
    </div>
  );
}

export function EvidenceList({ items, compact = false }: { items: Evidence[]; compact?: boolean }) {
  if (!items.length) return null;
  return (
    <ul className="evidence-list" data-compact={compact || undefined}>
      {items.map((item, index) => (
        <li key={`${item.label}-${index}`} data-kind={item.kind}>
          <span className="evidence-icon" aria-hidden="true">
            <Icon name={item.kind === "fact" ? "check" : "sparkles"} size={11} strokeWidth={2.4} />
          </span>
          <div>
            <p className="evidence-label">{item.label}</p>
            {item.detail && <p className="evidence-detail">{item.detail}</p>}
            <p className="evidence-meta">
              <span className={item.kind === "fact" ? "evidence-fact" : "evidence-ai"}>{item.kind === "fact" ? "Confirmed" : "AI inference"}</span>
              <span>· {item.source}</span>
              {item.at && <span title={formatDate(item.at, true)}>· {timeAgo(item.at)}</span>}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}

export function SkeletonRows({ rows = 4, height = 48 }: { rows?: number; height?: number }) {
  return (
    <div style={{ display: "grid", gap: 10 }} aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="skeleton" style={{ height }} />
      ))}
    </div>
  );
}
