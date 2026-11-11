"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { EmptyState, SkeletonRows, useNow, useWorkspaceData } from "@/components/ui/bits";
import InsightCard from "@/components/pulse/InsightCard";
import KnowledgeFlow from "@/components/pulse/KnowledgeFlow";
import NetworkIntelligenceDashboard from "@/components/pulse/NetworkIntelligenceDashboard";
import PulseShell from "@/components/pulse/PulseShell";
import PulseSubnav from "@/components/pulse/PulseSubnav";
import { formatDate } from "@/lib/format";
import { getPulseSnapshot } from "@/lib/pulse-adapter";
import {
  getKnowledgeBlock,
  getKnowledgeBlockLiveMetrics,
  summarizeBlockInsights,
} from "@/lib/tessiant-knowledge";
import { generateTessiantInsights, networkMix, placementFunnel } from "@/lib/tessiant-pulse-rules";
import styles from "../../pulse.module.css";

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "insights", label: "Insights" },
  { key: "trends", label: "Trends & Analysis" },
  { key: "sources", label: "Knowledge Sources" },
  { key: "how", label: "How this block works" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export default function PulseKnowledgeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { state } = useWorkspaceData();
  const now = useNow();
  const [tab, setTab] = useState<TabKey>("overview");
  const block = getKnowledgeBlock(id);

  const insights = useMemo(() => {
    if (!state || !block) return [];
    return generateTessiantInsights(state, now || Date.now()).filter((item) => item.knowledgeBlockId === block.id);
  }, [state, now, block]);

  const mix = useMemo(() => (state ? networkMix(state) : null), [state]);
  const funnel = useMemo(() => (state ? placementFunnel(state) : null), [state]);
  const snapshot = useMemo(() => (state ? getPulseSnapshot(state) : null), [state]);

  if (!state) {
    return (
      <PulseShell>
        <div className="page">
          <SkeletonRows rows={4} height={80} />
        </div>
      </PulseShell>
    );
  }

  if (!block) {
    return (
      <PulseShell>
        <div className="page">
          <EmptyState title="Unknown knowledge block">
            <Link href="/pulse/knowledge">Back</Link>
          </EmptyState>
        </div>
      </PulseShell>
    );
  }

  const counts = summarizeBlockInsights(insights);
  const metrics = getKnowledgeBlockLiveMetrics(block.id, { mix, funnel, snapshot, state });
  const maxSector = Math.max(1, ...Object.values(mix?.bySector ?? { _: 1 }));
  const maxStage = Math.max(1, ...(funnel?.stages.map((row) => row.count) ?? [1]));
  const showNetworkTrends = block.id === "network" || block.id === "capability";
  const showFunnelTrends = block.id === "augmentation" || block.id === "capability";
  const showCommercialTrends = block.id === "commercial";

  const isNetwork = block.id === "network";

  return (
    <PulseShell>
    <div className={`page ${styles.pulsePage}`}>
      <header className="page-head">
        <div>
          <p className="kicker">
            <Link href="/pulse/knowledge">Knowledge</Link>
            <span aria-hidden> / </span>
            <span>{block.priority}</span>
          </p>
          <h1>{block.title}</h1>
          <p className="subtitle">{block.purpose}</p>
        </div>
        <div className="page-actions">
          <span className="chip">{counts.pending} pending</span>
          <span className="chip">Updated {formatDate(block.updatedAt, true)}</span>
        </div>
      </header>

      <PulseSubnav />

      {isNetwork ? <NetworkIntelligenceDashboard state={state} insights={insights} block={block} /> : null}

      {!isNetwork ? (
      <>
      <div className={styles.tabs} role="tablist" aria-label="Knowledge block sections">
        {TABS.map((item) => (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={tab === item.key}
            className={styles.tab}
            data-active={tab === item.key}
            onClick={() => setTab(item.key)}
          >
            {item.label}
            {item.key === "insights" ? <span className={styles.tabCount}>{counts.total}</span> : null}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <section className={styles.split}>
          <article className="card">
            <div className="card-head">
              <div>
                <h2>Business question</h2>
                <p className="card-sub">What this block is answering for Tessiant operators.</p>
              </div>
            </div>
            <div className="card-body">
              <p className={styles.businessQuestion}>{block.purpose}</p>
              <dl className={styles.metaGrid}>
                <div>
                  <dt>Owner</dt>
                  <dd>{block.owner}</dd>
                </div>
                <div>
                  <dt>Priority</dt>
                  <dd>{block.priority}</dd>
                </div>
                <div>
                  <dt>Active insights</dt>
                  <dd className="tabular">
                    {counts.total} total · {counts.pending} pending · {counts.accepted} accepted
                  </dd>
                </div>
                <div>
                  <dt>Last updated</dt>
                  <dd>{formatDate(block.updatedAt, true)}</dd>
                </div>
              </dl>
              <h3 className={styles.sectionLabel}>Example outcomes</h3>
              <ul className={styles.plainList}>
                {block.outcomeMeasures.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </article>

          <article className="card">
            <div className="card-head">
              <div>
                <h2>Live metrics</h2>
                <p className="card-sub">Computed from current Tessiant CRM state — same sources as insight rules.</p>
              </div>
            </div>
            <div className="card-body">
              <div className={styles.liveMetricGrid}>
                {metrics.map((metric) => (
                  <div key={metric.label} className={styles.kpi}>
                    <span>{metric.label}</span>
                    <b className="tabular">{metric.value}</b>
                    {metric.hint ? <small>{metric.hint}</small> : null}
                  </div>
                ))}
              </div>
              {counts.pending > 0 ? (
                <p className={styles.note} style={{ marginTop: 12 }}>
                  {counts.pending} recommendation{counts.pending === 1 ? "" : "s"} waiting — open the Insights tab to
                  review with evidence.
                </p>
              ) : (
                <p className={styles.note} style={{ marginTop: 12 }}>
                  No pending recommendations for this block right now. Missing inputs suppress rules rather than inventing
                  numbers.
                </p>
              )}
            </div>
          </article>
        </section>
      )}

      {tab === "insights" && (
        <section className="card">
          <div className="card-head">
            <div>
              <h2>Live signals</h2>
              <p className="card-sub">Deterministic Tessiant rules filtered to this knowledge block.</p>
            </div>
          </div>
          <div className="card-body">
            {insights.length === 0 ? (
              <EmptyState title="No active signals for this block" icon="sparkles">
                Missing inputs suppress rules rather than inventing numbers.
              </EmptyState>
            ) : (
              insights.map((insight) => <InsightCard key={insight.id} insight={insight} />)
            )}
          </div>
        </section>
      )}

      {tab === "trends" && (
        <section className={styles.three}>
          {showNetworkTrends && mix ? (
            <article className="card">
              <div className="card-head">
                <div>
                  <h2>Network mix (sample)</h2>
                  <p className="card-sub">
                    Bars use seeded sample ({mix.sampleSize}) — not illustrative total ({mix.networkTotal}).
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
                <h3 className={styles.sectionLabel}>By sector</h3>
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
            <article className="card">
              <div className="card-head">
                <div>
                  <h2>Placement funnel</h2>
                  <p className="card-sub">
                    Denominator: {funnel.denominator} non-archived · lost/hold {funnel.lostOrHeld}.
                  </p>
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
          ) : null}

          {showCommercialTrends && snapshot ? (
            <article className="card">
              <div className="card-head">
                <div>
                  <h2>Commercial posture</h2>
                  <p className="card-sub">Realised vs pipeline kept distinct — Pulse never invents revenue.</p>
                </div>
              </div>
              <div className="card-body">
                <div className={styles.valueGrid}>
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
                {snapshot.capacitySignals.filter((signal) => signal.kind === "founder_dependency").length > 0 ? (
                  <>
                    <h3 className={styles.sectionLabel}>Relationship risk signals</h3>
                    <ul className={styles.plainList}>
                      {snapshot.capacitySignals
                        .filter((signal) => signal.kind === "founder_dependency")
                        .map((signal) => (
                          <li key={signal.id}>
                            <b>{signal.title}</b>
                            <div className="muted">{signal.detail}</div>
                          </li>
                        ))}
                    </ul>
                  </>
                ) : (
                  <p className={styles.note} style={{ marginTop: 12 }}>
                    No founder-dependency capacity signals in the current snapshot.
                  </p>
                )}
              </div>
            </article>
          ) : null}

          {!showNetworkTrends && !showFunnelTrends && !showCommercialTrends ? (
            <article className="card">
              <div className="card-body">
                <EmptyState title="No trend views for this block" icon="sparkles" />
              </div>
            </article>
          ) : null}

          <article className="card">
            <div className="card-head">
              <div>
                <h2>Insight mix</h2>
                <p className="card-sub">Review status for signals owned by this block.</p>
              </div>
            </div>
            <div className="card-body">
              <div className={styles.liveMetricGrid}>
                <div className={styles.kpi}>
                  <span>Pending</span>
                  <b className="tabular">{counts.pending}</b>
                </div>
                <div className={styles.kpi}>
                  <span>Accepted</span>
                  <b className="tabular">{counts.accepted}</b>
                </div>
                <div className={styles.kpi}>
                  <span>Rejected</span>
                  <b className="tabular">{counts.rejected}</b>
                </div>
              </div>
            </div>
          </article>
        </section>
      )}

      {tab === "sources" && (
        <section className={styles.split}>
          <article className="card">
            <div className="card-head">
              <div>
                <h2>Connected Tessiant records</h2>
                <p className="card-sub">CRM entities this block reads to produce insights.</p>
              </div>
            </div>
            <div className="card-body">
              <ul className={styles.sourceList}>
                <li>
                  <Link href="/staffing/associates">
                    <b>Associate network</b>
                  </Link>
                  <span className="muted">{state.tessiant?.associates.length ?? 0} profiles in sample</span>
                </li>
                <li>
                  <Link href="/staffing/requirements?view=open">
                    <b>Client requirements</b>
                  </Link>
                  <span className="muted">{snapshot?.requirements.open ?? 0} open</span>
                </li>
                <li>
                  <Link href="/staffing/placements?view=active">
                    <b>Assignments</b>
                  </Link>
                  <span className="muted">Active deployments and renewals</span>
                </li>
                <li>
                  <Link href="/sales/accounts">
                    <b>Accounts &amp; commercial relationships</b>
                  </Link>
                  <span className="muted">{state.tessiant?.accounts.length ?? 0} accounts</span>
                </li>
              </ul>
            </div>
          </article>
          <article className="card">
            <div className="card-head">
              <div>
                <h2>What operators do next</h2>
                <p className="card-sub">Typical actions when this block surfaces a recommendation.</p>
              </div>
            </div>
            <div className="card-body">
              <ul className={styles.plainList}>
                {block.actions.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              <h3 className={styles.sectionLabel}>Outcome measures</h3>
              <ul className={styles.plainList}>
                {block.outcomeMeasures.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </article>
        </section>
      )}

      {tab === "how" && (
        <section className="card">
          <div className="card-head">
            <div>
              <h2>How this block works</h2>
              <p className="card-sub">How Tessiant business intelligence is produced — not developer configuration.</p>
            </div>
          </div>
          <div className="card-body">
            <KnowledgeFlow blockTitle={block.title} />
            <p className={styles.note} style={{ marginTop: 14 }}>
              Accepting an insight creates a to-do. Completing it can record outcomes — realised revenue stays separate from
              pipeline potential and agreed commercial value.
            </p>
          </div>
        </section>
      )}
      </>
      ) : null}

      {!isNetwork ? (
      <details className={styles.advanced}>
        <summary>Advanced configuration</summary>
        <div className={styles.advancedBody}>
          <div className={styles.advancedGrid}>
            <div>
              <h3 className={styles.sectionLabel}>Data sources</h3>
              <ul className={styles.plainList}>
                {block.dataSources.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className={styles.sectionLabel}>Required fields</h3>
              <ul className={styles.plainList}>
                {block.requiredFields.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className={styles.sectionLabel}>Business rules</h3>
              <ul className={styles.plainList}>
                {block.businessRules.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className={styles.sectionLabel}>Signal definitions</h3>
              <div className={styles.actions}>
                {block.signalDefinitions.map((item) => (
                  <span key={item} className="chip">
                    {item}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </details>
      ) : null}
    </div>
    </PulseShell>
  );
}
