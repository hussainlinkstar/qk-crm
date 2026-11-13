"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { ASK_INTENTS, PULSE_ASK_INTENTS, answerQuestion, SUGGESTED_QUESTIONS } from "@/lib/copilot";
import { crm } from "@/lib/crm-store";
import { formatDateTime, initials } from "@/lib/format";
import type { CopilotAnswer, Execution } from "@/lib/types";
import Button from "@/components/ui/Button";
import Icon from "@/components/ui/Icon";
import { ConfirmDialog, Drawer } from "@/components/ui/Overlay";
import { EvidenceList, useWorkspaceData } from "@/components/ui/bits";
import { useWorkspace } from "@/components/shell/WorkspaceContext";
import styles from "./Copilot.module.css";

interface Entry {
  answer: CopilotAnswer;
  revealed: boolean;
}

export default function CopilotPanel({ initialQuestion, contextLeadId, onClose }: { initialQuestion?: string; contextLeadId: string | null; onClose: () => void }) {
  const router = useRouter();
  const { state, workspace } = useWorkspaceData();
  const { session, openTaskForm, toast } = useWorkspace();
  const [leadContext, setLeadContext] = useState<string | null>(contextLeadId);
  const pathname = usePathname();
  const [entries, setEntries] = useState<Entry[]>(() =>
    initialQuestion?.trim() && state ? [{ answer: answerQuestion(state, initialQuestion, contextLeadId), revealed: true }] : [],
  );
  const [input, setInput] = useState("");
  const [pending, setPending] = useState<Execution | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [entries]);

  if (!state || !workspace) return null;
  const contextLead = leadContext ? workspace.leadById.get(leadContext) : undefined;

  const ask = (question: string) => {
    const text = question.trim();
    if (!text) return;
    setEntries((current) => [...current, { answer: answerQuestion(state, text, leadContext), revealed: true }]);
    setInput("");
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    ask(input);
  };

  const run = (execution: Execution, answer: CopilotAnswer) => {
    if (execution.type === "open") {
      onClose();
      router.push(execution.href);
      return;
    }
    if (execution.type === "create_task") {
      openTaskForm({ title: "Create task from Ask Qiko", origin: "copilot", evidence: answer.evidence.slice(0, 4), initial: { ...execution.task, ownerId: "me" } });
      return;
    }
    setPending(execution);
  };

  const intents = contextLead
    ? [{ label: "This record", question: `Tell me everything about ${contextLead.name}` }, ...(pathname.startsWith("/pulse") ? PULSE_ASK_INTENTS : ASK_INTENTS).slice(0, 3)]
    : pathname.startsWith("/pulse")
      ? PULSE_ASK_INTENTS
      : ASK_INTENTS;

  return (
    <Drawer
      kicker="AI copilot"
      title={
        <span className={styles.title}>
          <span className={styles.orb}>
            <Icon name="sparkles" size={14} />
          </span>
          Ask Qiko
        </span>
      }
      onClose={onClose}
      width={560}
      actions={entries.length > 0 ? <Button size="small" variant="ghost" icon="refresh" onClick={() => setEntries([])}>New chat</Button> : undefined}
    >
      <div className={styles.wrap}>
        <div className={styles.messages} ref={listRef}>
          {entries.length === 0 && (
            <div className={styles.intro}>
              <span className={styles.introOrb}>
                <Icon name="sparkles" size={22} />
              </span>
              <h3>How can I help, {session.name.split(" ")[0]}?</h3>
              <p>I answer from Tessiant records in this workspace. Facts are marked <b className="evidence-fact">Confirmed</b>; recommendations are marked <b className="evidence-ai">AI inference</b>.</p>
              <div className={styles.starters}>
                {intents.map((intent) => (
                  <button type="button" key={intent.label} onClick={() => ask(intent.question)}>
                    {intent.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {entries.map(({ answer }) => (
            <div key={answer.id} className={styles.turn}>
              <div className={styles.question}>
                <span>{answer.question}</span>
                <span className="avatar avatar-sm">{initials(session.name)}</span>
              </div>
              <article className={styles.answer}>
                  <section>
                    <p className="kicker">Answer</p>
                    <p className={styles.answerText}>{answer.answer}</p>
                    {!answer.grounded && (
                      <div className={styles.starters}>
                        {SUGGESTED_QUESTIONS.slice(0, 3).map((question) => (
                          <button type="button" key={question} onClick={() => ask(question)}>{question}</button>
                        ))}
                      </div>
                    )}
                  </section>
                  {answer.evidence.length > 0 && (
                    <section>
                      <p className="kicker">Evidence · {answer.evidence.length}</p>
                      <EvidenceList items={answer.evidence} compact />
                    </section>
                  )}
                  {answer.recommendation && (
                    <section className={styles.recommendation}>
                      <p className="kicker">Recommended action</p>
                      <p>
                        <Icon name="sparkles" size={13} /> {answer.recommendation}
                      </p>
                    </section>
                  )}
                  {answer.executions.length > 0 && (
                    <section>
                      <p className="kicker">Take action</p>
                      <div className={styles.executions}>
                        {answer.executions.map((execution, index) => (
                          <Button key={`${execution.label}-${index}`} size="small" variant={index === 0 && execution.type !== "open" ? "primary" : "secondary"} icon={execution.type === "create_task" ? "plus" : execution.type === "update_status" ? "flag" : "arrowRight"} onClick={() => run(execution, answer)}>
                            {execution.label}
                          </Button>
                        ))}
                      </div>
                    </section>
                  )}
                  <p className={styles.footnote}>Grounded in workspace records · {formatDateTime(answer.at)}</p>
                </article>
            </div>
          ))}
        </div>

        <form className={styles.composer} onSubmit={submit}>
          {contextLead && (
            <span className={styles.context}>
              <Icon name="users" size={12} /> About {contextLead.name}
              <button type="button" aria-label="Remove lead context" onClick={() => setLeadContext(null)}>
                <Icon name="x" size={12} />
              </button>
            </span>
          )}
          <div className={styles.inputRow}>
            <input value={input} onChange={(event) => setInput(event.target.value)} placeholder="Ask about leads, scans, follow-ups…" aria-label="Ask Qiko a question" data-autofocus />
            <Button type="submit" size="small" icon="arrowUp" aria-label="Send question" disabled={!input.trim()} />
          </div>
        </form>
      </div>

      {pending?.type === "update_status" && (
        <ConfirmDialog
          title={`Update lead status to ${pending.status}?`}
          description={<>This changes <b>{workspace.leadById.get(pending.leadId)?.name}</b> from {workspace.leadById.get(pending.leadId)?.status} to {pending.status} and records it in the activity history.</>}
          confirmLabel="Yes, update"
          onCancel={() => setPending(null)}
          onConfirm={() => {
            crm.setLeadStatus(pending.leadId, pending.status);
            toast(`Status updated to ${pending.status}`);
            setPending(null);
          }}
        />
      )}
    </Drawer>
  );
}
