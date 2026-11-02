"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState, type DragEvent } from "react";
import { crm } from "@/lib/crm-store";
import { dueLabel, todayKey } from "@/lib/format";
import { isOpen, sortTasks, taskCounts } from "@/lib/insights";
import { PRIORITIES, type Priority, type Task, type TaskStatus } from "@/lib/types";
import Button from "@/components/ui/Button";
import Icon from "@/components/ui/Icon";
import { EmptyState, MemberAvatar, PriorityChip, SkeletonRows, TaskStatusChip, useWorkspaceData } from "@/components/ui/bits";
import SuggestionCard from "@/components/tasks/SuggestionCard";
import TaskCard from "@/components/tasks/TaskCard";
import { useWorkspace } from "@/components/shell/WorkspaceContext";
import styles from "./actions.module.css";

const COLUMNS: { status: TaskStatus; label: string; hint: string }[] = [
  { status: "pending", label: "Pending", hint: "Accepted and waiting to start" },
  { status: "in_progress", label: "In progress", hint: "Being worked right now" },
  { status: "completed", label: "Completed", hint: "Done — kept for history" },
];

type View = "all" | "pending" | "in_progress" | "completed" | "overdue" | "dismissed";

export default function ActionsPage() {
  return (
    <Suspense fallback={<div className="page"><SkeletonRows rows={6} height={70} /></div>}>
      <ActionWorkspace />
    </Suspense>
  );
}

function ActionWorkspace() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { state, workspace } = useWorkspaceData();
  const { openTaskForm, openTask, toast, askQiko } = useWorkspace();
  const [layout, setLayout] = useState<"board" | "list">("board");
  const [owner, setOwner] = useState("");
  const [priority, setPriority] = useState<Priority | "">("");
  const [query, setQuery] = useState("");
  const [showAllSuggestions, setShowAllSuggestions] = useState(false);
  const [dragOver, setDragOver] = useState<TaskStatus | null>(null);
  const view = (params.get("view") as View) || "all";

  const setView = (next: View) => router.replace(next === "all" ? pathname : `${pathname}?view=${next}`, { scroll: false });

  const filtered = useMemo(() => {
    if (!state || !workspace) return [];
    const term = query.trim().toLowerCase();
    const today = todayKey();
    return sortTasks(
      state.tasks.filter((task) => {
        if (owner && (owner === "none" ? task.ownerId !== null : task.ownerId !== owner)) return false;
        if (priority && task.priority !== priority) return false;
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
  }, [state, workspace, owner, priority, query, view]);

  if (!state || !workspace) {
    return (
      <div className="page">
        <SkeletonRows rows={6} height={70} />
      </div>
    );
  }

  const memberById = new Map(state.members.map((member) => [member.id, member]));
  const counts = { ...taskCounts(state.tasks), dismissed: state.tasks.filter((task) => task.status === "dismissed").length };
  const suggestions = workspace.suggestions.filter((item) => !query.trim() || `${item.title} ${workspace.leadById.get(item.leadId)?.name}`.toLowerCase().includes(query.trim().toLowerCase()));
  const visibleSuggestions = showAllSuggestions ? suggestions : suggestions.slice(0, 4);
  const boardStatuses = view === "all" || view === "overdue" ? COLUMNS : COLUMNS.filter((column) => column.status === view);
  const useBoard = layout === "board" && view !== "dismissed";

  const onDrop = (event: DragEvent, status: TaskStatus) => {
    event.preventDefault();
    setDragOver(null);
    const id = event.dataTransfer.getData("text/task-id");
    const task = state.tasks.find((item) => item.id === id);
    if (task && task.status !== status) {
      crm.setTaskStatus(id, status);
      toast(`Moved to ${COLUMNS.find((column) => column.status === status)?.label}`);
    }
  };

  const tiles: { key: View; label: string; value: number; tone?: string }[] = [
    { key: "all", label: "All open", value: counts.pending + counts.in_progress },
    { key: "pending", label: "Pending", value: counts.pending, tone: "pending" },
    { key: "in_progress", label: "In progress", value: counts.in_progress, tone: "progress" },
    { key: "completed", label: "Completed", value: counts.completed, tone: "done" },
    { key: "overdue", label: "Overdue", value: counts.overdue, tone: "overdue" },
  ];

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Actions</h1>
          <p className="subtitle">Qiko turns sign-ups, scans and enquiries into suggested actions. Accept, edit, dismiss or complete them — every action keeps its evidence and history.</p>
        </div>
        <div className="page-actions">
          <Button variant="secondary" icon="sparkles" className="mobile-icon-button" aria-label="Ask about actions" onClick={() => askQiko("What actions are pending?")}><span className="mobile-icon-label">Ask about actions</span></Button>
          <Button icon="plus" className="mobile-icon-button" aria-label="New task" onClick={() => openTaskForm()}><span className="mobile-icon-label">New task</span></Button>
        </div>
      </header>

      <section className={styles.tiles}>
        {tiles.map((tile) => (
          <button type="button" key={tile.key} className={`${styles.tile} ${view === tile.key ? styles.tileActive : ""}`} onClick={() => setView(tile.key)} aria-pressed={view === tile.key}>
            <span className={styles.tileLabel}>
              {tile.tone && <i className={styles[tile.tone]} />}
              {tile.label}
            </span>
            <b className="tabular">{tile.value}</b>
          </button>
        ))}
      </section>

      <section className={styles.toolbar}>
        <label className={styles.search}>
          <Icon name="search" size={15} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search tasks or leads" aria-label="Search tasks" />
        </label>
        <select className={`select ${styles.filter}`} value={owner} onChange={(event) => setOwner(event.target.value)} aria-label="Owner">
          <option value="">All owners</option>
          <option value="none">Unassigned</option>
          {state.members.map((member) => <option key={member.id} value={member.id}>{member.id === "me" ? "Me" : member.name}</option>)}
        </select>
        <select className={`select ${styles.filter}`} value={priority} onChange={(event) => setPriority(event.target.value as Priority | "")} aria-label="Priority">
          <option value="">All priorities</option>
          {PRIORITIES.map((item) => <option key={item} value={item}>{item[0].toUpperCase() + item.slice(1)} priority</option>)}
        </select>
        <button type="button" className={`${styles.dismissedToggle} ${view === "dismissed" ? styles.tileActive : ""}`} onClick={() => setView(view === "dismissed" ? "all" : "dismissed")}>
          Dismissed · {counts.dismissed}
        </button>
        <div className="segmented" role="group" aria-label="Layout">
          <button type="button" aria-pressed={layout === "board"} onClick={() => setLayout("board")}>
            <Icon name="board" size={14} /> Board
          </button>
          <button type="button" aria-pressed={layout === "list"} onClick={() => setLayout("list")}>
            <Icon name="list" size={14} /> List
          </button>
        </div>
      </section>

      {useBoard ? (
        <section className={styles.board} style={{ gridTemplateColumns: `repeat(${boardStatuses.length}, minmax(0, 1fr))` }}>
          {boardStatuses.map((column) => {
            const items = filtered.filter((task) => task.status === column.status);
            return (
              <div
                key={column.status}
                className={`${styles.column} ${dragOver === column.status ? styles.columnOver : ""}`}
                onDragOver={(event) => { event.preventDefault(); setDragOver(column.status); }}
                onDragLeave={() => setDragOver(null)}
                onDrop={(event) => onDrop(event, column.status)}
              >
                <div className={styles.columnHead}>
                  <div>
                    <p className={styles.columnTitle}>{column.label}</p>
                    <p className={styles.columnHint}>{column.hint}</p>
                  </div>
                  <span className={styles.columnCount}>{items.length}</span>
                </div>
                <div className={styles.columnBody}>
                  {items.length === 0 ? (
                    <div className={styles.columnEmpty}>
                      <b>Nothing here</b>
                      <span>{column.status === "completed" ? "Completed tasks land here." : "Drag a task here or create one."}</span>
                    </div>
                  ) : (
                    items.map((task) => (
                      <div key={task.id} draggable onDragStart={(event) => { event.dataTransfer.setData("text/task-id", task.id); event.dataTransfer.effectAllowed = "move"; }} className={styles.draggable}>
                        <TaskCard task={task} owner={task.ownerId ? memberById.get(task.ownerId) : null} leadName={task.leadId ? workspace.leadById.get(task.leadId)?.name : null} />
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
              <EmptyState icon="tasks" title="No tasks match" actions={<Button size="small" icon="plus" onClick={() => openTaskForm()}>New task</Button>}>Try clearing the filters.</EmptyState>
            </div>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Task</th>
                    <th>Linked lead</th>
                    <th>Status</th>
                    <th>Priority</th>
                    <th>Due</th>
                    <th>Owner</th>
                    <th aria-label="Actions" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((task: Task) => {
                    const lead = task.leadId ? workspace.leadById.get(task.leadId) : undefined;
                    const due = dueLabel(task.due, task.status);
                    return (
                      <tr key={task.id} className="clickable" onClick={() => openTask(task.id)}>
                        <td className={styles.taskCell}>
                          <b>{task.title}</b>
                          {task.origin !== "manual" && <small>{task.origin === "suggestion" ? "From Qiko suggestion" : "From Ask Qiko"}</small>}
                        </td>
                        <td onClick={(event) => event.stopPropagation()}>{lead ? <Link href={`/sales/leads/${lead.id}`}>{lead.name}</Link> : <span className="muted">—</span>}</td>
                        <td><TaskStatusChip status={task.status} /></td>
                        <td><PriorityChip priority={task.priority} /></td>
                        <td className={due.tone === "overdue" ? styles.overdueText : undefined}>{due.text}</td>
                        <td><span className={styles.ownerCell}><MemberAvatar member={task.ownerId ? memberById.get(task.ownerId) : null} />{task.ownerId ? memberById.get(task.ownerId)?.name : "Unassigned"}</span></td>
                        <td onClick={(event) => event.stopPropagation()}>
                          {isOpen(task) ? (
                            <Button size="small" variant="secondary" icon="check" onClick={() => { crm.setTaskStatus(task.id, "completed"); toast("Task completed"); }}>Complete</Button>
                          ) : (
                            <Button size="small" variant="ghost" icon="undo" onClick={() => { crm.setTaskStatus(task.id, "pending"); toast("Task reopened"); }}>Reopen</Button>
                          )}
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

      <section className={`card ${styles.suggestions}`}>
        <div className="card-head">
          <div>
            <p className="kicker">
              <Icon name="sparkles" size={11} /> Suggested by Qiko
            </p>
            <h2>{suggestions.length ? `${suggestions.length} recommended ${suggestions.length === 1 ? "action" : "actions"}` : "No new suggestions"}</h2>
            <p className="card-sub">Built from recorded activity. Facts are confirmed; recommendations are marked as AI inference.</p>
          </div>
          {suggestions.length > 4 && (
            <button type="button" className="link-button" onClick={() => setShowAllSuggestions((value) => !value)}>
              {showAllSuggestions ? "Show fewer" : `Show all ${suggestions.length}`}
            </button>
          )}
        </div>
        <div className={`card-body ${styles.suggestionGrid}`}>
          {visibleSuggestions.length === 0 ? (
            <EmptyState icon="checkCircle" title="You're all caught up">New Signal sign-ups, scans and enquiries will create suggestions here.</EmptyState>
          ) : (
            visibleSuggestions.map((suggestion) => <SuggestionCard key={suggestion.id} suggestion={suggestion} lead={workspace.leadById.get(suggestion.leadId)} />)
          )}
        </div>
      </section>
    </div>
  );
}
