"use client";

import Link from "next/link";
import { SkeletonRows, useWorkspaceData } from "@/components/ui/bits";
import AskPulseChat from "@/components/pulse/AskPulseChat";
import PulseShell from "@/components/pulse/PulseShell";
import PulseSubnav from "@/components/pulse/PulseSubnav";
import { getPulseSnapshot } from "@/lib/pulse-adapter";
import { timeAgo } from "@/lib/format";
import styles from "../pulse.module.css";

const STATUS_COLOR = {
  connected: "#059669",
  proposed: "#b45309",
  blocked: "#64748b",
} as const;

export default function PulseConnectionsPage() {
  const { state } = useWorkspaceData();
  if (!state) {
    return (
      <PulseShell>
        <div className={styles.pulsePageExact}>
          <SkeletonRows rows={3} height={80} />
        </div>
      </PulseShell>
    );
  }

  const snapshot = getPulseSnapshot(state);
  const sources = [
    {
      name: "Tessiant CRM",
      note: `Local fixture · same associates, requirements and assignments as Staffing · refreshed ${timeAgo(snapshot.generatedAt)}`,
      status: "Connected",
      tone: "connected" as const,
    },
    {
      name: "Salesforce",
      note: "Available later — CRM entity mappings already prepared in Pulse. Nothing is sent without a person.",
      status: "Not connected",
      tone: "proposed" as const,
    },
    {
      name: "SharePoint / CV repository",
      note: "No personal documents processed.",
      status: "Not connected",
      tone: "proposed" as const,
    },
    {
      name: "LinkedIn",
      note: "No scraping. Not connected.",
      status: "Out of scope",
      tone: "blocked" as const,
    },
  ];

  const visible = [
    {
      name: "Illustrative network",
      note: `Workspace sample ${snapshot.network.sampleSize}. The ${snapshot.network.totalMembers} figure is the wider network, not the profile sample.`,
      value: String(snapshot.network.totalMembers),
    },
    {
      name: "Open requirements",
      note: `${snapshot.requirements.placed} placed in the current workspace sample.`,
      value: String(snapshot.requirements.open),
    },
    {
      name: "Capacity signals",
      note: "Ready for review from the live staffing records.",
      value: String(snapshot.capacitySignals.length),
    },
  ];

  return (
    <PulseShell>
      <div className={styles.pulsePageExact} data-view="connections">
        <header className={styles.pulseHeadExact}>
          <div className={styles.pulseHeadCopyExact}>
            <h1>Connections</h1>
            <p>Where Tessiant Pulse reads business data. Each card shows the real connection status; nothing here is a live send.</p>
          </div>
          <div className={styles.pulseHeadToolsExact}>
            <AskPulseChat state={state} realised={snapshot.financials.realised} />
          </div>
        </header>

        <PulseSubnav />

        <section className={styles.channelSection} aria-labelledby="pulse-connections">
          <h2 id="pulse-connections">Connections and channels</h2>
          <p>One card for every source. Read is allowed from Tessiant CRM. Sending and scraping stay blocked.</p>
          <div className={styles.channelGrid} style={{ marginTop: "1rem" }}>
            {sources.map((source) => (
              <article key={source.name} className={styles.channelCard}>
                <p className={styles.monoKickerExact}>Source</p>
                <h3>{source.name}</h3>
                <p>{source.note}</p>
                <p className={styles.channelStatus} style={{ color: STATUS_COLOR[source.tone] }}>
                  {source.status}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.channelSection} aria-labelledby="pulse-visible">
          <h2 id="pulse-visible">What Pulse can see</h2>
          <p>Counts from the workspace sample already loaded in Staffing.</p>
          <div className={styles.channelGrid} style={{ marginTop: "1rem" }}>
            {visible.map((item) => (
              <article key={item.name} className={styles.channelCard}>
                <p className={styles.monoKickerExact}>Visible</p>
                <h3>{item.name}</h3>
                <p>{item.note}</p>
                <p className={styles.channelStatus} style={{ color: "#0f172a", fontSize: 18 }}>
                  {item.value}
                </p>
              </article>
            ))}
          </div>
          <p style={{ marginTop: "0.85rem" }}>
            <Link href="/staffing" className={styles.mapLinkExact}>
              Open Tessiant staffing overview
            </Link>
          </p>
        </section>

        <details className={styles.advanced}>
          <summary>Advanced configuration</summary>
          <div className={styles.advancedBody}>
            <p className="muted">{snapshot.financials.note}</p>
            <p className="muted">Integration diagnostics and schema details stay here — not on the customer cockpit.</p>
          </div>
        </details>
      </div>
    </PulseShell>
  );
}
