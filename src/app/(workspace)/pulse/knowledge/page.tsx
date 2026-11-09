"use client";

import Link from "next/link";
import { TESSIANT_KNOWLEDGE_BLOCKS } from "@/lib/tessiant-knowledge";
import styles from "../pulse.module.css";

export default function PulseKnowledgePage() {
  return (
    <div className="page">
      <header className="page-head">
        <div>
          <div className={styles.context}>
            <span className="chip chip-ai">Qiko Pulse</span>
            <span className="chip">Tessiant configuration</span>
          </div>
          <h1>Knowledge blocks</h1>
          <p className="subtitle">Customer-specific configurations on reusable Pulse containers — not four new platform subsystems.</p>
        </div>
      </header>

      <section className={styles.three}>
        {TESSIANT_KNOWLEDGE_BLOCKS.map((block) => (
          <Link key={block.id} href={`/pulse/knowledge/${block.id}`} className="card" style={{ color: "inherit" }}>
            <div className="card-body">
              <div className={styles.insightHead}>
                <span className="chip">{block.priority}</span>
                <span className="chip">{block.id}</span>
              </div>
              <h2 style={{ marginTop: 10, fontSize: 18 }}>{block.title}</h2>
              <p className="muted">{block.purpose}</p>
              <p className="muted" style={{ marginTop: 8 }}>
                Owner: {block.owner}
              </p>
            </div>
          </Link>
        ))}
      </section>
    </div>
  );
}
