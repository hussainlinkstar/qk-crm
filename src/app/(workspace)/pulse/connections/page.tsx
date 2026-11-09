"use client";

import Link from "next/link";
import { SkeletonRows, useWorkspaceData } from "@/components/ui/bits";
import { getPulseSnapshot, PULSE_SCHEMA_VERSION, PULSE_SOURCE } from "@/lib/pulse-adapter";
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
          <h1>Data sources</h1>
          <p className="subtitle">Honest connector status for the Tessiant demo — no fictitious live enterprise sync.</p>
        </div>
      </header>

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
                <td style={{ padding: 8 }}>Tessiant CRM (shared local fixture)</td>
                <td style={{ padding: 8 }}>
                  <span className="chip chip-ai">Connected (DEMO)</span>
                </td>
                <td style={{ padding: 8 }} className="muted">
                  source={PULSE_SOURCE} · schema v{PULSE_SCHEMA_VERSION} · same entity IDs as Staffing · freshness {timeAgo(snapshot.generatedAt)}
                </td>
              </tr>
              <tr>
                <td style={{ padding: 8 }}>Salesforce</td>
                <td style={{ padding: 8 }}>
                  <span className="chip">Not connected</span>
                </td>
                <td style={{ padding: 8 }} className="muted">
                  Out of scope for Demo V1
                </td>
              </tr>
              <tr>
                <td style={{ padding: 8 }}>SharePoint / CV repository</td>
                <td style={{ padding: 8 }}>
                  <span className="chip">Not connected</span>
                </td>
                <td style={{ padding: 8 }} className="muted">
                  No real personal documents processed
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
          <h2>Adapter snapshot</h2>
        </div>
        <div className="card-body">
          <p className="muted">{snapshot.financials.note}</p>
          <ul>
            <li>
              Illustrative network {snapshot.network.totalMembers} · seeded sample {snapshot.network.sampleSize}
            </li>
            <li>
              Open requirements {snapshot.requirements.open} · placed {snapshot.requirements.placed}
            </li>
            <li>
              Capacity signals {snapshot.capacitySignals.length} · recent events {snapshot.recentEvents.length}
            </li>
          </ul>
          <Link href="/staffing" className="text-link">
            Open Tessiant CRM staffing overview
          </Link>
        </div>
      </section>
    </div>
  );
}
