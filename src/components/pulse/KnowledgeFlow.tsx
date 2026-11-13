"use client";

import { useLayoutEffect, useRef, useState } from "react";
import styles from "@/app/(workspace)/pulse/pulse.module.css";

const FLOW_H = 276;
const MIN_W = 680;
const DEFAULT_SOURCES = ["CRM · Network", "Requirements", "Assignments", "Placements"] as const;

type FlowLayout = {
  w: number;
  sources: string[];
  top: number;
  bottom: number;
  ky: number;
  pillW: number;
  blockW: number;
  blockLeft: number;
  circleR: number;
  outW: number;
  outX: number;
  kx: number;
  ax: number;
  lx: number;
};

function sy(layout: FlowLayout, i: number) {
  const n = Math.max(layout.sources.length - 1, 1);
  return layout.top + i * ((layout.bottom - layout.top) / n);
}

function buildLayout(width: number, sources: string[]): FlowLayout {
  const w = Math.max(MIN_W, Math.round(width) || 820);
  const top = 42;
  const bottom = FLOW_H - 18;
  const ky = (top + bottom) / 2;
  const pillW = 146;
  const blockW = 196;
  const circleR = 40;
  const outW = 142;
  const outX = w - 16 - outW;
  const kx = outX - 28 - circleR;
  const blockLeft = Math.round((pillW + 28 + (kx - circleR - 16)) / 2 - blockW / 2);
  return {
    w,
    sources,
    top,
    bottom,
    ky,
    pillW,
    blockW,
    blockLeft,
    circleR,
    outW,
    outX,
    kx,
    ax: blockLeft + blockW / 2,
    lx: outX + outW / 2,
  };
}

function sourcePath(layout: FlowLayout, i: number) {
  const y1 = sy(layout, i);
  const x0 = 8 + layout.pillW;
  const x1 = layout.blockLeft;
  const mid = (x0 + x1) / 2;
  return `M${x0} ${y1} C${mid} ${y1}, ${mid} ${layout.ky}, ${x1} ${layout.ky}`;
}

export default function KnowledgeFlow({
  blockTitle,
  sources = [],
  variant = "default",
  mark = "Q",
  subtitle,
  outcomeLabel = "Tracked",
  outcomeStatus = "Outcomes",
}: {
  blockTitle: string;
  sources?: readonly string[];
  variant?: "default" | "overview";
  /** Two-letter mark on the knowledge block node. */
  mark?: string;
  subtitle?: string;
  outcomeLabel?: string;
  outcomeStatus?: string;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(820);
  const uid = useRef(`bf-${Math.random().toString(36).slice(2, 9)}`).current;

  const visibleSources = (sources.length ? sources : DEFAULT_SOURCES).slice(0, 9);
  const layout = buildLayout(width, [...visibleSources]);
  const meta = subtitle ?? "Worker · grounded intelligence";

  useLayoutEffect(() => {
    if (variant !== "overview") return;
    const host = hostRef.current;
    if (!host) return;
    const measure = () => setWidth(host.clientWidth || 820);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(host);
    return () => ro.disconnect();
  }, [variant]);

  if (variant === "overview") {
    const gradId = `${uid}-grad`;
    const lineId = `${uid}-line`;
    const softId = `${uid}-soft`;
    return (
      <div className={styles.blockFlow} aria-label={`How ${blockTitle} produces intelligence`}>
        <div ref={hostRef} className={styles.blockFlowWrap}>
          <svg
            className={styles.blockFlowSvg}
            viewBox={`0 0 ${layout.w} ${FLOW_H}`}
            role="img"
            aria-label={`How ${blockTitle} works`}
          >
            <defs>
              <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#3B82F6" />
                <stop offset="1" stopColor="#6366F1" />
              </linearGradient>
              <linearGradient id={lineId} x1="0" x2="1">
                <stop offset="0" stopColor="#93C5FD" stopOpacity=".45" />
                <stop offset="0.5" stopColor="#6366F1" stopOpacity=".9" />
                <stop offset="1" stopColor="#3B82F6" stopOpacity=".55" />
              </linearGradient>
              <filter id={softId} x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#6366F1" floodOpacity=".18" />
              </filter>
            </defs>

            {(
              [
                [8 + layout.pillW / 2, "SYSTEMS (POWER)"],
                [layout.ax, "KNOWLEDGE BLOCK"],
                [layout.kx, "INSIGHTS"],
                [layout.lx, "OUTCOMES"],
              ] as const
            ).map(([x, label]) => (
              <text
                key={label}
                x={x}
                y={18}
                fill="#64748B"
                fontSize={9.5}
                textAnchor="middle"
                letterSpacing="1.2"
                className={styles.blockFlowLabel}
              >
                {label}
              </text>
            ))}

            {layout.sources.map((_, i) => {
              const d = sourcePath(layout, i);
              return (
                <g key={`line-${i}`}>
                  <path d={d} fill="none" stroke="#E2E8F0" strokeWidth={1.4} />
                  <path
                    d={d}
                    fill="none"
                    stroke={`url(#${lineId})`}
                    className={`${styles.pulseFlowline} ${styles.pulseFlowlineFast}`}
                  />
                </g>
              );
            })}

            {layout.sources.map((name, i) => (
              <g key={name}>
                <rect
                  x={8}
                  y={sy(layout, i) - 11}
                  width={layout.pillW}
                  height={22}
                  rx={11}
                  fill="#fff"
                  stroke="#CBD5E1"
                  strokeWidth={1.2}
                />
                <text x={8 + layout.pillW / 2} y={sy(layout, i) + 4} fill="#334155" fontSize={11} textAnchor="middle">
                  {name.length > 22 ? `${name.slice(0, 20)}…` : name}
                </text>
              </g>
            ))}

            <rect
              x={layout.blockLeft}
              y={layout.ky - 30}
              width={layout.blockW}
              height={60}
              rx={14}
              fill="#EEF2FF"
              stroke="#6366F1"
              strokeWidth={1.75}
              filter={`url(#${softId})`}
            />
            <circle cx={layout.blockLeft + layout.blockW - 16} cy={layout.ky - 16} r={3.5} fill="#22C55E" />
            <rect x={layout.blockLeft + 12} y={layout.ky - 14} width={28} height={28} rx={8} fill="#E0E7FF" />
            <text
              x={layout.blockLeft + 26}
              y={layout.ky + 4}
              fill="#4F46E5"
              fontSize={10}
              fontWeight={800}
              textAnchor="middle"
            >
              {mark.slice(0, 2).toUpperCase()}
            </text>
            <text x={layout.blockLeft + 48} y={layout.ky - 2} fill="#0F172A" fontSize={12} fontWeight={700}>
              {blockTitle.length > 22 ? `${blockTitle.slice(0, 20)}…` : blockTitle}
            </text>
            <text x={layout.blockLeft + 48} y={layout.ky + 14} fill="#64748B" fontSize={10}>
              {meta.length > 28 ? `${meta.slice(0, 26)}…` : meta}
            </text>

            <circle cx={layout.kx} cy={layout.ky} r={layout.circleR + 8} fill="rgba(59,130,246,.08)" />
            <circle
              cx={layout.kx}
              cy={layout.ky}
              r={layout.circleR}
              fill="#fff"
              stroke={`url(#${gradId})`}
              strokeWidth={2.25}
              filter={`url(#${softId})`}
            />
            <text x={layout.kx} y={layout.ky - 4} fill="#0F172A" fontSize={12} fontWeight={800} textAnchor="middle">
              Surfaces
            </text>
            <text x={layout.kx} y={layout.ky + 12} fill="#3B82F6" fontSize={11} fontWeight={700} textAnchor="middle">
              insights
            </text>

            <rect
              x={layout.outX}
              y={layout.ky - 26}
              width={layout.outW}
              height={52}
              rx={12}
              fill="#fff"
              stroke="#E2E8F0"
              strokeWidth={1.25}
              filter={`url(#${softId})`}
            />
            <text x={layout.lx} y={layout.ky - 2} fill="#0F172A" fontSize={13} fontWeight={700} textAnchor="middle">
              {outcomeLabel}
            </text>
            <text x={layout.lx} y={layout.ky + 14} fill="#B45309" fontSize={11} fontWeight={600} textAnchor="middle">
              {outcomeStatus}
            </text>

            <path
              d={`M${layout.blockLeft + layout.blockW} ${layout.ky} L${layout.kx - layout.circleR - 2} ${layout.ky}`}
              fill="none"
              stroke="#DBEAFE"
              strokeWidth={1.4}
            />
            <path
              d={`M${layout.blockLeft + layout.blockW} ${layout.ky} L${layout.kx - layout.circleR - 2} ${layout.ky}`}
              fill="none"
              stroke="#6366F1"
              strokeWidth={1.6}
              strokeLinecap="round"
              className={`${styles.pulseFlowline} ${styles.pulseFlowlineFast}`}
            />
            <path
              d={`M${layout.kx + layout.circleR + 2} ${layout.ky} L${layout.outX} ${layout.ky}`}
              fill="none"
              stroke="#DBEAFE"
              strokeWidth={1.4}
            />
            <path
              d={`M${layout.kx + layout.circleR + 2} ${layout.ky} L${layout.outX} ${layout.ky}`}
              fill="none"
              stroke="#6366F1"
              strokeWidth={1.6}
              strokeLinecap="round"
              className={`${styles.pulseFlowline} ${styles.pulseFlowlineFast}`}
            />
          </svg>
        </div>
        <p className={styles.blockFlowNote}>
          Systems on the left power knowledge. Connection status comes from the Tessiant CRM demo. Outcomes land when a
          person acts.
        </p>
      </div>
    );
  }

  const STEPS = [
    {
      label: "Sources",
      title: "CRM · Network · Requirements · Assignments",
      detail: "Salesforce-style Tessiant records and staffing activity",
    },
    {
      label: "Knowledge block",
      title: "Tessiant knowledge module",
      detail: "Business question this block is configured to answer",
    },
    {
      label: "Intelligence",
      title: "Rules & processing",
      detail: "Deterministic signals over verified capacity and demand",
    },
    {
      label: "Insights",
      title: "Recommendations",
      detail: "Reviewable findings with evidence and suggested next steps",
    },
    {
      label: "Actions",
      title: "Approved to-dos",
      detail: "Accepted insights become tracked operational work",
    },
    {
      label: "Value",
      title: "Recorded outcomes",
      detail: "Pipeline, agreed, realised and savings kept separate",
    },
  ] as const;

  return (
    <div className={styles.flowDiagram} aria-label="How this knowledge block produces intelligence">
      <div className={styles.flowRow}>
        {STEPS.slice(0, 3).map((step, index) => (
          <div key={step.label} className={`${styles.flowNode} ${index === 1 ? styles.flowNodePrimary : ""}`}>
            <label>{step.label}</label>
            <b>{index === 1 ? blockTitle : step.title}</b>
            <small>{step.detail}</small>
          </div>
        ))}
      </div>
      <div className={styles.flowArrow} aria-hidden>
        ↓
      </div>
      <div className={styles.flowRow}>
        {STEPS.slice(3).map((step) => (
          <div key={step.label} className={styles.flowNode}>
            <label>{step.label}</label>
            <b>{step.title}</b>
            <small>{step.detail}</small>
          </div>
        ))}
      </div>
    </div>
  );
}
