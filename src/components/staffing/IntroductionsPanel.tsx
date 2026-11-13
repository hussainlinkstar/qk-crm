"use client";

import Link from "next/link";
import { useMemo } from "react";
import type { CrmState } from "@/lib/types";
import type { Associate } from "@/lib/tessiant-types";
import { introductionRequestsBy, introductionsBy } from "@/lib/introductions";
import { compactMoney } from "@/lib/home-tessiant";
import { formatDate } from "@/lib/format";
import Button from "@/components/ui/Button";
import Icon from "@/components/ui/Icon";
import IconTile from "@/components/ui/IconTile";
import CountUp from "@/components/ui/CountUp";
import { EmptyState } from "@/components/ui/bits";
import { useWorkspace } from "@/components/shell/WorkspaceContext";
import styles from "./IntroductionsPanel.module.css";

/**
 * Introductions tab on a talent profile: doors this person has opened (recorded on leads), the
 * open introduction requests to them, and the reach Qiko estimates through their network.
 */
export default function IntroductionsPanel({ state, associate }: { state: CrmState; associate: Associate }) {
  const { openTaskForm, openTask } = useWorkspace();
  const made = useMemo(() => introductionsBy(state, associate.id), [state, associate.id]);
  const requests = useMemo(() => introductionRequestsBy(state, associate.id), [state, associate.id]);
  const reachTable = state.tessiant?.networkStats.secondDegreeBySkill ?? {};
  const reach = associate.skills.reduce((sum, skill) => {
    const key = Object.keys(reachTable).find((item) => item.toLowerCase() === skill.toLowerCase());
    return sum + (key ? Math.round(reachTable[key] / 3) : 0);
  }, 0);
  const won = made.filter((item) => item.opportunity?.stage === "Closed Won");
  const wonValue = won.reduce((sum, item) => sum + (item.opportunity?.agreedContractValue ?? item.opportunity?.amount ?? 0), 0);
  const isSia = associate.roleType === "SIA";

  const ask = () =>
    openTaskForm({
      title: "Introduction request",
      origin: "suggestion",
      initial: {
        title: `Ask ${associate.name} for an introduction`,
        description: `${associate.name}${isSia ? " (SIA)" : ""} · sectors ${associate.sectors.join(", ") || "not recorded"} · skills ${associate.skills.slice(0, 3).join(", ")}. Ask who in their network is planning change this quarter.`,
        priority: "medium",
        due: null,
        ownerId: associate.ownerId ?? "me",
        leadId: null,
      },
      evidence: [{ label: `${made.length} recorded introduction${made.length === 1 ? "" : "s"}`, source: "Leads", kind: "fact" }],
    });

  return (
    <section className={`card ${styles.panel}`} aria-labelledby="introductions-title">
      <div className={styles.head}>
        <div className={styles.headCopy}>
          <IconTile name="handshake" tone="qiko" size="md" />
          <div>
            <p className="kicker kicker-qiko">Qiko · Network</p>
            <h2 id="introductions-title">Introductions and reach</h2>
            <p className={styles.sub}>
              {isSia ? "SIAs are Tessiant's warmest route to new work. " : ""}
              Doors {associate.name.split(" ")[0]} has opened, and the requests waiting on them.
            </p>
          </div>
        </div>
        <Button variant="qiko" icon="handshake" onClick={ask}>
          Ask for an introduction
        </Button>
      </div>

      <div className={styles.stats}>
        <div className={styles.stat}>
          <b className="tabular">
            <CountUp value={made.length} />
          </b>
          <span>introductions recorded</span>
        </div>
        <div className={styles.stat}>
          <b className="tabular">
            <CountUp value={won.length} />
          </b>
          <span>became won work</span>
        </div>
        <div className={styles.stat}>
          <b className="tabular">
            <CountUp value={wonValue} format={compactMoney} />
          </b>
          <span>agreed value introduced</span>
        </div>
        <div className={`${styles.stat} ${styles.statDemo}`}>
          <b className="tabular">
            ≈<CountUp value={reach} />
          </b>
          <span>
            profiles one intro away <span className="chip chip-demo">estimate</span>
          </span>
        </div>
      </div>

      <div className={styles.columns}>
        <div>
          <h3 className="kicker">Doors opened</h3>
          {made.length === 0 ? (
            <EmptyState icon="handshake" title="No introductions recorded">
              When a lead comes through {associate.name.split(" ")[0]}, set &ldquo;Introduced by&rdquo; on the lead and it shows here.
            </EmptyState>
          ) : (
            <ul className={styles.list}>
              {made.map((item) => (
                <li key={item.lead.id}>
                  <Link href={`/sales/leads/${item.lead.id}`} className={styles.rowLink}>
                    <b>{item.lead.name}</b>
                    <small>
                      {item.accountName ?? "Unknown company"} · {formatDate(item.lead.createdAt)}
                    </small>
                  </Link>
                  <span className={styles.outcome} data-won={item.opportunity?.stage === "Closed Won" || undefined}>
                    {item.outcome}
                    {item.opportunity ? ` · ${compactMoney(item.opportunity.amount)}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <h3 className="kicker">Requests waiting on {associate.name.split(" ")[0]}</h3>
          {requests.length === 0 ? (
            <p className={styles.quiet}>Nothing asked yet. Open a brief and use &ldquo;Request intro&rdquo;, or ask directly above.</p>
          ) : (
            <ul className={styles.list}>
              {requests.map(({ task, requirement }) => (
                <li key={task.id}>
                  <button type="button" className={styles.rowLink} onClick={() => openTask(task.id)}>
                    <b>{requirement ? requirement.title : task.title}</b>
                    <small>{task.status === "completed" ? "Done" : task.status === "dismissed" ? "Dropped" : "Open"} · {formatDate(task.createdAt)}</small>
                  </button>
                  <Icon name="chevronRight" size={14} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
