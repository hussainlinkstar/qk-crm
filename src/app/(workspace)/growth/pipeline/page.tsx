"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, type DragEvent } from "react";
import Button from "@/components/ui/Button";
import { Modal } from "@/components/ui/Overlay";
import { EmptyState, SkeletonRows } from "@/components/ui/bits";
import { useWorkspace } from "@/components/shell/WorkspaceContext";
import { initials } from "@/lib/format";
import { fullName } from "@/lib/signal-growth/engine";
import { growth, useGrowth } from "@/lib/signal-growth/store";
import { STAGES, type Stage } from "@/lib/signal-growth/types";
import styles from "@/app/(workspace)/sales/pipeline/pipeline.module.css";
import signal from "../signal.module.css";
import { PageHero } from "@/components/ui/workspace";

const DOT: Record<Stage, string> = {
  New: signal.dotNew,
  Contacted: signal.dotContacted,
  Replied: signal.dotReplied,
  "Signed up": signal.dotSigned,
  "Audit run": signal.dotAudit,
  "Checkout started": signal.dotCheckout,
  Paid: signal.dotPaid,
  Lost: signal.dotLost,
};

export default function PipelinePage() {
  const state = useGrowth();
  const router = useRouter();
  const { toast } = useWorkspace();
  const [over, setOver] = useState<Stage | null>(null);
  const [lostFor, setLostFor] = useState<string | null>(null);
  const [reason, setReason] = useState("Not a fit");
  const columns = useMemo(() => STAGES.map((stage) => ({ stage, items: state?.leads.filter((lead) => lead.stage === stage) ?? [] })), [state]);
  if (!state) return <div className="page"><SkeletonRows rows={3} /></div>;

  const onDrop = (event: DragEvent, stage: Stage) => {
    event.preventDefault();
    const id = event.dataTransfer.getData("text/lead-id");
    setOver(null);
    const lead = state.leads.find((item) => item.id === id);
    if (!lead || lead.stage === stage) return;
    if (stage === "Lost") {
      setLostFor(id);
      setReason("Not a fit");
      return;
    }
    growth.setStage(id, stage);
    toast(`Stage → ${stage}`);
  };

  return (
    <div className="page">
      <PageHero kicker="Signal" title="Pipeline" lede="New through Paid. Stages after sign-up also move from Signal events on the lead." />
      <div className={signal.pipelineBoard}>
        {columns.map((column) => (
          <section key={column.stage} className={`${styles.column} ${over === column.stage ? styles.columnOver : ""}`} onDragOver={(event) => { event.preventDefault(); setOver(column.stage); }} onDrop={(event) => onDrop(event, column.stage)}>
            <header className={styles.columnHead}>
              <div>
                <div className={styles.columnTitle}><i className={`${signal.stageDot} ${DOT[column.stage]}`} />{column.stage}</div>
              </div>
              <span className={styles.columnCount}>{column.items.length}</span>
            </header>
            <div className={styles.columnBody}>
              {column.items.map((lead) => (
                <article key={lead.id} className={styles.card} draggable onDragStart={(event) => event.dataTransfer.setData("text/lead-id", lead.id)}>
                  <button type="button" className={styles.cardMain} onClick={() => router.push(`/growth/leads/${lead.id}`)}>
                    <span className={styles.person}>
                      <span className="avatar avatar-sm">{initials(fullName(lead))}</span>
                      <span className={styles.personText}><b>{fullName(lead)}</b><small>{lead.company || "No company"}</small></span>
                    </span>
                    <span className={styles.next}>{lead.title || lead.source}{lead.lostReason ? ` · ${lead.lostReason}` : ""}</span>
                  </button>
                  <div className={styles.cardFoot}>
                    <span className={styles.owner}><span className="avatar avatar-sm">{initials(state.owners.find((item) => item.id === lead.ownerId)?.name)}</span><span>{state.owners.find((item) => item.id === lead.ownerId)?.name ?? "Unassigned"}</span></span>
                    <span className="tag">{lead.source}</span>
                  </div>
                </article>
              ))}
              {!column.items.length && (
                <div className={styles.columnEmpty}><b>Empty</b><span>Drop a lead here</span></div>
              )}
            </div>
          </section>
        ))}
      </div>
      {!state.leads.length && <EmptyState icon="board" title="No leads yet" />}
      {lostFor && (
        <Modal kicker="Pipeline" title="Mark lost" description="A reason is kept on the lead." onClose={() => setLostFor(null)} footer={<><Button variant="secondary" onClick={() => setLostFor(null)}>Cancel</Button><Button type="submit" form="pipeline-lost">Mark lost</Button></>}>
          <form id="pipeline-lost" onSubmit={(event) => { event.preventDefault(); growth.setStage(lostFor, "Lost", reason); toast("Stage → Lost"); setLostFor(null); }}>
            <label className="field"><span>Reason</span><input className="input" value={reason} onChange={(event) => setReason(event.target.value)} required /></label>
          </form>
        </Modal>
      )}
    </div>
  );
}
