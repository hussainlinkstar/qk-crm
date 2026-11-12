"use client";

import Link from "next/link";
import Select from "@/components/ui/Select";
import { useEffect, useMemo, useRef, useState } from "react";
import { EmptyState, SkeletonRows, useNow, useWorkspaceData } from "@/components/ui/bits";
import { useWorkspace } from "@/components/shell/WorkspaceContext";
import AskPulseChat from "@/components/pulse/AskPulseChat";
import PulseKnowledgeMap from "@/components/pulse/PulseKnowledgeMap";
import PulseLiveChart from "@/components/pulse/PulseLiveChart";
import PulseShell from "@/components/pulse/PulseShell";
import PulseSubnav from "@/components/pulse/PulseSubnav";
import { crm } from "@/lib/crm-store";
import { getPulseSnapshot } from "@/lib/pulse-adapter";
import {
  activitySeries,
  associateGrowthSeries,
  roleDistributionSeries,
  signalsSeries,
} from "@/lib/pulse-overview-charts";
import {
  confidenceNote,
  evidenceKindLabel,
  evidenceLabel,
  expectedBenefit,
  knowledgeBlockTitle,
  rulePlainLanguage,
} from "@/lib/pulse-presentation";
import { TESSIANT_KNOWLEDGE_BLOCKS } from "@/lib/tessiant-knowledge";
import { generateTessiantInsights, networkMix } from "@/lib/tessiant-pulse-rules";
import { timeAgo } from "@/lib/format";
import styles from "./pulse.module.css";

const REJECT_REASONS = ["Not relevant", "Poor data", "Already handled", "Inappropriate suggestion"] as const;

export default function PulseCockpitPage() {
  const { state } = useWorkspaceData();
  const { toast, openTask } = useWorkspace();
  const now = useNow();
  const [activityDays, setActivityDays] = useState(14);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState<string>(REJECT_REASONS[0]);
  const [showReject, setShowReject] = useState(false);
  const tickerWrapRef = useRef<HTMLDivElement>(null);
  const tickerListRef = useRef<HTMLUListElement>(null);

  const insights = useMemo(() => (state ? generateTessiantInsights(state, now || Date.now()) : []), [state, now]);
  const pendingAll = useMemo(() => insights.filter((item) => item.reviewStatus === "pending"), [insights]);
  const mix = useMemo(() => (state ? networkMix(state) : null), [state]);
  const snapshot = useMemo(() => (state ? getPulseSnapshot(state) : null), [state]);
  const growth = useMemo(() => (state ? associateGrowthSeries(state) : []), [state]);
  const roles = useMemo(() => (state ? roleDistributionSeries(state) : []), [state]);
  const activity = useMemo(
    () => (state ? activitySeries(state, activityDays, now ? new Date(now) : new Date()) : []),
    [state, activityDays, now],
  );
  const signals = useMemo(
    () => signalsSeries(insights, 14, now ? new Date(now) : new Date()),
    [insights, now],
  );

  useEffect(() => {
    const wrap = tickerWrapRef.current;
    const list = tickerListRef.current;
    if (!wrap || !list) return;
    let paused = false;
    const onEnter = () => {
      paused = true;
    };
    const onLeave = () => {
      paused = false;
    };
    wrap.addEventListener("mouseenter", onEnter);
    wrap.addEventListener("mouseleave", onLeave);
    wrap.addEventListener("focusin", onEnter);
    wrap.addEventListener("focusout", onLeave);
    const id = window.setInterval(() => {
      if (paused || list.children.length < 2) return;
      const first = list.children[0] as HTMLElement | undefined;
      if (!first) return;
      const h = first.getBoundingClientRect().height || 72;
      list.style.transition = "transform .55s ease";
      list.style.transform = `translateY(-${h}px)`;
      const done = () => {
        list.style.transition = "none";
        list.appendChild(first);
        list.style.transform = "translateY(0)";
        list.removeEventListener("transitionend", done);
      };
      list.addEventListener("transitionend", done);
    }, 3200);
    return () => {
      window.clearInterval(id);
      wrap.removeEventListener("mouseenter", onEnter);
      wrap.removeEventListener("mouseleave", onLeave);
      wrap.removeEventListener("focusin", onEnter);
      wrap.removeEventListener("focusout", onLeave);
    };
  }, [insights.length]);

  const selected =
    insights.find((item) => item.id === selectedId) ??
    pendingAll[0] ??
    insights[0] ??
    null;

  const bestMove = pendingAll[0] ?? insights[0] ?? null;
  const highIntent = pendingAll.filter((item) => item.priority === "high").length;
  const activityTotal = activity.reduce((sum, row) => sum + row.v, 0);
  const signalsTotal = signals.reduce((sum, row) => sum + row.v, 0);

  if (!state || !state.tessiant || !mix || !snapshot) {
    return (
      <PulseShell>
        <div className={styles.pulsePageExact}>
          <SkeletonRows rows={6} height={90} />
        </div>
      </PulseShell>
    );
  }

  const accept = (insightId: string) => {
    const insight = insights.find((item) => item.id === insightId);
    if (!insight) return;
    const taskId = crm.acceptPulseInsight(insight);
    toast("Insight accepted — to-do added to My Tasks");
    setShowReject(false);
    if (taskId) openTask(taskId);
  };

  const reject = (insightId: string, reason = rejectReason) => {
    const insight = insights.find((item) => item.id === insightId);
    if (!insight || insight.reviewStatus !== "pending") return;
    crm.rejectPulseInsight(insight.id, reason);
    toast("Rejection recorded");
    setShowReject(false);
  };

  const selectedOutcome = selected
    ? state.tessiant.pulse?.outcomes.find((item) => item.insightId === selected.id)
    : null;

  return (
    <PulseShell>
      <div className={styles.pulsePageExact} data-view="pulse">
        <header className={styles.pulseHeadExact}>
          <div className={styles.pulseHeadCopyExact}>
            <h1>Pulse</h1>
            <p>
              Insight, evidence, and the recommended action. Accept a step into the backlog, then measure it in Value.
            </p>
          </div>
          <div className={styles.pulseHeadToolsExact}>
            <p className={styles.pulseMetaExact}>
              {insights.length} stored signals · {state.tessiant.domainEvents.length} activities
            </p>
            <AskPulseChat state={state} realised={snapshot.financials.realised} />
          </div>
        </header>

        <PulseSubnav />

        <div className={styles.topGridExact}>
          <section className={styles.cardExact} style={{ padding: "1.5rem" }}>
            <p className={styles.monoKickerExact}>Outcomes this period</p>
            <p className={styles.outcomesTitleExact}>Decisions waiting on you</p>
            <p className={styles.outcomesSubExact}>
              Flags, open steps, and the size of the book. Accepted work is measured in Value after it is done.
            </p>
            <div className={styles.pulseKpisExact} aria-label="Pulse outcome KPIs">
              <div className={styles.pulseKpiExact}>
                <p className={styles.pulseKpiValue}>{highIntent}</p>
                <p className={styles.pulseKpiLabel}>High-intent flags</p>
              </div>
              <div className={styles.pulseKpiExact}>
                <p className={styles.pulseKpiValue}>{pendingAll.length}</p>
                <p className={styles.pulseKpiLabel}>Next steps open</p>
              </div>
              <Link href="/pulse/knowledge" className={styles.pulseKpiExactBtn}>
                <p className={styles.pulseKpiValue}>{TESSIANT_KNOWLEDGE_BLOCKS.length}</p>
                <p className={styles.pulseKpiLabel}>Knowledge blocks</p>
              </Link>
              <Link href="/staffing/associates" className={styles.pulseKpiExactBtn}>
                <p className={`${styles.pulseKpiValue} ${styles.pulseKpiLinkValue}`}>{mix.sampleSize}</p>
                <p className={styles.pulseKpiLabel}>Associates ({mix.networkTotal} network)</p>
              </Link>
            </div>
          </section>

          <section className={`${styles.cardExact} ${styles.bestMoveExact}`}>
            {bestMove ? (
              <>
                <p className={styles.monoKickerExact}>Today&apos;s best next move</p>
                <div className={styles.bestMoveBodyExact}>
                  <h2>{bestMove.recommendedAction.label}</h2>
                  <p>{bestMove.summary}</p>
                  <p className={styles.bestMoveWho}>
                    {knowledgeBlockTitle(bestMove.knowledgeBlockId)} · {bestMove.generatedAt.slice(0, 10)}
                  </p>
                  <div className={styles.bestMoveActions}>
                    <button type="button" className={styles.btnPulsePrimary} onClick={() => accept(bestMove.id)}>
                      Accept
                    </button>
                    <button type="button" className={styles.btnPulseSecondary} onClick={() => reject(bestMove.id)}>
                      Reject
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <>
                <p className={styles.monoKickerExact}>Today&apos;s best next move</p>
                <EmptyState title="No open decision" icon="checkCircle">
                  All current Tessiant signals are reviewed.
                </EmptyState>
              </>
            )}
          </section>
        </div>

        <div className={styles.chartsGridExact} aria-label="Pulse CRM charts">
          <article className={`${styles.cardExact} ${styles.pulseChartCardExact}`}>
            <div className={styles.pulseChartHeadExact}>
              <div>
                <h2 className={styles.pulseChartTitleExact}>Associate growth</h2>
                <p className={styles.pulseChartSubExact}>How the verified associate sample has moved month by month.</p>
              </div>
              <div className={styles.pulseChartSideExact}>
                <Link href="/staffing/associates" className={styles.pulseChartTotalExact} style={{ textDecoration: "none" }}>
                  <strong style={{ textDecoration: "underline", textUnderlineOffset: 3 }}>{mix.sampleSize}</strong>
                  <span>Total associates</span>
                </Link>
              </div>
            </div>
            <div className={styles.pulseChartBodyExact}>
              <PulseLiveChart kind="line" series={growth} color="#4f46e5" />
            </div>
          </article>

          <article className={`${styles.cardExact} ${styles.pulseChartCardExact}`}>
            <div className={styles.pulseChartHeadExact}>
              <div>
                <h2 className={styles.pulseChartTitleExact}>How roles are distributed</h2>
                <p className={styles.pulseChartSubExact}>Associates grouped by role type in the workspace sample.</p>
              </div>
              <div className={styles.pulseChartSideExact}>
                <Link href="/staffing/associates" className={styles.pulseChartTotalExact} style={{ textDecoration: "none" }}>
                  <strong style={{ textDecoration: "underline", textUnderlineOffset: 3 }}>{mix.sampleSize}</strong>
                  <span>Role types</span>
                </Link>
              </div>
            </div>
            <div className={styles.pulseChartBodyExact}>
              <PulseLiveChart kind="bar" series={roles} color="#0ea5e9" />
            </div>
          </article>

          <article className={`${styles.cardExact} ${styles.pulseChartCardExact}`}>
            <div className={styles.pulseChartHeadExact}>
              <div>
                <h2 className={styles.pulseChartTitleExact}>Platform activity</h2>
                <p className={styles.pulseChartSubExact}>Events recorded on the platform in the selected window.</p>
              </div>
              <div className={styles.pulseChartSideExact}>
                <div className={styles.filterPillsExact}>
                  {[7, 14, 30].map((n) => (
                    <button
                      key={n}
                      type="button"
                      className={activityDays === n ? styles.filterPillOn : styles.filterPillOff}
                      onClick={() => setActivityDays(n)}
                    >
                      {n}d
                    </button>
                  ))}
                </div>
                <div className={styles.pulseChartTotalExact}>
                  <strong>{activityTotal}</strong>
                  <span>Events · {activityDays} days</span>
                </div>
              </div>
            </div>
            <div className={styles.pulseChartBodyExact}>
              <PulseLiveChart kind="line" series={activity} color="#0891b2" />
            </div>
          </article>

          <article className={`${styles.cardExact} ${styles.pulseChartCardExact}`}>
            <div className={styles.pulseChartHeadExact}>
              <div>
                <h2 className={styles.pulseChartTitleExact}>Signals generated</h2>
                <p className={styles.pulseChartSubExact}>Insights the workers saved. Each point is one day.</p>
              </div>
              <div className={styles.pulseChartSideExact}>
                <div className={styles.pulseChartTotalExact}>
                  <strong>{signalsTotal || insights.length}</strong>
                  <span>Persisted · 14 days</span>
                </div>
              </div>
            </div>
            <div className={styles.pulseChartBodyExact}>
              <PulseLiveChart kind="line" series={signals} color="#7c3aed" />
            </div>
          </article>
        </div>

        <div className={styles.mapGridExact}>
          <section className={`${styles.cardExact} ${styles.mapCardExact}`}>
            <div className={styles.mapCardHeadExact}>
              <div>
                <h2>Knowledge map</h2>
                <p>Associate Network Intelligence and Augmentation &amp; Placement · click a block to open</p>
              </div>
              <Link href="/pulse/knowledge" className={styles.mapLinkExact}>
                Company intelligence
              </Link>
            </div>
            <PulseKnowledgeMap
              networkSub={`${highIntent} high-intent`}
              placementSub={`${pendingAll.filter((item) => item.knowledgeBlockId === "augmentation").length} with insights`}
            />
          </section>

          <section className={`${styles.cardExact} ${styles.feedCardExact}`}>
            <div className={styles.feedHeadExact}>
              <div>
                <h2>Recently captured</h2>
                <p>Live activity ticker · pauses on hover</p>
              </div>
            </div>
            <div className={styles.recentWrapExact} ref={tickerWrapRef}>
              <ul className={styles.recentListExact} ref={tickerListRef}>
                {insights.slice(0, 6).map((item) => {
                  const primary = item.evidence[0];
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedId(item.id);
                          document.getElementById("insights")?.scrollIntoView({ behavior: "smooth", block: "start" });
                        }}
                      >
                        <span
                          style={{
                            display: "grid",
                            width: "2.25rem",
                            height: "2.25rem",
                            placeItems: "center",
                            borderRadius: 9999,
                            background: "#fffbeb",
                            fontSize: 11,
                            fontWeight: 700,
                            color: "#b45309",
                            flexShrink: 0,
                          }}
                        >
                          SIG
                        </span>
                        <span className={styles.feedCopyExact}>
                          <span className={styles.feedSubjectExact}>{item.title}</span>
                          <span className={styles.feedWhoExact}>{item.summary}</span>
                          <span className={styles.feedWhoExact}>
                            {item.priority} · {item.ruleId}
                          </span>
                          {primary ? (
                            <span
                              style={{
                                display: "block",
                                marginTop: 2,
                                fontFamily: "var(--font-mono)",
                                fontSize: 11,
                                color: "#64748b",
                              }}
                            >
                              {primary.entityId}
                            </span>
                          ) : null}
                        </span>
                        <span style={{ fontSize: 11, fontWeight: 500, color: "#94a3b8", flexShrink: 0 }}>
                          {item.generatedAt.slice(0, 10)}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          </section>
        </div>

        <section className={`${styles.cardExact} ${styles.findingsBoxExact}`} id="insights">
          <div className={styles.findingsTopExact}>
            <h2>Insights</h2>
            <p>One view. Pick an insight, read the figures, then accept or reject the action.</p>
          </div>
          {selected ? (
            <div className={styles.findingsSplitExact}>
              <div className={styles.findingsListExact}>
                <div className={styles.findingsListHeadExact}>
                  <p className={styles.monoKickerExact}>Insight</p>
                  <p>{insights.length} patterns · select one</p>
                </div>
                <ul>
                  {insights.map((item) => {
                    const on = item.id === selected.id;
                    return (
                      <li key={item.id}>
                        <button
                          type="button"
                          className={on ? styles.findingsItemOn : undefined}
                          onClick={() => {
                            setSelectedId(item.id);
                            setShowReject(false);
                          }}
                        >
                          <span className={styles.findingsSignalExact} data-status={item.reviewStatus}>
                            {item.reviewStatus === "pending" ? "Stored signal" : item.reviewStatus}
                          </span>
                          <span className={styles.findingsTitleExact}>{item.title}</span>
                          <span className={styles.findingsSummaryExact}>{item.summary}</span>
                          <span className={styles.findingsMetaExact}>
                            <span>{knowledgeBlockTitle(item.knowledgeBlockId)}</span>
                            <span>·</span>
                            <span>{item.generatedAt.slice(0, 10)}</span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>

              <div className={styles.findingsDetailExact}>
                <div className={styles.findingsPaneExact}>
                  <div className={styles.findingsPaneHeadExact}>
                    <p className={styles.monoKickerExact}>Evidence</p>
                  </div>
                  <div className={styles.findingsPaneBodyExact}>
                    <p>{selected.summary}</p>
                    <div className={styles.evidenceMetricsExact}>
                      <div>
                        <b>1</b>
                        <span>Stored signal</span>
                      </div>
                      <div>
                        <b>{selected.priority}</b>
                        <span>Strength</span>
                      </div>
                      <div>
                        <b>{selected.generatedAt.slice(0, 10)}</b>
                        <span>Generated</span>
                      </div>
                      <div>
                        <b>{selected.evidence[0]?.entityId ?? "tessiant"}</b>
                        <span>Record</span>
                      </div>
                    </div>
                    <ul className={styles.evidenceListExact}>
                      {selected.evidence.slice(0, 4).map((item, index) => (
                        <li key={`${item.entityType}-${item.entityId}-${index}`}>
                          <span>{evidenceKindLabel(item)}</span>
                          {item.href ? (
                            <Link href={item.href} className="text-link">
                              {evidenceLabel(state, item)}
                            </Link>
                          ) : (
                            <b>{evidenceLabel(state, item)}</b>
                          )}
                        </li>
                      ))}
                    </ul>
                    <p className={styles.evidenceNoteExact}>
                      {confidenceNote(selected)} · {timeAgo(selected.generatedAt, now || undefined)}
                    </p>
                  </div>
                </div>

                <div className={styles.findingsPaneExact}>
                  <div className={styles.findingsPaneHeadExact}>
                    <p className={styles.monoKickerExact}>Action recommended</p>
                  </div>
                  <div className={styles.findingsPaneBodyExact}>
                    {selected.reviewStatus === "rejected" ? (
                      <p>Rejected. It will not go on the backlog.</p>
                    ) : selectedOutcome?.status === "completed" ? (
                      <>
                        <p>{selectedOutcome.summary}</p>
                        <p style={{ margin: ".55rem 0 0", fontSize: 20, fontWeight: 750, letterSpacing: "-.03em", color: "#047857" }}>
                          Measured
                        </p>
                        <p className={styles.actionMetricExact}>
                          Measured from {selectedOutcome.updatedAt.slice(0, 10)} · {rulePlainLanguage(selected.ruleId)}
                        </p>
                        <Link href="/pulse/value" className={styles.btnPulsePrimary} style={{ marginTop: "1rem", width: "fit-content" }}>
                          Open Value
                        </Link>
                      </>
                    ) : selected.reviewStatus === "accepted" ? (
                      <>
                        <p>Accepted once. It is on the backlog.</p>
                        <div className={styles.actionRowExact}>
                          {selected.taskId ? (
                            <button type="button" className={styles.btnPulsePrimary} onClick={() => openTask(selected.taskId!)}>
                              Open Task
                            </button>
                          ) : null}
                          <Link href="/pulse/actions" className={styles.btnPulseSecondary}>
                            Open To-do
                          </Link>
                        </div>
                      </>
                    ) : (
                      <>
                        <p className={styles.actionTitleExact}>{selected.recommendedAction.label}</p>
                        <p>{rulePlainLanguage(selected.ruleId)}</p>
                        <p className={styles.actionMetricExact}>
                          If this works, Value will track {expectedBenefit(selected)} from the completion date. Baseline Stored signal. Expected Measured follow-up.
                        </p>
                        <div className={styles.actionRowExact}>
                          <button type="button" className={styles.btnPulsePrimary} style={{ flex: 1 }} onClick={() => accept(selected.id)}>
                            Accept
                          </button>
                          <button
                            type="button"
                            className={styles.btnPulseSecondary}
                            style={{ flex: 1 }}
                            onClick={() => setShowReject((v) => !v)}
                          >
                            Reject
                          </button>
                        </div>
                        {showReject ? (
                          <div className={styles.rejectRowExact}>
                            <Select
                              className="input"
                              value={rejectReason}
                              onChange={(e) => setRejectReason(e.target.value)}
                              aria-label="Reject reason"
                            >
                              {REJECT_REASONS.map((item) => (
                                <option key={item} value={item}>
                                  {item}
                                </option>
                              ))}
                            </Select>
                            <button type="button" className={styles.btnPulseSecondary} onClick={() => reject(selected.id)}>
                              Confirm reject
                            </button>
                          </div>
                        ) : null}
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ padding: "1.5rem" }}>
              <EmptyState title="No insights yet" icon="sparkles" />
            </div>
          )}
        </section>
      </div>
    </PulseShell>
  );
}
