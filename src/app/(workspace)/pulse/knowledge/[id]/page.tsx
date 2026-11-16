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
import { avatarStyle, initials, timeAgo } from "@/lib/format";
import { buildLockedLearnings, type LockedLearning } from "@/lib/tessiant-locked-learnings";
import type { InsightEvidence } from "@/lib/tessiant-pulse-types";
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

  const locked = useMemo(() => {
    if (!state) return { confirmed: [], acceptedOpen: [], rejected: [], awaiting: [] as typeof insights };
    return buildLockedLearnings(state, insights);
  }, [state, insights]);
  const lockedTotal = locked.confirmed.length + locked.acceptedOpen.length + locked.rejected.length;

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
  // Flow diagram shows Tessiant CRM surfaces that feed the worker — not invented external connectors.
  const FLOW_EXTRAS: Record<string, string[]> = {
    network: ["requirements", "assignments", "skills & sectors", "placements", "candidates"],
    augmentation: ["associates", "availability", "stage history", "offerings"],
    commercial: ["placements", "opportunities", "CRM leads", "relationship owners"],
    capability: ["associates", "requirements", "sector mix", "open demand"],
  };
  const flowSources = Array.from(new Set([...block.dataSources, ...(FLOW_EXTRAS[block.id] ?? [])])).slice(0, 9);
  const maxStage = Math.max(1, ...(funnel?.stages.map((row) => row.count) ?? [1]));
  const maxSector = Math.max(1, ...Object.values(mix?.bySector ?? { _: 1 }));
  const showNetworkTrends = block.id === "network" || block.id === "capability";
  const showFunnelTrends = block.id === "augmentation" || block.id === "capability";
  const showCommercialTrends = block.id === "commercial";
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
      note: `Local fixture · associates, requirements and assignments · refreshed ${timeAgo(snapshot?.generatedAt ?? block.updatedAt)}`,
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
      note: "No scraping. Not connected.",
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
                          <p className={styles.evidenceRuleExact}>{rulePlainLanguage(selected.ruleId)}</p>
                          <div className={styles.evidenceMetricsExact}>
                            <div>
                              <b>{selected.reviewStatus}</b>
                              <span>Status</span>
                            </div>
                            <div>
                              <b>{selected.priority}</b>
                              <span>Priority</span>
                            </div>
                            <div>
                              <b>{selected.confidence}</b>
                              <span>Confidence</span>
                            </div>
                            <div>
                              <b>{selected.evidence.length}</b>
                              <span>Records</span>
                            </div>
                          </div>
                          <div className={styles.evidenceMetaRowExact}>
                            <span>Rule · {selected.ruleId}</span>
                            <span>Generated · {selected.generatedAt.slice(0, 10)}</span>
                            <span>Data as of · {selected.dataAsOf.slice(0, 10)}</span>
                            <span>Benefit · {expectedBenefit(selected)}</span>
                          </div>
                          <ul className={styles.evidencePeople}>
                            {selected.evidence.slice(0, 6).map((item, index) => (
                              <EvidencePersonRow key={`${item.entityType}-${item.entityId}-${index}`} state={state} item={item} />
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
                            <>
                              <p className={styles.actionTitleExact}>Rejected</p>
                              <p>
                                {selected.reviewReason
                                  ? `Reason: ${selected.reviewReason}. `
                                  : ""}
                                This signal will not go on the backlog, and no commercial value was assumed.
                              </p>
                              <div className={styles.actionContextExact}>
                                <p>{rulePlainLanguage(selected.ruleId)}</p>
                                <p>Original action was: {selected.recommendedAction.label}</p>
                              </div>
                            </>
                          ) : selectedOutcome?.status === "completed" ? (
                            <>
                              <p className={styles.actionTitleExact}>Measured outcome</p>
                              <p>{selectedOutcome.summary}</p>
                              {selectedOutcome.value.qualitativeBenefit ? (
                                <p className={styles.actionMetricExact}>{selectedOutcome.value.qualitativeBenefit}</p>
                              ) : null}
                              <div className={styles.actionContextExact}>
                                <p>Accepted action: {selected.recommendedAction.label}</p>
                                <p>Value tracks {expectedBenefit(selected)} from the completion date.</p>
                              </div>
                              <div className={styles.actionRowExact}>
                                <Link href="/pulse/value" className={styles.btnPulsePrimary}>
                                  Open Value
                                </Link>
                                {selected.taskId ? (
                                  <button type="button" className={styles.btnPulseSecondary} onClick={() => openTask(selected.taskId!)}>
                                    Open Task
                                  </button>
                                ) : null}
                              </div>
                            </>
                          ) : selected.reviewStatus === "accepted" ? (
                            <>
                              <p className={styles.actionTitleExact}>{selected.recommendedAction.label}</p>
                              <p>Accepted. Follow-through is on the backlog — outcome not measured yet.</p>
                              <div className={styles.actionContextExact}>
                                <p>{rulePlainLanguage(selected.ruleId)}</p>
                                <p>When complete, Value can track {expectedBenefit(selected)}.</p>
                              </div>
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
                              <div className={styles.actionContextExact}>
                                <p>
                                  Accept creates a to-do. Completing it can record an outcome — realised revenue stays
                                  separate from pipeline potential.
                                </p>
                                <p>If this works, Value will track {expectedBenefit(selected)} from the completion date.</p>
                              </div>
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
                  <span>Click a source</span>
                </div>
                <div className={styles.kbFlowPad}>
                  <KnowledgeFlow
                    blockTitle={block.title}
                    sources={flowSources}
                    variant="overview"
                    mark={mark.initials}
                    subtitle={`${counts.pending} pending · ${counts.accepted} accepted`}
                    outcomeLabel="Tracked"
                    outcomeStatus="Proposed"
                  />
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
                    {block.title} only locks what operators accepted or rejected, then measured. Every statement below is
                    composed from the insight summary, CRM evidence, and recorded outcome — nothing invented.
                  </p>
                </div>
              </div>

              <div className={styles.lockStats}>
                <div>
                  <b className="tabular">{locked.confirmed.length}</b>
                  <span>Confirmed</span>
                </div>
                <div>
                  <b className="tabular">{locked.acceptedOpen.length}</b>
                  <span>Accepted · open</span>
                </div>
                <div>
                  <b className="tabular">{locked.rejected.length}</b>
                  <span>Rejected</span>
                </div>
                <div>
                  <b className="tabular">{locked.awaiting.length}</b>
                  <span>Awaiting lock</span>
                </div>
              </div>

              {lockedTotal === 0 ? (
                <section className={styles.cardExact}>
                  <div className={styles.kbCardBody}>
                    <EmptyState title="No locked learnings yet" icon="sparkles">
                      Accept or reject an insight on Overview, complete the to-do, and the measured result lands here.
                    </EmptyState>
                  </div>
                </section>
              ) : (
                <div className={styles.lockStack}>
                  {locked.confirmed.length ? (
                    <LockedLearningSection
                      title="Confirmed learnings"
                      hint="Accepted, completed, and measured against CRM evidence"
                      items={locked.confirmed}
                      onOpenTask={openTask}
                    />
                  ) : null}
                  {locked.acceptedOpen.length ? (
                    <LockedLearningSection
                      title="Accepted · outcome open"
                      hint="On the backlog or still pending measurement"
                      items={locked.acceptedOpen}
                      onOpenTask={openTask}
                    />
                  ) : null}
                  {locked.rejected.length ? (
                    <LockedLearningSection
                      title="Rejected"
                      hint="Operator declines with reason — no commercial value assumed"
                      items={locked.rejected}
                      onOpenTask={openTask}
                    />
                  ) : null}
                </div>
              )}

              {locked.awaiting.length ? (
                <section className={`${styles.cardExact} ${styles.lockAwaiting}`} aria-label="Signals awaiting lock">
                  <div className={styles.kbCardHead}>
                    <h3>Signals awaiting lock</h3>
                    <span>{locked.awaiting.length} pending · not locked yet</span>
                  </div>
                  <ul className={styles.lockAwaitList}>
                    {locked.awaiting.map((item) => (
                      <li key={item.id}>
                        <button type="button" onClick={() => { setSelectedId(item.id); setTab("overview"); }}>
                          <b>{item.title}</b>
                          <span>{item.summary}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}
            </div>
          ) : null}

          {tab === "connections" ? (
            <div className={styles.kbFrame}>
              <div className={styles.kbPanelHead}>
                <div>
                  <h2 className={styles.kbPanelTitle}>Connections and channels</h2>
                  <p className={styles.kbPanelSub}>The same card for every source on this worker. Status stays visible.</p>
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
                <div className={styles.kbCardHead}>
                  <h3>How this block works</h3>
                  <span>Click a source</span>
                </div>
                <div className={styles.kbFlowPad}>
                  <KnowledgeFlow
                    blockTitle={block.title}
                    sources={flowSources}
                    variant="overview"
                    mark={mark.initials}
                    subtitle={`${counts.pending} pending · ${counts.accepted} accepted`}
                    outcomeLabel="Tracked"
                    outcomeStatus="Proposed"
                  />
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
                    Read only here. Changes to prompts and tone live under Locked learnings, and those controls stay
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

function EvidencePersonRow({
  state,
  item,
}: {
  state: NonNullable<ReturnType<typeof useWorkspaceData>["state"]>;
  item: InsightEvidence;
}) {
  const label = evidenceLabel(state, item);
  const kind = evidenceKindLabel(item);
  const mark = initials(label);
  const colours = avatarStyle(label);
  const detail =
    item.field != null && item.observedValue != null && item.observedValue !== ""
      ? `${item.field}: ${String(item.observedValue)}`
      : null;
  const body = (
    <>
      <span className={styles.evidenceAvatar} style={colours} aria-hidden>
        {mark}
      </span>
      <span className={styles.evidencePersonCopy}>
        <b>{label}</b>
        <span>
          {kind}
          {detail ? ` · ${detail}` : ""}
        </span>
      </span>
    </>
  );

  return (
    <li>
      {item.href ? (
        <Link href={item.href} className={styles.evidencePerson}>
          {body}
        </Link>
      ) : (
        <div className={styles.evidencePerson}>{body}</div>
      )}
    </li>
  );
}

function LockedLearningSection({
  title,
  hint,
  items,
  onOpenTask,
}: {
  title: string;
  hint: string;
  items: LockedLearning[];
  onOpenTask: (taskId: string) => void;
}) {
  return (
    <section className={styles.cardExact} aria-label={title}>
      <div className={styles.kbCardHead}>
        <h3>{title}</h3>
        <span>
          {items.length} · {hint}
        </span>
      </div>
      <ul className={styles.lockLearningList}>
        {items.map((item) => (
          <li key={item.id} className={styles.lockLearningCard} data-kind={item.kind}>
            <div className={styles.lockLearningTop}>
              <span className={styles.lockKindChip} data-kind={item.kind}>
                {item.kind === "confirmed" ? "Confirmed" : item.kind === "accepted" ? "Accepted" : "Rejected"}
              </span>
              <span className="chip">{item.priority}</span>
              <span className="chip">{item.confidence}</span>
              <span className={styles.lockDate}>{item.decidedAt.slice(0, 10)}</span>
            </div>
            <h4>{item.title}</h4>
            <p className={styles.lockLearningBody}>{item.learning}</p>
            {item.valueNote ? <p className={styles.lockValueNote}>{item.valueNote}</p> : null}
            {item.evidence.length ? (
              <ul className={styles.lockEvidence}>
                {item.evidence.map((row, index) => (
                  <li key={`${item.id}-${row.label}-${index}`}>
                    {row.href ? (
                      <Link href={row.href}>
                        {row.kind} · {row.label}
                      </Link>
                    ) : (
                      <span>
                        {row.kind} · {row.label}
                      </span>
                    )}
                    {row.field != null && row.observedValue != null && row.observedValue !== "" ? (
                      <em>
                        {row.field}: {String(row.observedValue)}
                      </em>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : null}
            <div className={styles.lockLearningFoot}>
              <span>Action: {item.action}</span>
              <span>Rule: {item.ruleId}</span>
              {item.taskId ? (
                <button type="button" className="text-link" onClick={() => onOpenTask(item.taskId!)}>
                  Open linked to-do
                </button>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
