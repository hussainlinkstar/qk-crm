"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import Button from "@/components/ui/Button";
import { useWorkspace } from "@/components/shell/WorkspaceContext";
import { crm } from "@/lib/crm-store";
import type { NetworkBubbleTone, NetworkKnowledgeBubble } from "@/lib/network-intelligence";
import type { TessiantInsight } from "@/lib/tessiant-pulse-types";
import styles from "@/app/(workspace)/pulse/pulse.module.css";

const BUBBLE_TONE: Record<
  NetworkBubbleTone,
  { border: string; bg: string; text: string; fill: string; dashed?: boolean }
> = {
  growing: { border: "#34d399", bg: "#ecfdf5", text: "#065f46", fill: "#10b981" },
  established: { border: "#60a5fa", bg: "#eff6ff", text: "#1e40af", fill: "#3b82f6" },
  attention: { border: "#fbbf24", bg: "#fffbeb", text: "#92400e", fill: "#f59e0b" },
  gap: { border: "#f87171", bg: "#fff", text: "#dc2626", fill: "#f87171", dashed: true },
};

/** Fit circle title/sub so full names stay readable without "Program..." ellipsis. */
function bubbleTextSizes(size: number, title: string, sub: string) {
  const usable = Math.max(36, size * 0.68);
  const longestWord = Math.max(...title.split(/\s+/).map((part) => part.length), 1);
  let titleSize = Math.min(13, Math.max(9, Math.round(size * 0.145)));
  while (titleSize > 8 && longestWord * titleSize * 0.62 > usable) {
    titleSize -= 1;
  }
  if (title.length > 10) titleSize = Math.min(titleSize, 10);
  const subSize = Math.max(8, Math.min(10, Math.round(Math.min(titleSize * 0.88, size * 0.11))));
  if (sub.length > 14) {
    return { titleSize, subSize: Math.min(subSize, 8) };
  }
  return { titleSize, subSize };
}

export default function BlockKnowledgeMap({
  blockTitle,
  bubbles,
  insights = [],
}: {
  blockTitle: string;
  bubbles: NetworkKnowledgeBubble[];
  insights?: TessiantInsight[];
}) {
  const router = useRouter();
  const { openTask, toast } = useWorkspace();
  const [selectedId, setSelectedId] = useState(bubbles[0]?.id ?? "");
  const selected = useMemo(
    () => bubbles.find((item) => item.id === selectedId) ?? bubbles[0] ?? null,
    [bubbles, selectedId],
  );
  const linkedInsight = useMemo(() => {
    if (!selected?.insightId) return null;
    return insights.find((item) => item.id === selected.insightId) ?? null;
  }, [insights, selected]);

  if (!selected) return null;

  const tone = BUBBLE_TONE[selected.tone];
  const alreadyAccepted = linkedInsight?.reviewStatus === "accepted" || Boolean(linkedInsight?.taskId);

  const acceptInsight = () => {
    if (!linkedInsight) {
      toast("Open Insights to accept a related recommendation");
      return;
    }
    if (alreadyAccepted) {
      if (linkedInsight.taskId) openTask(linkedInsight.taskId);
      toast(linkedInsight.taskId ? "Already accepted — linked to-do is ready" : "Already accepted");
      return;
    }
    const taskId = crm.acceptPulseInsight(linkedInsight);
    toast("Insight accepted — to-do added to My Tasks");
    if (taskId) openTask(taskId);
  };

  const openTodo = () => {
    if (linkedInsight?.taskId) {
      openTask(linkedInsight.taskId);
      return;
    }
    router.push("/tasks");
  };

  return (
    <div className={styles.analyticsKnow}>
      <div>
        <p className={styles.analyticsKicker}>Knowledge block · {blockTitle} · Analytics</p>
        <h2 className={styles.analyticsTitle}>What {blockTitle.replace(/ Intelligence$/i, "")} knows</h2>
        <p className={styles.analyticsLead}>
          Every bubble is something the block has learned from Tessiant CRM. Size shows relative weight. Click one to see the evidence.
        </p>
      </div>

      <div className={styles.analyticsMapGrid}>
        <section className={styles.analyticsMapCard} aria-label="Knowledge map">
          <div className={styles.analyticsMapHead}>
            <div>
              <h3>Knowledge map</h3>
              <p>
                {blockTitle} · {bubbles.length} patterns · click a bubble
              </p>
            </div>
          </div>
          <div className={styles.analyticsMapStage}>
            {bubbles.map((bubble) => {
              const t = BUBBLE_TONE[bubble.tone];
              const on = selected.id === bubble.id;
              const title = bubble.mapLabel || bubble.label;
              const sub = bubble.mapSub || bubble.sub;
              const { titleSize, subSize } = bubbleTextSizes(bubble.size, title, sub);
              return (
                <button
                  key={bubble.id}
                  type="button"
                  className={styles.analyticsBubble}
                  data-active={on}
                  title={bubble.label}
                  aria-label={`${bubble.label}. ${sub}`}
                  style={{
                    left: `${bubble.x}%`,
                    top: `${bubble.y}%`,
                    width: bubble.size,
                    height: bubble.size,
                    marginLeft: -bubble.size / 2,
                    marginTop: -bubble.size / 2,
                    borderStyle: t.dashed ? "dashed" : "solid",
                    borderColor: t.border,
                    background: t.bg,
                    color: t.text,
                  }}
                  onClick={() => setSelectedId(bubble.id)}
                >
                  <span className={styles.analyticsBubbleInner}>
                    <b style={{ fontSize: titleSize }}>{title}</b>
                    <span style={{ fontSize: subSize }}>{sub}</span>
                  </span>
                </button>
              );
            })}
          </div>
          <div className={styles.analyticsMapLegend}>
            <span>
              <i className={styles.legendGrowing} />
              Growing
            </span>
            <span>
              <i className={styles.legendEstablished} />
              Established
            </span>
            <span>
              <i className={styles.legendAttention} />
              Needs attention
            </span>
            <span>
              <i className={styles.legendGap} />
              Gap (not covered yet)
            </span>
          </div>
        </section>

        <aside className={styles.analyticsDetail} aria-label={`${selected.label} detail`}>
          <div className={styles.analyticsDetailBar} style={{ background: tone.fill }} />
          <div className={styles.analyticsDetailBody}>
            <p className={styles.analyticsKicker}>Selected</p>
            <h3>{selected.label}</h3>
            <div className={styles.analyticsChips}>
              <span className={styles.analyticsChip} data-tone={selected.tone === "attention" || selected.tone === "gap" ? "warn" : "good"}>
                {selected.strength}
              </span>
              {selected.agent ? <span className={styles.analyticsChip} data-tone="blue">{selected.agent}</span> : null}
            </div>
            <p className={styles.analyticsSummary}>{selected.summary}</p>
            <div className={styles.analyticsStats}>
              {selected.stats.map(([value, label]) => (
                <div key={`${selected.id}-${label}`}>
                  <b>{value}</b>
                  <span>{label}</span>
                </div>
              ))}
            </div>
            <p className={styles.analyticsSource}>{selected.source}</p>
            {selected.href ? (
              <p className={styles.analyticsSource}>
                <Link href={selected.href}>Open related CRM records</Link>
              </p>
            ) : null}
            <div className={styles.analyticsActions}>
              <Button variant="primary" onClick={acceptInsight}>
                {alreadyAccepted ? "Open linked to-do" : "Accept into Insight Tracker"}
              </Button>
              <Button variant="secondary" onClick={openTodo}>
                Open To-Do
              </Button>
            </div>
            <p className={styles.analyticsFootnote}>
              Surfacing only · Accept into Insight Tracker or open To-Do · no automatic rule write
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
