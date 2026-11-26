"use client";

import { useState } from "react";
import Link from "next/link";
import Button from "@/components/ui/Button";
import { SkeletonRows } from "@/components/ui/bits";
import { useWorkspace } from "@/components/shell/WorkspaceContext";
import { avatarStyle, initials } from "@/lib/format";
import { fullName } from "@/lib/signal-growth/engine";
import { growth, useGrowth } from "@/lib/signal-growth/store";
import styles from "./linkedin.module.css";

const STEP = { view: "View profile", connect: "Connection note", followup: "Follow-up" } as const;

export default function LinkedInPage() {
  const state = useGrowth();
  const { toast } = useWorkspace();
  const [reply, setReply] = useState("Thanks, send it over.");
  if (!state) return <div className="page"><SkeletonRows rows={6} /></div>;

  const account = state.linkedinAccounts[0];
  const layla = state.leads.find((lead) => lead.id === "ld_layla");
  const laylaName = layla ? fullName(layla) : "Layla";
  const used = account ? Math.min(100, Math.round((account.sentToday / Math.max(account.dailyLimit, 1)) * 100)) : 0;
  const queued = state.linkedinQueue.filter((item) => item.status === "queued").length;

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <p className="kicker">Signal</p>
          <h1>LinkedIn</h1>
          <p className="subtitle">Assisted mode. The queue is drafted here, and a person clicks send. The daily limit stays low on purpose.</p>
        </div>
        {account ? (
          <div className={styles.capacity}>
            <div>
              <b className="tabular">{account.sentToday} of {account.dailyLimit}</b>
              <small>{account.name} · sent today</small>
              <div className={styles.meter} data-hot={used >= 80 ? "true" : undefined}><span style={{ width: `${used}%` }} /></div>
            </div>
          </div>
        ) : null}
      </header>

      <div className={styles.studio}>
        <section className={styles.board} aria-label="Send queue">
          <h2>Queue</h2>
          <p className={styles.hint}>{queued} waiting · nothing sends until you click it</p>
          <ol className={styles.queue}>
            {state.linkedinQueue.map((item) => {
              const lead = state.leads.find((row) => row.id === item.leadId);
              const name = lead ? fullName(lead) : item.leadId;
              return (
                <li key={item.id} className={styles.item}>
                  <span className={styles.rail}><i className={styles.dot} data-sent={item.status === "sent" ? "true" : undefined} /></span>
                  <article className={styles.card}>
                    <div className={styles.cardHead}>
                      <Link href={lead ? `/growth/leads/${lead.id}` : "/growth/leads"} className={styles.person}>
                        <span className="avatar avatar-sm" style={avatarStyle(name)}>{initials(name)}</span>
                        <span>
                          <b>{name}</b>
                          <small>{lead?.company ?? "—"} · {STEP[item.step]}</small>
                        </span>
                      </Link>
                      <span className={`chip ${item.status === "sent" ? "chip-won" : "chip-pending"}`}>{item.status}</span>
                    </div>
                    <p className={styles.draft}>{item.text}</p>
                    {item.status === "queued" ? <Button size="small" onClick={() => toast(growth.sendLinkedIn(item.id))}>Send</Button> : null}
                  </article>
                </li>
              );
            })}
          </ol>
        </section>

        <aside className={styles.side}>
          <h2>Log a reply</h2>
          <p className={styles.hint}>This records what {laylaName.split(" ")[0]} said and stops any sequence she is in.</p>
          {layla ? (
            <Link href={`/growth/leads/${layla.id}`} className={styles.person}>
              <span className="avatar" style={avatarStyle(laylaName)}>{initials(laylaName)}</span>
              <span>
                <b>{laylaName}</b>
                <small>{layla.company} · {layla.title}</small>
              </span>
            </Link>
          ) : null}
          <form className={styles.reply} onSubmit={(event) => { event.preventDefault(); growth.reply("ld_layla", "linkedin", reply); toast("Reply logged. Layla leaves any active sequence."); }}>
            <label>
              What {laylaName.split(" ")[0]} said
              <input className="input" value={reply} onChange={(event) => setReply(event.target.value)} />
            </label>
            <Button type="submit" variant="secondary">{laylaName.split(" ")[0]} replied</Button>
          </form>
        </aside>
      </div>
    </div>
  );
}
