"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo } from "react";
import { EmptyState, SkeletonRows, useNow, useWorkspaceData } from "@/components/ui/bits";
import InsightCard from "@/components/pulse/InsightCard";
import { getKnowledgeBlock } from "@/lib/tessiant-knowledge";
import { generateTessiantInsights } from "@/lib/tessiant-pulse-rules";
import styles from "../../pulse.module.css";

export default function PulseKnowledgeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { state } = useWorkspaceData();
  const now = useNow();
  const block = getKnowledgeBlock(id);
  const insights = useMemo(() => {
    if (!state || !block) return [];
    return generateTessiantInsights(state, now || Date.now()).filter((item) => item.knowledgeBlockId === block.id);
  }, [state, now, block]);

  if (!state) {
    return (
      <div className="page">
        <SkeletonRows rows={4} height={80} />
      </div>
    );
  }

  if (!block) {
    return (
      <div className="page">
        <EmptyState title="Unknown knowledge block">
          <Link href="/pulse/knowledge">Back</Link>
        </EmptyState>
      </div>
    );
  }

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <p className="kicker">
            <Link href="/pulse/knowledge">Knowledge</Link>
          </p>
          <h1>{block.title}</h1>
          <p className="subtitle">{block.purpose}</p>
        </div>
      </header>

      <section className={styles.split}>
        <article className="card">
          <div className="card-head">
            <h2>Block definition</h2>
          </div>
          <div className="card-body">
            <p>
              <b>Owner:</b> {block.owner}
            </p>
            <p>
              <b>Priority:</b> {block.priority}
            </p>
            <p>
              <b>Updated:</b> {block.updatedAt}
            </p>
            <h3 style={{ fontSize: 14, marginTop: 12 }}>Data sources</h3>
            <ul>
              {block.dataSources.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <h3 style={{ fontSize: 14, marginTop: 12 }}>Required fields</h3>
            <ul>
              {block.requiredFields.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <h3 style={{ fontSize: 14, marginTop: 12 }}>Business rules</h3>
            <ul>
              {block.businessRules.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <h3 style={{ fontSize: 14, marginTop: 12 }}>Signal definitions</h3>
            <div className={styles.actions}>
              {block.signalDefinitions.map((item) => (
                <span key={item} className="chip">
                  {item}
                </span>
              ))}
            </div>
            <h3 style={{ fontSize: 14, marginTop: 12 }}>Example actions</h3>
            <ul>
              {block.actions.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <h3 style={{ fontSize: 14, marginTop: 12 }}>Outcome measures</h3>
            <ul>
              {block.outcomeMeasures.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </article>

        <article className="card">
          <div className="card-head">
            <div>
              <h2>Live signals</h2>
              <p className="card-sub">Computed from shared Tessiant CRM records — click evidence links for source rows.</p>
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
        </article>
      </section>
    </div>
  );
}
