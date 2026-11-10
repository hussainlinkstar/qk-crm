"use client";

import Link from "next/link";
import { SkeletonRows, useWorkspaceData } from "@/components/ui/bits";
import PulseSubnav from "@/components/pulse/PulseSubnav";
import { getPulseSnapshot } from "@/lib/pulse-adapter";
import { timeAgo } from "@/lib/format";
import styles from "../pulse.module.css";

export default function PulseConnectionsPage() {
  const { state } = useWorkspaceData();
  if (!state) {
    return (
      <div className="page">
        <SkeletonRows rows={3} height={80} />
      </div>
    );
  }

  const snapshot = getPulseSnapshot(state);

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <div className={styles.context}>
            <span className="chip chip-ai">Qiko Pulse</span>
            <span className="chip">Connections</span>
          </div>
          <h1>Connections</h1>
          <p className="subtitle">Where Tessiant Pulse reads business data — honest demo connector status.</p>
        </div>
      </header>

      <PulseSubnav />

      <section className="card">
        <div className="card-body">
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", padding: 8 }}>Source</th>
                <th style={{ textAlign: "left", padding: 8 }}>Status</th>
                <th style={{ textAlign: "left", padding: 8 }}>Notes</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ padding: 8 }}>Tessiant CRM</td>
                <td style={{ padding: 8 }}>
                  <span className="chip chip-ai">Connected</span>
                </td>
                <td style={{ padding: 8 }} className="muted">
                  Live demo fixture · same associates, requirements and assignments as Staffing · refreshed {timeAgo(snapshot.generatedAt)}
                </td>
              </tr>
              <tr>
                <td style={{ padding: 8 }}>Salesforce</td>
                <td style={{ padding: 8 }}>
                  <span className="chip">Not connected</span>
                </td>
                <td style={{ padding: 8 }} className="muted">
                  Available later — CRM entity mappings already prepared in Pulse
                </td>
              </tr>
              <tr>
                <td style={{ padding: 8 }}>SharePoint / CV repository</td>
                <td style={{ padding: 8 }}>
                  <span className="chip">Not connected</span>
                </td>
                <td style={{ padding: 8 }} className="muted">
                  No personal documents processed in this demo
                </td>
              </tr>
              <tr>
                <td style={{ padding: 8 }}>LinkedIn</td>
                <td style={{ padding: 8 }}>
                  <span className="chip">Out of scope</span>
                </td>
                <td style={{ padding: 8 }} className="muted">
                  No scraping
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="card">
        <div className="card-head">
          <h2>What Pulse can see</h2>
        </div>
        <div className="card-body">
          <ul>
            <li>
              Illustrative network {snapshot.network.totalMembers} · workspace sample {snapshot.network.sampleSize}
            </li>
            <li>
              Open requirements {snapshot.requirements.open} · placed {snapshot.requirements.placed}
            </li>
            <li>
              Capacity signals ready for review {snapshot.capacitySignals.length}
            </li>
          </ul>
          <Link href="/staffing" className="text-link">
            Open Tessiant staffing overview
          </Link>
        </div>
      </section>

      <details className={styles.advanced}>
        <summary>Advanced configuration</summary>
        <div className={styles.advancedBody}>
          <p className="muted">{snapshot.financials.note}</p>
          <p className="muted">Integration diagnostics and schema details stay here — not on the customer cockpit.</p>
        </div>
      </details>
    </div>
  );
}
