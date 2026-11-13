"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { EmptyState, SkeletonRows, useNow, useWorkspaceData } from "@/components/ui/bits";
import { useWorkspace } from "@/components/shell/WorkspaceContext";
import AskPulseChat from "@/components/pulse/AskPulseChat";
import Icon from "@/components/ui/Icon";
import KnowledgeFlow from "@/components/pulse/KnowledgeFlow";
import NetworkIntelligenceDashboard from "@/components/pulse/NetworkIntelligenceDashboard";
import PulseShell from "@/components/pulse/PulseShell";
import { crm } from "@/lib/crm-store";
import { getPulseSnapshot } from "@/lib/pulse-adapter";
import {
  confidenceNote,
  evidenceKindLabel,
  evidenceLabel,
  expectedBenefit,
  knowledgeBlockTitle,
  rulePlainLanguage,
} from "@/lib/pulse-presentation";
import { networkIntelligenceView } from "@/lib/network-intelligence";
import { timeAgo } from "@/lib/format";
import {
  getKnowledgeBlock,
  getKnowledgeBlockLiveMetrics,
  summarizeBlockInsights,
} from "@/lib/tessiant-knowledge";
import { generateTessiantInsights, networkMix, placementFunnel } from "@/lib/tessiant-pulse-rules";
import styles from "../../pulse.module.css";

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "analytics", label: "Analytics" },
  { key: "split" as const },
  { key: "learnings", label: "Locked learnings" },
  { key: "connections", label: "Connections" },
  { key: "how", label: "How it works" },
  { key: "settings", label: "Settings" },
] as const;

type TabKey = "overview" | "analytics" | "learnings" | "connections" | "how" | "settings";

const BLOCK_MARK: Record<string, { initials: string; role: string }> = {
  network: { initials: "NI", role: "Resource Intelligence · Network capacity" },
  augmentation: { initials: "AP", role: "Delivery Intelligence · Placement funnel" },
  commercial: { initials: "CR", role: "Account Intelligence · Relationship risk" },
  capability: { initials: "SC", role: "Leadership Intelligence · Sector readiness" },
};

const CHANNELS = [
  { id: "Email", note: "Nothing is sent without a person." },
  { id: "Slack", note: "Proposed channel for operator alerts." },
  { id: "Teams", note: "Proposed channel for delivery updates." },
  { id: "Calendar", note: "Meeting slots for availability checks." },
] as const;

export default function PulseKnowledgeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { state } = useWorkspaceData();
  const { openTask, toast } = useWorkspace();
  const now = useNow();
  const [tab, setTab] = useState<TabKey>("overview");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showReject, setShowReject] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [journeyPeriod, setJourneyPeriod] = useState<"30d" | "90d">("30d");
  const block = getKnowledgeBlock(id);

  const insights = useMemo(() => {
    if (!state || !block) return [];
    return generateTessiantInsights(state, now).filter((item) => item.knowledgeBlockId === block.id);
  }, [state, now, block]);

  const mix = useMemo(() => (state ? networkMix(state) : null), [state]);
  const funnel = useMemo(() => (state ? placementFunnel(state) : null), [state]);
  const snapshot = useMemo(() => (state ? getPulseSnapshot(state) : null), [state]);
  const networkView = useMemo(
    () => (state && block?.id === "network" ? networkIntelligenceView(state) : null),
    [state, block],
  );

  const selected = useMemo(() => {
    if (!insights.length) return null;
    return insights.find((item) => item.id === selectedId) ?? insights[0];
  }, [insights, selectedId]);

  const selectedOutcome = useMemo(() => {
    if (!selected || !state?.tessiant?.pulse?.outcomes) return null;
    return state.tessiant.pulse.outcomes.find((item) => item.insightId === selected.id) ?? null;
  }, [selected, state]);

  if (!state) {
    return (
      <PulseShell>
        <div className={styles.kbPage}>
          <SkeletonRows rows={4} height={80} />
        </div>
      </PulseShell>
    );
  }

  if (!block) {
    return (
      <PulseShell>
        <div className={styles.kbPage}>
          <EmptyState title="Unknown knowledge block">
            <Link href="/pulse/knowledge">Back to all knowledge blocks</Link>
          </EmptyState>
        </div>
      </PulseShell>
    );
  }

  const counts = summarizeBlockInsights(insights);
  const metrics = getKnowledgeBlockLiveMetrics(block.id, { mix, funnel, snapshot, state });
  const mark = BLOCK_MARK[block.id] ?? { initials: block.title.slice(0, 2).toUpperCase(), role: block.owner };
  const isNetwork = block.id === "network";
  const maxStage = Math.max(1, ...(funnel?.stages.map((row) => row.count) ?? [1]));
  const maxSector = Math.max(1, ...Object.values(mix?.bySector ?? { _: 1 }));
  const showNetworkTrends = block.id === "network" || block.id === "capability";
  const showFunnelTrends = block.id === "augmentation" || block.id === "capability";
  const showCommercialTrends = block.id === "commercial";
  const accepted = insights.filter((item) => item.reviewStatus === "accepted");
  const rejected = insights.filter((item) => item.reviewStatus === "rejected");

  type JourneyStep = { label: string; value: string; hint: string; href: string; focus?: boolean };
  const journey: JourneyStep[] =
    isNetwork && networkView
      ? [
          { label: "Network sample", value: String(networkView.sampleSize), hint: "Seeded profiles", href: "/staffing/associates" },
          { label: "Verified available", value: String(networkView.verifiedAvailable), hint: "Ready to staff", href: "/staffing/associates" },
          {
            label: "Open demand",
            value: String(networkView.openDemandHeadcount),
            hint: `${networkView.openRequirementCount} requirements`,
            href: "/staffing/requirements?view=open",
            focus: networkView.openDemandHeadcount > networkView.verifiedAvailable,
          },
          {
            label: "Thin coverage",
            value: String(networkView.thinCoverageCount),
            hint: "Needs a human next step",
            href: "/pulse/insights",
            focus: networkView.thinCoverageCount > 0,
          },
        ]
      : funnel
        ? funnel.stages.slice(0, 4).map((row) => ({
            label: row.stage,
            value: String(row.count),
            hint: `${Math.round((row.count / maxStage) * 100)}% of peak stage`,
            href: "/staffing/requirements",
            focus: row.stage === "Interview" || row.stage === "Sourcing",
          }))
        : metrics.slice(0, 4).map((metric) => ({
            label: metric.label,
            value: metric.value,
            hint: metric.hint ?? "From Tessiant CRM",
            href: "/pulse/insights",
          }));

  const accept = (insightId: string) => {
    const insight = insights.find((item) => item.id === insightId);
    if (!insight) return;
    if (insight.reviewStatus === "accepted" || insight.taskId) {
      if (insight.taskId) openTask(insight.taskId);
      toast(insight.taskId ? "Already accepted — linked to-do is ready" : "Already accepted");
      return;
    }
    const taskId = crm.acceptPulseInsight(insight);
    toast("Insight accepted — to-do added to My Tasks");
    if (taskId) openTask(taskId);
  };

  const reject = (insightId: string) => {
    const insight = insights.find((item) => item.id === insightId);
    if (!insight || insight.reviewStatus !== "pending") return;
    crm.rejectPulseInsight(insight.id, rejectReason || "Not useful now");
    toast("Rejection recorded for future evaluation");
    setShowReject(false);
    setRejectReason("");
  };

  const connectionSources = [
    {
      name: "Tessiant CRM",
      note: `Live demo fixture · associates, requirements and assignments · refreshed ${timeAgo(snapshot?.generatedAt ?? block.updatedAt)}`,
      status: "Connected",
      tone: "#059669",
    },
    ...block.dataSources.map((source) => ({
      name: source,
      note: "Read by this worker when the field is present on the Tessiant record.",
      status: "Connected",
      tone: "#059669",
    })),
    {
      name: "Salesforce",
      note: "Available later — entity mappings prepared. Nothing is sent without a person.",
      status: "Proposed",
      tone: "#b45309",
    },
    {
      name: "LinkedIn",
      note: "No scraping. Outside this demo.",
      status: "Out of scope",
      tone: "#64748b",
    },
  ];

  return (
    <PulseShell>
      <div className={styles.kbPage}>
        <header className={styles.kbHeader}>
          <div className={styles.kbBack}>
            <Link href="/pulse/knowledge" className={styles.kbBackLink}>
              <Icon name="arrowLeft" size={16} />
              All knowledge blocks
            </Link>
          </div>
          <div className={styles.kbHero}>
            <span className={styles.kbMark}>{mark.initials}</span>
            <div className={styles.kbHeroCopy}>
              <h1>{block.title}</h1>
              <p>
                {block.title} knowledge block · {mark.role}
              </p>
            </div>
            <AskPulseChat state={state} realised={snapshot?.financials.realised ?? 0} />
          </div>
          <nav className={styles.kbTabs} aria-label="Knowledge block tabs">
            {TABS.map((item) =>
              item.key === "split" ? (
                <span key="split" className={styles.kbSplit} aria-hidden />
              ) : (
                <button
                  key={item.key}
                  type="button"
                  className={styles.kbTab}
                  data-active={tab === item.key}
                  onClick={() => setTab(item.key as TabKey)}
                >
                  {"label" in item ? item.label : null}
                </button>
              ),
            )}
          </nav>
        </header>

        <div className={styles.kbPanels}>
          {tab === "overview" ? (
            <div className={styles.kbFrame}>
              <div className={styles.kbPanelHead}>
                <div>
                  <h2 className={styles.kbPanelTitle}>Overview</h2>
                  <p className={styles.kbPanelSub}>
                    {block.title} · {block.purpose} One worker entry — no rebuild.
                  </p>
                </div>
              </div>

              <div className={styles.outcomeStrip} aria-label="Worker outcomes">
                {metrics.slice(0, 3).map((metric) => (
                  <article key={metric.label} className={styles.outcomeCard}>
                    <p className={styles.monoKickerExact}>{metric.label}</p>
                    <p className={styles.outcomeValue}>{metric.value}</p>
                    <p className={styles.outcomeHint}>{metric.hint ?? "From Tessiant CRM"}</p>
                  </article>
                ))}
              </div>

              <section className={`${styles.cardExact} ${styles.kbSection}`}>
                <div className={styles.journeyHead}>
                  <div>
                    <h3>{isNetwork ? "Network journey" : showFunnelTrends ? "Placement journey" : "Worker journey"}</h3>
                    <p>
                      {isNetwork
                        ? "Sample → verified available → open demand → thin coverage"
                        : "Counts from the current Tessiant CRM sample for this worker."}
                    </p>
                  </div>
                  <div className={styles.journeyPeriod}>
                    <span className={styles.monoKickerExact}>Period</span>
                    <button
                      type="button"
                      className={journeyPeriod === "30d" ? styles.filterPillOn : styles.filterPillOff}
                      onClick={() => setJourneyPeriod("30d")}
                    >
                      Last 30 days
                    </button>
                    <button
                      type="button"
                      className={journeyPeriod === "90d" ? styles.filterPillOn : styles.filterPillOff}
                      onClick={() => setJourneyPeriod("90d")}
                    >
                      90 days
                    </button>
                  </div>
                </div>
                <ol className={styles.funnelVisual}>
                  {journey.map((step, index) => (
                    <li key={step.label} className={styles.funnelRow}>
                      <Link href={step.href} className={styles.funnelStage} data-focus={Boolean(step.focus)}>
                        <span className={styles.funnelLabel}>{step.label}</span>
                        <strong className={styles.funnelValue}>{step.value}</strong>
                        <span className={styles.funnelHint}>{step.hint}</span>
                      </Link>
                      {index < journey.length - 1 ? (
                        <span className={styles.funnelArrow} aria-hidden>
                          →
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ol>
                <p className={styles.journeyFoot}>
                  Journey counts for the selected period ({journeyPeriod}). Insights stay in the box below.{" "}
                  <Link href={isNetwork ? "/staffing/associates" : "/staffing/requirements"}>Open related CRM records</Link>
                </p>
              </section>

              <section className={`${styles.cardExact} ${styles.findingsBoxExact} ${styles.kbSection}`}>
                <div className={styles.findingsTopExact}>
                  <h2>Insights</h2>
                  <p>Same findings as Pulse. Evidence and the recommended action sit in this box.</p>
                </div>
                {selected ? (
                  <div className={styles.findingsSplitExact}>
                    <div className={styles.findingsListExact}>
                      <div className={styles.findingsListHeadExact}>
                        <p className={styles.monoKickerExact}>Insight</p>
                        <p>
                          {insights.length} patterns · select one
                        </p>
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
                              <b>{counts.pending}</b>
                              <span>Pending</span>
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
                                If this works, Value will track {expectedBenefit(selected)} from the completion date.
                              </p>
                              <div className={styles.actionRowExact}>
                                <button type="button" className={styles.btnPulsePrimary} onClick={() => accept(selected.id)}>
                                  Accept
                                </button>
                                <button type="button" className={styles.btnPulseSecondary} onClick={() => setShowReject((v) => !v)}>
                                  Reject
                                </button>
                              </div>
                              {showReject ? (
                                <div className={styles.rejectRowExact}>
                                  <input
                                    className="input"
                                    value={rejectReason}
                                    onChange={(event) => setRejectReason(event.target.value)}
                                    placeholder="Why reject? (optional)"
                                    aria-label="Rejection reason"
                                  />
                                  <button type="button" className={styles.btnPulsePrimary} onClick={() => reject(selected.id)}>
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
                  <div className={styles.kbEmptyPad}>
                    <EmptyState title="No active signals for this block" icon="sparkles">
                      Missing inputs suppress rules rather than inventing numbers.
                    </EmptyState>
                  </div>
                )}
              </section>

              <section className={`${styles.cardExact} ${styles.kbSection}`}>
                <div className={styles.kbCardHead}>
                  <h3>How this block works</h3>
                  <span>Confirmed Tessiant sources → reviewable insights → tracked outcomes</span>
                </div>
                <div className={styles.kbFlowPad}>
                  <KnowledgeFlow blockTitle={block.title} sources={block.dataSources} variant="overview" />
                </div>
              </section>
            </div>
          ) : null}

          {tab === "analytics" ? (
            <div className={styles.kbFrame}>
              {isNetwork ? (
                <NetworkIntelligenceDashboard state={state} insights={insights} />
              ) : (
                <section className={styles.three}>
                  {showNetworkTrends && mix ? (
                    <article className={styles.cardExact}>
                      <div className={styles.kbCardHead}>
                        <h3>Network mix (sample)</h3>
                        <span>
                          Bars use seeded sample ({mix.sampleSize}) — not illustrative total ({mix.networkTotal}).
                        </span>
                      </div>
                      <div className={styles.kbCardBody}>
                        {Object.entries(mix.byRole).map(([role, count]) => (
                          <div key={role} className={styles.barRow}>
                            <span>{role}</span>
                            <div className={styles.barTrack}>
                              <div className={styles.barFill} style={{ width: `${(count / mix.sampleSize) * 100}%` }} />
                            </div>
                            <span className="tabular">{count}</span>
                          </div>
                        ))}
                        <h4 className={styles.sectionLabel}>By sector</h4>
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
                  ) : null}
                  {showFunnelTrends && funnel ? (
                    <article className={styles.cardExact}>
                      <div className={styles.kbCardHead}>
                        <h3>Placement funnel</h3>
                        <span>
                          Denominator: {funnel.denominator} non-archived · lost/hold {funnel.lostOrHeld}.
                        </span>
                      </div>
                      <div className={styles.kbCardBody}>
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
                  ) : null}
                  {showCommercialTrends && snapshot ? (
                    <article className={styles.cardExact}>
                      <div className={styles.kbCardHead}>
                        <h3>Commercial posture</h3>
                        <span>Realised vs pipeline kept distinct — Pulse never invents revenue.</span>
                      </div>
                      <div className={`${styles.kbCardBody} ${styles.valueGrid}`}>
                        <div className={styles.valueCard} data-kind="realised">
                          <h3>Realised</h3>
                          <b className="tabular">£{snapshot.financials.realised.toLocaleString("en-GB")}</b>
                        </div>
                        <div className={styles.valueCard} data-kind="pipeline">
                          <h3>Pipeline</h3>
                          <b className="tabular">£{snapshot.financials.pipeline.toLocaleString("en-GB")}</b>
                        </div>
                        <div className={styles.valueCard}>
                          <h3>Agreed</h3>
                          <b className="tabular">£{snapshot.financials.agreed.toLocaleString("en-GB")}</b>
                        </div>
                      </div>
                    </article>
                  ) : null}
                  {!showNetworkTrends && !showFunnelTrends && !showCommercialTrends ? (
                    <EmptyState title="No trend views for this block" icon="sparkles" />
                  ) : null}
                </section>
              )}
            </div>
          ) : null}

          {tab === "learnings" ? (
            <div className={styles.kbFrame}>
              <div className={styles.lockBanner}>
                <span className={styles.lockIcon} aria-hidden>
                  🔒
                </span>
                <div>
                  <p className={styles.lockTitle}>Locked learnings</p>
                  <p className={styles.lockCopy}>
                    {block.title} trains on accepted and rejected decisions. Prompts, tone, and behaviour cannot be edited
                    while it is serving Tessiant operators. This is the record of what was accepted and what was rejected.
                  </p>
                </div>
              </div>
              <div className={styles.biGrid}>
                <section className={styles.cardExact}>
                  <div className={styles.kbCardBody}>
                    <h3>Accepted</h3>
                    <ul className={styles.lockList}>
                      {accepted.length ? (
                        accepted.map((item) => (
                          <li key={item.id}>
                            <p>{item.title}</p>
                            <span>
                              Accepted · {item.taskId ? "on the backlog" : "recorded"} · {item.generatedAt.slice(0, 10)}
                            </span>
                          </li>
                        ))
                      ) : (
                        <li className={styles.lockEmpty}>Nothing accepted yet.</li>
                      )}
                    </ul>
                  </div>
                </section>
                <section className={styles.cardExact}>
                  <div className={styles.kbCardBody}>
                    <h3>Rejected</h3>
                    <ul className={styles.lockList}>
                      {rejected.length ? (
                        rejected.map((item) => (
                          <li key={item.id}>
                            <p>{item.title}</p>
                            <span>
                              Rejected{item.reviewReason ? ` · ${item.reviewReason}` : ""} · {item.generatedAt.slice(0, 10)}
                            </span>
                          </li>
                        ))
                      ) : (
                        <li className={styles.lockEmpty}>Nothing rejected yet.</li>
                      )}
                    </ul>
                  </div>
                </section>
              </div>
            </div>
          ) : null}

          {tab === "connections" ? (
            <div className={styles.kbFrame}>
              <div className={styles.kbPanelHead}>
                <div>
                  <h2 className={styles.kbPanelTitle}>Connections and channels</h2>
                  <p className={styles.kbPanelSub}>The same card for every source on this worker. Demo honesty stays visible.</p>
                </div>
              </div>
              <div className={styles.sourcesGrid}>
                {CHANNELS.map((channel) => (
                  <article key={channel.id} className={styles.channelCard}>
                    <p className={styles.monoKickerExact}>Channel</p>
                    <h3>{channel.id}</h3>
                    <p>{channel.note}</p>
                    <p className={styles.channelStatus} style={{ color: "#b45309" }}>
                      Proposed
                    </p>
                  </article>
                ))}
              </div>
              <div className={styles.sourcesGrid} style={{ marginTop: "1rem" }}>
                {connectionSources.map((source) => (
                  <article key={source.name} className={styles.channelCard}>
                    <p className={styles.monoKickerExact}>Source</p>
                    <h3>{source.name}</h3>
                    <p>{source.note}</p>
                    <p className={styles.channelStatus} style={{ color: source.tone }}>
                      {source.status}
                    </p>
                  </article>
                ))}
              </div>
            </div>
          ) : null}

          {tab === "how" ? (
            <div className={styles.kbFrame}>
              <div className={styles.kbPanelHead}>
                <div>
                  <h2 className={styles.kbPanelTitle}>How this block works</h2>
                  <p className={styles.kbPanelSub}>How Tessiant business intelligence is produced — not developer configuration.</p>
                </div>
              </div>
              <section className={styles.cardExact}>
                <div className={styles.kbFlowPad}>
                  <KnowledgeFlow blockTitle={block.title} sources={block.dataSources} />
                  <p className={styles.journeyFoot} style={{ marginTop: 14 }}>
                    Accepting an insight creates a to-do. Completing it can record outcomes — realised revenue stays separate
                    from pipeline potential and agreed commercial value.
                  </p>
                </div>
              </section>
            </div>
          ) : null}

          {tab === "settings" ? (
            <div className={styles.kbFrame}>
              <div className={styles.kbPanelHead}>
                <div>
                  <h2 className={styles.kbPanelTitle}>Worker settings</h2>
                  <p className={styles.kbPanelSub}>Profile only. Behaviour stays locked so a live book cannot be changed by mistake.</p>
                </div>
              </div>
              <section className={`${styles.cardExact} ${styles.kbSection}`}>
                <div className={styles.kbCardBody}>
                  <p className={styles.settingsGroupTitle}>Profile settings</p>
                  <p className={styles.kbPanelSub}>Details this worker uses to introduce itself.</p>
                  <label className={styles.settingsField}>
                    <span>Name</span>
                    <input className="input" value={block.title} readOnly />
                  </label>
                  <label className={styles.settingsField}>
                    <span>Role</span>
                    <input className="input" value={mark.role} readOnly />
                  </label>
                  <label className={styles.settingsField}>
                    <span>Owner</span>
                    <input className="input" value={block.owner} readOnly />
                  </label>
                  <label className={styles.settingsField}>
                    <span>Priority</span>
                    <input className="input" value={block.priority} readOnly />
                  </label>
                  <p className={styles.journeyFoot}>
                    Read only for this demo. Changes to prompts and tone live under Locked learnings, and those controls stay
                    closed.
                  </p>
                </div>
              </section>
              <section className={styles.cardExact}>
                <div className={styles.kbCardHead}>
                  <h3>Advanced configuration</h3>
                  <span>Reference only — operators do not edit these while the worker is live.</span>
                </div>
                <div className={`${styles.kbCardBody} ${styles.advancedGrid}`}>
                  <div>
                    <h4 className={styles.sectionLabel}>Data sources</h4>
                    <ul className={styles.plainList}>
                      {block.dataSources.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h4 className={styles.sectionLabel}>Required fields</h4>
                    <ul className={styles.plainList}>
                      {block.requiredFields.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h4 className={styles.sectionLabel}>Business rules</h4>
                    <ul className={styles.plainList}>
                      {block.businessRules.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h4 className={styles.sectionLabel}>Signal definitions</h4>
                    <div className={styles.actions}>
                      {block.signalDefinitions.map((item) => (
                        <span key={item} className="chip">
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </section>
            </div>
          ) : null}
        </div>
      </div>
    </PulseShell>
  );
}
