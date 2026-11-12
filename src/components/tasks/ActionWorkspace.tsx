"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Select from "@/components/ui/Select";
import { useMemo, useState, type DragEvent } from "react";
import { crm } from "@/lib/crm-store";
import { dueLabel, todayKey } from "@/lib/format";
import { isOpen, sortTasks, taskCounts } from "@/lib/insights";
import { PRIORITIES, type Priority, type Task, type TaskStatus } from "@/lib/types";
import Button from "@/components/ui/Button";
import Icon from "@/components/ui/Icon";
import { Drawer } from "@/components/ui/Overlay";
import { EmptyState, MemberAvatar, PriorityChip, SkeletonRows, TaskStatusChip, useWorkspaceData } from "@/components/ui/bits";
import SuggestionCard from "@/components/tasks/SuggestionCard";
import TaskCard from "@/components/tasks/TaskCard";
import { useWorkspace } from "@/components/shell/WorkspaceContext";
import styles from "./ActionWorkspace.module.css";

const COLUMNS: { status: TaskStatus; label: string }[] = [
  { status: "pending", label: "To Do" },
  { status: "in_progress", label: "In Progress" },
  { status: "completed", label: "Done" },
];

const SOURCES = [
  ["", "All sources"],
  ["manual", "Manual"],
  ["suggestion", "From Qiko"],
  ["copilot", "Ask Qiko"],
] as const;

type View = "all" | "pending" | "in_progress" | "completed" | "overdue" | "dismissed";
type TaskSource = "" | "manual" | "suggestion" | "copilot";

function isSalesScopedTask(task: Task) {
  return Boolean(task.leadId || task.accountId || task.opportunityId || task.contactId);
}

export function ActionWorkspace({
  title = "Activities",
  subtitle = "Follow-ups and ownership.",
  defaultOwnerMine = false,
  scope = "all",
}: {
  title?: string;
  subtitle?: string;
  defaultOwnerMine?: boolean;
  /** When "sales", only tasks linked to leads/accounts/opportunities/contacts. */
  scope?: "all" | "sales";
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { state, workspace } = useWorkspaceData();
  const { openTaskForm, openTask, toast } = useWorkspace();
  const [layout, setLayout] = useState<"board" | "list">("board");
  const [owner, setOwner] = useState(defaultOwnerMine ? "me" : "");
  const [priority, setPriority] = useState<Priority | "">("");
  const [source, setSource] = useState<TaskSource>("");
  const [query, setQuery] = useState("");
  const [dragOver, setDragOver] = useState<TaskStatus | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const view = (params.get("view") as View) || "all";

  const setView = (next: View) => router.replace(next === "all" ? pathname : `${pathname}?view=${next}`, { scroll: false });

  const filtered = useMemo(() => {
    if (!state || !workspace) return [];
    const term = query.trim().toLowerCase();
    const today = todayKey();
    return sortTasks(
      state.tasks.filter((task) => {
        if (scope === "sales" && !isSalesScopedTask(task)) return false;
        if (owner && (owner === "none" ? task.ownerId !== null : task.ownerId !== owner)) return false;
        if (priority && task.priority !== priority) return false;
        if (source && task.origin !== source) return false;
        if (term) {
          const leadName = task.leadId ? workspace.leadById.get(task.leadId)?.name ?? "" : "";
          if (!`${task.title} ${task.description} ${leadName}`.toLowerCase().includes(term)) return false;
        }
        if (view === "overdue") return isOpen(task) && task.due !== null && task.due < today;
        if (view === "dismissed") return task.status === "dismissed";
        if (view !== "all") return task.status === view;
        return task.status !== "dismissed";
      }),
    );
  }, [state, workspace, owner, priority, source, query, view, scope]);

  const suggestions = useMemo(() => {
    if (!state || !workspace) return [];
    const openLeadIds = new Set(state.tasks.filter(isOpen).map((task) => task.leadId).filter(Boolean));
    const acceptedTitles = new Set(
      state.tasks
        .filter((task) => task.origin === "suggestion" && isOpen(task))
        .map((task) => `${task.leadId}:${task.title.trim().toLowerCase()}`),
    );
    return workspace.suggestions.filter((item) => {
      if (state.decisions[item.id]) return false;
      if (openLeadIds.has(item.leadId)) return false;
      if (acceptedTitles.has(`${item.leadId}:${item.title.trim().toLowerCase()}`)) return false;
      if (query.trim()) {
        const leadName = workspace.leadById.get(item.leadId)?.name ?? "";
        if (!`${item.title} ${leadName}`.toLowerCase().includes(query.trim().toLowerCase())) return false;
      }
      return true;
    });
  }, [state, workspace, query]);

  if (!state || !workspace) {
    return (
      <div className="page">
        <SkeletonRows rows={6} height={70} />
      </div>
    );
  }

  const memberById = new Map(state.members.map((member) => [member.id, member]));
  const scopedTasks = scope === "sales" ? state.tasks.filter(isSalesScopedTask) : state.tasks;
  const counts = { ...taskCounts(scopedTasks), dismissed: scopedTasks.filter((task) => task.status === "dismissed").length };
  const today = todayKey();
  const useBoard = layout === "board" && view !== "dismissed";
  const openScopedTasks = scopedTasks.filter(isOpen);
  const overdueScopedTasks = sortTasks(openScopedTasks.filter((task) => task.due !== null && task.due < today));
  const unassignedScopedTasks = openScopedTasks.filter((task) => !task.ownerId);
  const priorityTask = overdueScopedTasks[0] ?? sortTasks(openScopedTasks)[0] ?? null;

  const relatedFor = (task: Task) => {
    const reqMatch = task.description.match(/\[requirement:([^\]]+)\]/);
    if (reqMatch) {
      const requirement = state.tessiant?.requirements.find((item) => item.id === reqMatch[1]);
      if (requirement) {
        return task.description.includes("[pulse-insight:") ? `${requirement.title} · Pulse` : requirement.title;
      }
    }
    if (task.leadId) return workspace.leadById.get(task.leadId)?.name ?? null;
    if (task.opportunityId) {
      return (state.opportunities ?? []).find((item) => item.id === task.opportunityId)?.name ?? null;
    }
    if (task.accountId) {
      return state.tessiant?.accounts.find((item) => item.id === task.accountId)?.name ?? null;
    }
    return null;
  };

  const onDrop = (event: DragEvent, status: TaskStatus) => {
    event.preventDefault();
    setDragOver(null);
    setDraggingId(null);
    const id = event.dataTransfer.getData("text/task-id");
    const task = state.tasks.find((item) => item.id === id);
    if (task && task.status !== status) {
      crm.setTaskStatus(id, status);
      toast(`Moved to ${COLUMNS.find((column) => column.status === status)?.label}`);
    }
  };

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>{title}</h1>
          <p className="subtitle">{subtitle}</p>
        </div>
        <div className="page-actions">
          <Button icon="plus" className="mobile-icon-button mobile-main-button" aria-label="New task" onClick={() => openTaskForm()}>
            <span className="mobile-icon-label">New task</span>
          </Button>
        </div>
      </header>

      <section className={styles.summaryBar} aria-label="Task summary">
        <button type="button" className={view === "all" ? styles.summaryActive : undefined} onClick={() => setView("all")}>
          Open <b className="tabular">{counts.pending + counts.in_progress}</b>
        </button>
        <button type="button" className={view === "overdue" ? styles.summaryActive : undefined} onClick={() => setView(view === "overdue" ? "all" : "overdue")}>
          Overdue <b className={`tabular ${counts.overdue ? styles.overdueText : ""}`}>{counts.overdue}</b>
        </button>
        <Select
          className={`select ${styles.filter}`}
          value={view === "completed" || view === "dismissed" ? view : ""}
          onChange={(event) => {
            const next = event.target.value as View | "";
            setView(next === "completed" || next === "dismissed" ? next : "all");
          }}
          aria-label="Closed tasks"
        >
          <option value="">Closed…</option>
          <option value="completed">Done ({counts.completed})</option>
          <option value="dismissed">Dismissed ({counts.dismissed})</option>
        </Select>
      </section>

      {scope === "sales" && (
        <button
          type="button"
          className={styles.intelligence}
          disabled={!priorityTask}
          onClick={() => priorityTask && openTask(priorityTask.id)}
        >
          <span>
            <small>Sales activity insight</small>
            <b>
              {overdueScopedTasks.length > 0
                ? `${overdueScopedTasks.length} overdue ${overdueScopedTasks.length === 1 ? "activity needs" : "activities need"} attention`
                : `${openScopedTasks.length} open sales ${openScopedTasks.length === 1 ? "activity" : "activities"} are on schedule`}
            </b>
          </span>
          <span>
            {priorityTask ? `Start with “${priorityTask.title}”${unassignedScopedTasks.length ? ` · ${unassignedScopedTasks.length} unassigned` : ""}` : "No open sales activity requires action."}
          </span>
          {priorityTask ? <Icon name="arrowRight" size={15} /> : null}
        </button>
      )}

      <section className={styles.toolbar}>
        <label className={styles.search}>
          <Icon name="search" size={15} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search tasks" aria-label="Search tasks" />
        </label>
        <Select className={`select ${styles.filter}`} value={owner} onChange={(event) => setOwner(event.target.value)} aria-label="Owner">
          <option value="">All owners</option>
          <option value="none">Unassigned</option>
          {state.members.map((member) => (
            <option key={member.id} value={member.id}>
              {member.id === "me" ? "Me" : member.name}
            </option>
          ))}
        </Select>
        <Select className={`select ${styles.filter}`} value={priority} onChange={(event) => setPriority(event.target.value as Priority | "")} aria-label="Priority">
          <option value="">All priorities</option>
          {PRIORITIES.map((item) => (
            <option key={item} value={item}>
              {item[0].toUpperCase() + item.slice(1)}
            </option>
          ))}
        </Select>
        <Select className={`select ${styles.filter}`} value={source} onChange={(event) => setSource(event.target.value as TaskSource)} aria-label="Task source">
          {SOURCES.map(([value, label]) => (
            <option key={value || "all"} value={value}>
              {label}
            </option>
          ))}
        </Select>
        <div className="segmented" role="group" aria-label="Layout">
          <button type="button" aria-pressed={layout === "board"} onClick={() => setLayout("board")}>
            Board
          </button>
          <button type="button" aria-pressed={layout === "list"} onClick={() => setLayout("list")}>
            List
          </button>
        </div>
      </section>

      {useBoard ? (
        <section className={styles.board} aria-label="Task board">
          {COLUMNS.map((column) => {
            const items = filtered.filter((task) => task.status === column.status);
            const columnOverdue = column.status === "pending" ? items.filter((task) => task.due !== null && task.due < today).length : 0;
            return (
              <div
                key={column.status}
                className={`${styles.column} ${dragOver === column.status ? styles.columnOver : ""}`}
                onDragOver={(event) => {
                  event.preventDefault();
                  setDragOver(column.status);
                }}
                onDragLeave={() => setDragOver((current) => (current === column.status ? null : current))}
                onDrop={(event) => onDrop(event, column.status)}
              >
                <div className={styles.columnHead}>
                  <div>
                    <p className={styles.columnTitle}>{column.label}</p>
                    {columnOverdue > 0 && <p className={styles.overdueHint}>{columnOverdue} overdue</p>}
                  </div>
                  <span className={styles.columnCount}>{items.length}</span>
                </div>
                <div className={styles.columnBody}>
                  {items.length === 0 ? (
                    <div className={styles.columnEmpty}>
                      <span>Drop here</span>
                    </div>
                  ) : (
                    items.map((task) => (
                      <div
                        key={task.id}
                        draggable
                        onDragStart={(event) => {
                          event.dataTransfer.setData("text/task-id", task.id);
                          event.dataTransfer.effectAllowed = "move";
                          setDraggingId(task.id);
                        }}
                        onDragEnd={() => {
                          setDraggingId(null);
                          setDragOver(null);
                        }}
                        className={`${styles.draggable} ${draggingId === task.id ? styles.dragging : ""}`}
                      >
                        <TaskCard
                          task={task}
                          owner={task.ownerId ? memberById.get(task.ownerId) : null}
                          relatedLabel={relatedFor(task)}
                          dragging={draggingId === task.id}
                        />
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </section>
      ) : (
        <section className="card">
          {filtered.length === 0 ? (
            <div style={{ padding: 16 }}>
              <EmptyState icon="tasks" title="No tasks match" actions={<Button size="small" icon="plus" onClick={() => openTaskForm()}>New task</Button>} />
            </div>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Task</th>
                    <th>Related</th>
                    <th>Status</th>
                    <th>Priority</th>
                    <th>Due</th>
                    <th>Owner</th>
                    <th>Source</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((task: Task) => {
                    const related = relatedFor(task);
                    const due = dueLabel(task.due, task.status);
                    return (
                      <tr key={task.id} className="clickable" onClick={() => openTask(task.id)}>
                        <td className={styles.taskCell}>
                          <b>{task.title}</b>
                        </td>
                        <td>
                          {related ? <span>{related}</span> : <span className="muted">—</span>}
                        </td>
                        <td>
                          <TaskStatusChip status={task.status} />
                        </td>
                        <td>
                          <PriorityChip priority={task.priority} />
                        </td>
                        <td className={due.tone === "overdue" ? styles.overdueText : undefined}>{due.text}</td>
                        <td>
                          <span className={styles.ownerCell}>
                            <MemberAvatar member={task.ownerId ? memberById.get(task.ownerId) : null} />
                            {task.ownerId ? memberById.get(task.ownerId)?.name : "Unassigned"}
                          </span>
                        </td>
                        <td>
                          <span className="tag">{task.origin === "suggestion" ? "Qiko" : task.origin === "copilot" ? "Ask Qiko" : "Manual"}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {suggestions.length > 0 && !suggestionsOpen && (
        <button type="button" className={styles.suggestionToggle} onClick={() => setSuggestionsOpen(true)}>
          <span>
            <Icon name="sparkles" size={14} />
            Suggested by Qiko ({suggestions.length})
          </span>
          <span className="muted">Open panel</span>
        </button>
      )}

      {suggestionsOpen && (
        <Drawer
          kicker="Recommendations"
          title={`Suggested by Qiko (${suggestions.length})`}
          onClose={() => setSuggestionsOpen(false)}
          width={480}
          focusPanel
        >
          <p className={styles.panelIntro}>Recommendations only — accept to create a task. Accepted items are hidden here.</p>
          <div className={styles.suggestionStack}>
            {suggestions.length === 0 ? (
              <EmptyState icon="checkCircle" title="No open recommendations" />
            ) : (
              suggestions.map((suggestion) => (
                <SuggestionCard key={suggestion.id} suggestion={suggestion} lead={workspace.leadById.get(suggestion.leadId)} />
              ))
            )}
          </div>
        </Drawer>
      )}

    </div>
  );
}
