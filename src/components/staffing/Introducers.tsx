"use client";

import Link from "next/link";
import { useMemo } from "react";
import type { CrmState } from "@/lib/types";
import type { ClientRequirement } from "@/lib/tessiant-types";
import { crm } from "@/lib/crm-store";
import { introducersFor, introductionRequestTask } from "@/lib/introductions";
import { avatarStyle, initials } from "@/lib/format";
import Button from "@/components/ui/Button";
import Icon from "@/components/ui/Icon";
import IconTile from "@/components/ui/IconTile";
import { useWorkspace } from "@/components/shell/WorkspaceContext";
import styles from "./Introducers.module.css";

/**
 * "Who could introduce": named first-degree associates who can open their network for this brief,
 * with a one-click introduction request that lands as a task on the resource manager's board.
 */
export default function Introducers({ state, requirement }: { state: CrmState; requirement: ClientRequirement }) {
  const { toast, openTask } = useWorkspace();
  const introducers = useMemo(() => introducersFor(state, requirement), [state, requirement]);
  const accountName = state.tessiant?.accounts.find((item) => item.id === requirement.accountId)?.name ?? "the client";
  if (introducers.length === 0) return null;
  const reachTotal = introducers.reduce((sum, item) => sum + item.reach, 0);

  const request = (index: number) => {
    const introducer = introducers[index];
    const task = introductionRequestTask(introducer, requirement, accountName);
    const taskId = crm.createTask(
      { ...task, priority: "medium", due: null, ownerId: introducer.associate.ownerId ?? "me", leadId: null, accountId: requirement.accountId },
      "suggestion",
      [
        { label: `${introducer.overlap.length} shared skill${introducer.overlap.length === 1 ? "" : "s"} with the brief`, detail: introducer.overlap.join(", ") || requirement.sector, source: "Talent Network", kind: "fact" },
        { label: `About ${introducer.reach} matching profiles one introduction away`, source: "Second-degree reach", kind: "inference" },
      ],
    );
    toast(`Introduction request raised for ${introducer.associate.name}`);
    openTask(taskId);
  };

  return (
    <section className={`card ${styles.card}`} aria-labelledby="introducers-title" id="introducers">
      <div className={styles.head}>
        <div className={styles.headCopy}>
          <IconTile name="handshake" tone="qiko" size="md" />
          <div>
            <p className="kicker kicker-qiko">Qiko · Named introductions</p>
            <h2 id="introducers-title">Who could introduce a {requirement.title}</h2>
            <p className={styles.sub}>
              First-degree associates who share this brief&apos;s skills or sector. Between them about <b className="tabular">{reachTotal}</b> matching profiles sit one introduction away
              <span className="chip chip-demo">estimate</span>
            </p>
          </div>
        </div>
      </div>
      <ol className={styles.list}>
        {introducers.map((item, index) => (
          <li key={item.associate.id} className={styles.row} style={{ animationDelay: `${index * 40}ms` }}>
            <Link href={`/staffing/associates/${item.associate.id}`} className={styles.who}>
              <span className="avatar" style={avatarStyle(item.associate.name)}>
                {initials(item.associate.name)}
              </span>
              <span>
                <b>{item.associate.name}</b>
                <small>{item.associate.roleType === "SIA" ? "Senior Industry Advisor" : item.associate.headline}</small>
              </span>
            </Link>
            <div className={styles.why}>
              <div className={styles.chips}>
                {item.overlap.map((skill) => (
                  <span key={skill} className="chip">
                    {skill}
                  </span>
                ))}
                {item.sectorMatch ? <span className="chip chip-ai">{requirement.sector}</span> : null}
              </div>
              <small>
                {item.introductionsMade > 0 ? `${item.introductionsMade} introduction${item.introductionsMade === 1 ? "" : "s"} on record · ` : ""}
                {item.associate.priorPlacementCount} prior placement{item.associate.priorPlacementCount === 1 ? "" : "s"} · ≈{item.reach} one intro away
              </small>
            </div>
            <div className={styles.action}>
              {item.request ? (
                <button type="button" className={styles.requested} onClick={() => openTask(item.request!.id)}>
                  <Icon name="checkCircle" size={13} /> Requested
                </button>
              ) : (
                <Button size="small" variant="qiko" icon="handshake" onClick={() => request(index)}>
                  Request intro
                </Button>
              )}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
