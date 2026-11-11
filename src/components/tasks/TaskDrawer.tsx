"use client";

import Link from "next/link";
import { useState } from "react";
import { crm, type TaskInput } from "@/lib/crm-store";
import { insightIdFromTask, requirementIdFromTask } from "@/lib/pulse-journey";
import { dueLabel, formatDateTime, timeAgo } from "@/lib/format";
import { PRIORITIES, type Priority, type Task, type TaskStatus } from "@/lib/types";
import Button from "@/components/ui/Button";
import Icon from "@/components/ui/Icon";
import { ConfirmDialog, Drawer } from "@/components/ui/Overlay";
import { AiChip, EvidenceList, LeadStatusChip, PriorityChip, TaskStatusChip, taskStatusLabel, useWorkspaceData } from "@/components/ui/bits";
import { useWorkspace } from "@/components/shell/WorkspaceContext";
import styles from "./Tasks.module.css";

export default function TaskDrawer({ taskId, onClose }: { taskId: string; onClose: () => void }) {
  const { state, workspace } = useWorkspaceData();
  const task = state?.tasks.find((item) => item.id === taskId);
  if (!state || !workspace) return null;
  if (!task) {
    return (
      <Drawer title="Task not found" onClose={onClose}>
        <p className="muted">This task may have been deleted.</p>
      </Drawer>
    );
  }
  return <TaskDrawerBody key={task.updatedAt} task={task} onClose={onClose} />;
}

function TaskDrawerBody({ task, onClose }: { task: Task; onClose: () => void }) {
  const { state, workspace } = useWorkspaceData();
  const { toast, askQiko } = useWorkspace();
  const [draft, setDraft] = useState<TaskInput>({ title: task.title, description: task.description, priority: task.priority, due: task.due, ownerId: task.ownerId, leadId: task.leadId });
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [resultNote, setResultNote] = useState("");
  const [awaitingResult, setAwaitingResult] = useState(false);
  if (!state || !workspace) return null;

  const lead = task.leadId ? workspace.leadById.get(task.leadId) : undefined;
  const memberName = (id: string) => (id === "me" ? "You" : state.members.find((member) => member.id === id)?.name ?? "Former member");
  const dirty = (Object.keys(draft) as (keyof TaskInput)[]).some((key) => draft[key] !== task[key as keyof Task]);
  const due = dueLabel(task.due, task.status);
  const closed = task.status === "completed" || task.status === "dismissed";
  const pulseInsightId = insightIdFromTask(task.description);
  const requirementId = requirementIdFromTask(task.description);
  const requirement = requirementId ? state.tessiant?.requirements.find((item) => item.id === requirementId) : null;
  const pulseOutcome = pulseInsightId
    ? state.tessiant?.pulse?.outcomes.find((item) => item.insightId === pulseInsightId)
    : null;

  const setStatus = (status: TaskStatus, message: string) => {
    crm.setTaskStatus(task.id, status);
    toast(message);
  };

  const save = () => {
    if (draft.title.trim().length < 3) {
      toast("Task title is too short", "error");
      return;
    }
    crm.updateTask(task.id, draft);
    toast("Task updated");
  };

  return (
    <Drawer
      kicker={task.origin === "suggestion" ? "Accepted suggestion" : task.origin === "copilot" ? "Created with Ask Qiko" : "Task"}
      title={task.title}
      onClose={onClose}
      focusPanel
      actions={<Button variant="ghost" size="small" icon="trash" aria-label="Delete task" onClick={() => setConfirmDelete(true)} />}
      footer={
        <>
          {dirty && (
            <Button variant="secondary" onClick={save} icon="check">
              Save changes
            </Button>
          )}
          {task.status === "pending" && <Button variant="secondary" icon="zap" onClick={() => setStatus("in_progress", "Task started")}>Start</Button>}
          {!closed && <Button variant="ghost" onClick={() => setStatus("dismissed", pulseInsightId ? "Recommendation dismissed and recorded" : "Task dismissed")}>Dismiss</Button>}
          {!closed && (
            <Button
              icon="checkCircle"
              onClick={() => {
                if (dirty) crm.updateTask(task.id, draft);
                if (pulseInsightId) {
                  if (!resultNote.trim()) {
                    setAwaitingResult(true);
                    toast("Record the result before completing — this is not commercial value", "info");
                    return;
                  }
                  crm.recordPulseOutcome({
                    insightId: pulseInsightId,
                    taskId: task.id,
                    status: "completed",
                    summary: resultNote.trim(),
                    realisedRevenue: null,
                    pipelinePotential: null,
                    estimatedTimeSavedHours: null,
                    qualitativeBenefit: null,
                    sourceEntityIds: requirementId ? [requirementId] : [],
                  });
                  toast("Result recorded in Pulse. Value can be added separately if evidence exists.");
                  return;
                }
                setStatus("completed", "Task completed");
              }}
            >
              Mark completed
            </Button>
          )}
          {closed && <Button variant="secondary" icon="undo" onClick={() => setStatus("pending", "Task reopened")}>Reopen</Button>}
        </>
      }
    >
      <div className={styles.drawerMeta}>
        <TaskStatusChip status={task.status} />
        <PriorityChip priority={task.priority} />
        <span className={`${styles.due} ${styles[due.tone]}`}>
          <Icon name="calendar" size={12} /> {due.text}
        </span>
        {task.origin === "suggestion" && <AiChip />}
      </div>

      {(requirement || pulseInsightId) && (
        <section className={styles.section}>
          <h3 className="kicker">Linked records</h3>
          {requirement ? (
            <Link href={`/staffing/requirements/${requirement.id}`} className={styles.leadCard} onClick={onClose}>
              <span className="avatar">RQ</span>
              <span className={styles.leadCardText}>
                <b>{requirement.title}</b>
                <small>Client requirement · {requirement.stage}</small>
              </span>
              <Icon name="chevronRight" size={16} />
            </Link>
          ) : null}
          {pulseInsightId ? (
            <Link href="/pulse/insights" className={styles.leadCard} onClick={onClose}>
              <span className="avatar">P</span>
              <span className={styles.leadCardText}>
                <b>Pulse insight</b>
                <small>{pulseInsightId}{pulseOutcome ? ` · ${pulseOutcome.status.replace("_", " ")}` : ""}</small>
              </span>
              <Icon name="chevronRight" size={16} />
            </Link>
          ) : null}
        </section>
      )}

      {lead && (
        <Link href={`/sales/leads/${lead.id}`} className={styles.leadCard} onClick={onClose}>
          <span className="avatar">{lead.name.split(" ").map((part) => part[0]).join("").slice(0, 2)}</span>
          <span className={styles.leadCardText}>
            <b>{lead.name}</b>
            <small>{lead.company ?? lead.email} · {lead.lastActivity ? `${lead.lastActivity.title} ${timeAgo(lead.lastActivity.occurredAt)}` : "No activity"}</small>
          </span>
          <LeadStatusChip status={lead.status} />
          <Icon name="chevronRight" size={16} />
        </Link>
      )}

      <section className={styles.section}>
        <h3 className="kicker">Details</h3>
        <div className="form-grid">
          <label className="field">
            <span>Title</span>
            <input className="input" value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} />
          </label>
          <label className="field">
            <span>Description</span>
            <textarea className="textarea" rows={3} value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} placeholder="Add context or the outcome you're after" />
          </label>
          <div className="form-row">
            <label className="field">
              <span>Owner</span>
              <select className="select" value={draft.ownerId ?? ""} onChange={(event) => setDraft({ ...draft, ownerId: event.target.value || null })}>
                <option value="">Unassigned</option>
                {state.members.map((member) => (
                  <option key={member.id} value={member.id}>{member.id === "me" ? `${member.name} (you)` : member.name}</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Priority</span>
              <select className="select" value={draft.priority} onChange={(event) => setDraft({ ...draft, priority: event.target.value as Priority })}>
                {PRIORITIES.map((priority) => <option key={priority} value={priority}>{priority[0].toUpperCase() + priority.slice(1)}</option>)}
              </select>
            </label>
          </div>
          <div className="form-row">
            <label className="field">
              <span>Due date</span>
              <input className="input" type="date" value={draft.due ?? ""} onChange={(event) => setDraft({ ...draft, due: event.target.value || null })} />
            </label>
            <label className="field">
              <span>Linked lead</span>
              <select className="select" value={draft.leadId ?? ""} onChange={(event) => setDraft({ ...draft, leadId: event.target.value || null })}>
                <option value="">None</option>
                {[...state.leads].sort((a, b) => a.name.localeCompare(b.name)).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </label>
          </div>
        </div>
      </section>

      {task.evidence.length > 0 && (
        <section className={styles.section}>
          <h3 className="kicker">Why this task exists</h3>
          <EvidenceList items={task.evidence} />
        </section>
      )}

      {pulseInsightId && !closed ? (
        <section className={styles.section}>
          <h3 className="kicker">Record result</h3>
          <p className={styles.historyNote}>
            Completing this Pulse action records an operational result. It does not book placement or revenue.
          </p>
          <label className="field">
            <span>What did you do?</span>
            <textarea
              className="textarea"
              rows={3}
              value={resultNote}
              onChange={(event) => setResultNote(event.target.value)}
              placeholder="e.g. Re-verified Jonas Berg (limited) and opened sourcing to two additional SAP architects."
            />
          </label>
          {awaitingResult && !resultNote.trim() ? <p className="muted">Add a short result before completing.</p> : null}
        </section>
      ) : null}

      {pulseOutcome ? (
        <section className={styles.section}>
          <h3 className="kicker">Pulse outcome</h3>
          <p>{pulseOutcome.summary}</p>
          <p className={styles.historyNote}>
            {pulseOutcome.status.replace("_", " ")}
            {pulseOutcome.value.realisedRevenue != null
              ? ` · realised £${pulseOutcome.value.realisedRevenue.toLocaleString("en-GB")}`
              : " · no commercial value recorded"}
          </p>
          {pulseOutcome.status === "completed" ? (
            <Link href="/pulse/value" className="text-link" onClick={onClose}>
              Record value separately if evidence exists
            </Link>
          ) : null}
        </section>
      ) : null}

      {lead && (
        <section className={styles.section}>
          <button type="button" className={styles.askRow} onClick={() => askQiko(`Tell me everything about ${lead.name}`, lead.id)}>
            <Icon name="sparkles" size={15} />
            Ask Qiko for context on {lead.name.split(" ")[0]}
            <Icon name="arrowRight" size={14} />
          </button>
        </section>
      )}

      <section className={styles.section}>
        <h3 className="kicker">Completion history</h3>
        <ol className={styles.history}>
          {[...task.history].reverse().map((entry, index) => (
            <li key={`${entry.at}-${index}`}>
              <span className={styles.historyDot} />
              <div>
                <b>{entry.action}</b>
                <small>{memberName(entry.actorId)} · {formatDateTime(entry.at)}</small>
              </div>
            </li>
          ))}
        </ol>
        <p className={styles.historyNote}>Current status: {taskStatusLabel(task.status)}{task.completedAt ? ` · completed ${timeAgo(task.completedAt)}` : ""}</p>
      </section>

      {confirmDelete && (
        <ConfirmDialog
          tone="danger"
          title="Delete this task?"
          description="The task and its history will be removed. Use Dismiss instead if you want to keep a record."
          confirmLabel="Delete task"
          onCancel={() => setConfirmDelete(false)}
          onConfirm={() => {
            crm.deleteTask(task.id);
            toast("Task deleted", "info");
            onClose();
          }}
        />
      )}
    </Drawer>
  );
}
