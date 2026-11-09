"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import Button from "@/components/ui/Button";
import { EmptyState, SkeletonRows, useNow, useWorkspaceData } from "@/components/ui/bits";
import InsightCard from "@/components/pulse/InsightCard";
import { getPulseSnapshot, resolveDomainEventEvidence } from "@/lib/pulse-adapter";
import { TESSIANT_KNOWLEDGE_BLOCKS } from "@/lib/tessiant-knowledge";
import { demoChatAnswers, generateTessiantInsights, networkMix, placementFunnel } from "@/lib/tessiant-pulse-rules";
import { timeAgo } from "@/lib/format";
import styles from "./pulse.module.css";

export default function PulseCockpitPage() {
  const { state } = useWorkspaceData();
  const now = useNow();
  const [chatAnswer, setChatAnswer] = useState<string | null>(null);

  const insights = useMemo(() => (state ? generateTessiantInsights(state, now || Date.now()) : []), [state, now]);
  const pending = insights.filter((item) => item.reviewStatus === "pending").slice(0, 5);
  const mix = useMemo(() => (state ? networkMix(state) : null), [state]);
  const funnel = useMemo(() => (state ? placementFunnel(state) : null), [state]);
  const snapshot = useMemo(() => (state ? getPulseSnapshot(state) : null), [state]);
  const openTasks = state?.tasks.filter((task) => task.description.includes("[pulse-insight:") && (task.status === "pending" || task.status === "in_progress")).length ?? 0;

  if (!state || !state.tessiant || !mix || !funnel || !snapshot) {
    return (
      <div className="page">
        <SkeletonRows rows={5} height={90} />
      </div>
    );
  }

  const maxSector = Math.max(1, ...Object.values(mix.bySector));
  const maxStage = Math.max(1, ...funnel.stages.map((s) => s.count));

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <div className={styles.context}>
            <span className="chip chip-ai">Qiko Pulse</span>
            <span className="chip">Tessiant</span>
          </div>
          <h1>Intelligence cockpit</h1>
          <p className="subtitle">
            Insights and recommended actions across Tessiant sales and staffing — the same accounts and requirements you already work in.
          </p>
        </div>
        <div className="page-actions">
          <Link href="/pulse/knowledge">
            <Button variant="secondary" icon="file">
              Knowledge
            </Button>
          </Link>
          <Link href="/pulse/insights">
            <Button icon="sparkles">All insights</Button>
          </Link>
        </div>
      </header>

      <section className={styles.kpis} aria-label="Tessiant operational KPIs">
        <div className={styles.kpi}>
          <span>Network</span>
          <b className="tabular">{mix.networkTotal}</b>
          <small>
            Illustrative network · workspace sample {mix.sampleSize} · verified available {mix.verifiedAvailable}
          </small>
        </div>
        <div className={styles.kpi}>
          <span>Open requirements</span>
          <b className="tabular">{snapshot.requirements.open}</b>
          <small>{pending.length} insights waiting · {openTasks} Pulse tasks open</small>
        </div>
        <div className={styles.kpi}>
          <span>Confirmed placements</span>
          <b className="tabular">{snapshot.requirements.placed}</b>
          <small>Realised day-rate £{snapshot.financials.realised.toLocaleString("en-GB")}</small>
        </div>
        <div className={styles.kpi}>
          <span>Pipeline potential</span>
          <b className="tabular">£{snapshot.financials.pipeline.toLocaleString("en-GB")}</b>
          <small>Not realised · quoted/in-progress only</small>
        </div>
        <div className={styles.kpi}>
          <span>Pending recommendations</span>
          <b className="tabular">{insights.filter((i) => i.reviewStatus === "pending").length}</b>
          <small>Deterministic rules · data as of {timeAgo(snapshot.generatedAt)}</small>
        </div>
      </section>

      <section className={styles.split}>
        <article className="card">
          <div className="card-head">
            <div>
              <h2>Decisions waiting on you</h2>
              <p className="card-sub">High-priority Tessiant signals with evidence and Accept / Reject.</p>
            </div>
          </div>
          <div className="card-body">
            {pending.length === 0 ? (
              <EmptyState title="No pending insights" icon="checkCircle">
                Accept/reject state may be cleared via Settings → reset demo data.
              </EmptyState>
            ) : (
              pending.map((insight) => <InsightCard key={insight.id} insight={insight} />)
            )}
          </div>
        </article>

        <div>
          <article className="card">
            <div className="card-head">
              <h2>Knowledge blocks</h2>
            </div>
            <div className="card-body">
              <ul className="muted" style={{ margin: 0, paddingLeft: 16 }}>
                {TESSIANT_KNOWLEDGE_BLOCKS.map((block) => (
                  <li key={block.id} style={{ marginBottom: 8 }}>
                    <Link href={`/pulse/knowledge/${block.id}`}>
                      <b>{block.title}</b>
                    </Link>
                    <div>
                      {block.priority} · {block.purpose}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </article>

          <article className="card" style={{ marginTop: 14 }}>
            <div className="card-head">
              <h2>Ask Pulse (grounded DEMO)</h2>
              <p className="card-sub">Predefined questions only — safe fallbacks, no free-form invention.</p>
            </div>
            <div className="card-body">
              <div className={styles.chatList}>
                {demoChatAnswers().map((item) => (
                  <button key={item.question} type="button" className={styles.chatBtn} onClick={() => setChatAnswer(item.answer)}>
                    {item.question}
                  </button>
                ))}
              </div>
              {chatAnswer && <p className={styles.note} style={{ marginTop: 12 }}>{chatAnswer}</p>}
            </div>
          </article>
        </div>
      </section>

      <section className={styles.three}>
        <article className="card">
          <div className="card-head">
            <div>
              <h2>Network mix (sample)</h2>
              <p className="card-sub">
                Bars use the seeded sample ({mix.sampleSize}) — not the illustrative network total ({mix.networkTotal}).
              </p>
            </div>
          </div>
          <div className="card-body">
            {Object.entries(mix.byRole).map(([role, count]) => (
              <div key={role} className={styles.barRow}>
                <span>{role}</span>
                <div className={styles.barTrack}>
                  <div className={styles.barFill} style={{ width: `${(count / mix.sampleSize) * 100}%` }} />
                </div>
                <span className="tabular">{count}</span>
              </div>
            ))}
            <h3 style={{ fontSize: 13, margin: "12px 0 8px" }}>By sector</h3>
            {Object.entries(mix.bySector)
              .sort((a, b) => b[1] - a[1])
              .slice(0, 6)
              .map(([sector, count]) => (
                <div key={sector} className={styles.barRow}>
                  <span>{sector}</span>
                  <div className={styles.barTrack}>
                    <div className={styles.barFill} style={{ width: `${(count / maxSector) * 100}%` }} />
                  </div>
                  <span className="tabular">{count}</span>
                </div>
              ))}
          </div>
        </article>

        <article className="card">
          <div className="card-head">
            <div>
              <h2>Stage funnel</h2>
              <p className="card-sub">Denominator: {funnel.denominator} non-archived requirements · lost/hold {funnel.lostOrHeld}.</p>
            </div>
          </div>
          <div className="card-body">
            {funnel.stages.map((row) => (
              <div key={row.stage} className={styles.barRow}>
                <span>{row.stage}</span>
                <div className={styles.barTrack}>
                  <div className={styles.barFill} style={{ width: `${(row.count / maxStage) * 100}%` }} />
                </div>
                <span className="tabular">{row.count}</span>
              </div>
            ))}
          </div>
        </article>

        <article className="card">
          <div className="card-head">
            <div>
              <h2>Recent CRM events</h2>
              <p className="card-sub">Structured handoff from Tessiant CRM — stable IDs and evidence refs for Pulse.</p>
            </div>
            <Link href="/pulse/connections" className="text-link">
              Connections
            </Link>
          </div>
          <div className="card-body">
            <ul style={{ margin: 0, paddingLeft: 16 }}>
              {snapshot.recentEvents.slice(0, 10).map((event) => {
                const evidence = resolveDomainEventEvidence(state, event);
                const href = typeof event.payload.href === "string" ? event.payload.href : evidence[0]?.href;
                const summary = typeof event.payload.summary === "string" ? event.payload.summary : null;
                return (
                  <li key={event.eventId} style={{ marginBottom: 10 }}>
                    <b>{event.eventType}</b>
                    <div className="muted">
                      {timeAgo(event.timestamp)} · {event.entityType}/{event.entityId}
                      {summary ? ` · ${summary}` : ""}
                    </div>
                    <div className="muted" style={{ fontSize: 12 }}>
                      Evidence: {evidence.map((item) => `${item.entityType}:${item.entityId}`).join(" · ") || "—"}
                      {href ? (
                        <>
                          {" · "}
                          <Link href={href}>Open source</Link>
                        </>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
            <div className={styles.actions} style={{ marginTop: 12 }}>
              <Link href="/pulse/value">
                <Button size="small" variant="secondary">
                  Value dashboard
                </Button>
              </Link>
              <Link href="/pulse/actions">
                <Button size="small" variant="secondary">
                  To-dos
                </Button>
              </Link>
            </div>
          </div>
        </article>
      </section>
    </div>
  );
}
