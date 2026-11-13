"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { MapEdge, MapNode, RelationshipMapData } from "@/lib/relationship-map";
import { avatarStyle, initials } from "@/lib/format";
import Icon, { type IconName } from "@/components/ui/Icon";
import styles from "./RelationshipMap.module.css";

/**
 * Interactive relationship map for one account, drawn in the same language as the Pulse knowledge
 * map: a breathing core, curved links with pulses travelling along them, nodes that arrive in
 * sequence and glow on hover. The account sits in the middle; Tessiant's team, client stakeholders,
 * delivery associates, introducers and deals sit on a ring grouped by sector. Hover highlights a
 * node and its links; click pins it and explains the connection in the rail.
 */

const W = 680;
const H = 420;
const CX = W / 2;
const CY = H / 2 + 6;
const RING = 150;
const NODE_R = 19;
const KIND_ICON: Record<MapNode["kind"], IconName> = {
  account: "building",
  owner: "userCheck",
  contact: "users",
  associate: "briefcase",
  sia: "star",
  deal: "target",
  requirement: "layers",
};

const GROUP_ORDER: MapNode["group"][] = ["team", "introducers", "stakeholders", "delivery", "deals"];
const GROUP_LABEL: Record<MapNode["group"], string> = {
  team: "Tessiant",
  introducers: "Introducers",
  stakeholders: "Client stakeholders",
  delivery: "Delivery",
  deals: "Deals & requirements",
};

interface Placed extends MapNode {
  x: number;
  y: number;
  angle: number;
}

function layout(nodes: MapNode[]): Placed[] {
  const centre = nodes.find((node) => node.kind === "account");
  const ring = nodes.filter((node) => node.kind !== "account");
  const ordered = GROUP_ORDER.flatMap((group) => ring.filter((node) => node.group === group));
  const n = ordered.length || 1;
  const placed: Placed[] = ordered.map((node, index) => {
    const angle = -Math.PI / 2 + (index / n) * Math.PI * 2;
    const radius = n > 10 && index % 2 === 1 ? RING + 34 : RING;
    return { ...node, x: CX + Math.cos(angle) * radius, y: CY + Math.sin(angle) * radius, angle };
  });
  if (centre) placed.unshift({ ...centre, x: CX, y: CY, angle: 0 });
  return placed;
}

/** A gently curved link from a to b, bowing slightly clockwise so parallel links never overlap. */
function curve(a: Placed, b: Placed): string {
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const bend = Math.min(26, len * 0.14);
  const cx = mx - (dy / len) * bend;
  const cy = my + (dx / len) * bend;
  return `M${a.x.toFixed(1)} ${a.y.toFixed(1)} Q${cx.toFixed(1)} ${cy.toFixed(1)} ${b.x.toFixed(1)} ${b.y.toFixed(1)}`;
}

function truncate(label: string, max = 24): string {
  return label.length > max ? `${label.slice(0, max - 1)}…` : label;
}

export default function RelationshipMap({ data }: { data: RelationshipMapData }) {
  const placed = useMemo(() => layout(data.nodes), [data.nodes]);
  const byId = useMemo(() => new Map(placed.map((node) => [node.id, node])), [placed]);
  const [hover, setHover] = useState<string | null>(null);
  const [pinned, setPinned] = useState<string | null>(null);
  const [motion, setMotion] = useState(true);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) setMotion(false);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const active = hover ?? pinned;
  const activeNode = active ? byId.get(active) ?? null : null;
  const connected = useMemo(() => {
    if (!active) return null;
    const set = new Set<string>([active]);
    for (const edge of data.edges) {
      if (edge.from === active) set.add(edge.to);
      if (edge.to === active) set.add(edge.from);
    }
    return set;
  }, [active, data.edges]);
  const activeEdges = active ? data.edges.filter((edge) => edge.from === active || edge.to === active) : [];

  const describeEdge = (edge: MapEdge) => {
    const other = byId.get(edge.from === active ? edge.to : edge.from);
    return other ? `${edge.label} · ${other.label}` : edge.label;
  };

  const centre = placed.find((node) => node.kind === "account");

  return (
    <div className={styles.wrap} data-motion={motion ? "on" : "off"}>
      <svg viewBox={`0 0 ${W} ${H}`} className={styles.svg} role="img" aria-label="Relationship map">
        <defs>
          <pattern id="rm-dots" width="18" height="18" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="1" className={styles.dot} />
          </pattern>
          <radialGradient id="rm-tint" cx="50%" cy="50%" r="55%">
            <stop offset="0%" stopColor="var(--brand)" stopOpacity="0.1" />
            <stop offset="100%" stopColor="var(--brand)" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="rm-core" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--brand)" />
            <stop offset="100%" stopColor="var(--brand-strong, #115e59)" />
          </linearGradient>
          <filter id="rm-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <marker id="rm-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M0 0 L10 5 L0 10z" fill="currentColor" />
          </marker>
        </defs>

        <rect width={W} height={H} rx="14" fill="url(#rm-dots)" />
        <rect width={W} height={H} rx="14" fill="url(#rm-tint)" />

        {/* Sector labels sit beyond the ring, at each group's angular centre. */}
        {GROUP_ORDER.map((group) => {
          const members = placed.filter((node) => node.group === group && node.kind !== "account");
          if (members.length === 0) return null;
          const angle = members.reduce((sum, node) => sum + node.angle, 0) / members.length;
          const lx = Math.min(Math.max(CX + Math.cos(angle) * (RING + 96), 70), W - 70);
          const ly = Math.min(Math.max(CY + Math.sin(angle) * (RING + 86), 16), H - 8);
          return (
            <text key={group} x={lx} y={ly} className={styles.sector} textAnchor="middle">
              {GROUP_LABEL[group]}
            </text>
          );
        })}

        {/* Links: a soft curved base, and pulses travelling along live ones. */}
        {data.edges.map((edge, index) => {
          const a = byId.get(edge.from);
          const b = byId.get(edge.to);
          if (!a || !b) return null;
          const dim = connected ? !(edge.from === active || edge.to === active) : false;
          const lit = Boolean(active) && !dim;
          const pathId = `rm-edge-${edge.id.replace(/[^a-z0-9_-]/gi, "")}`;
          const d = curve(a, b);
          return (
            <g key={edge.id} className={styles.edgeGroup} data-kind={edge.kind} data-live={edge.live ? "true" : "false"} data-dim={dim ? "true" : undefined} data-lit={lit ? "true" : undefined}>
              <path id={pathId} d={d} className={styles.edge} markerEnd={edge.kind === "introduced" ? "url(#rm-arrow)" : undefined} />
              {motion && edge.live && !dim ? (
                <>
                  <circle r="2.6" className={styles.pulse}>
                    <animateMotion dur={`${3.2 + (index % 4) * 0.5}s`} begin={`${(index % 5) * 0.55}s`} repeatCount="indefinite" rotate="auto">
                      <mpath href={`#${pathId}`} />
                    </animateMotion>
                  </circle>
                  {edge.kind === "introduced" || edge.kind === "placed" ? (
                    <circle r="1.8" className={styles.pulse}>
                      <animateMotion dur={`${3.2 + (index % 4) * 0.5}s`} begin={`${(index % 5) * 0.55 + 1.6}s`} repeatCount="indefinite" rotate="auto">
                        <mpath href={`#${pathId}`} />
                      </animateMotion>
                    </circle>
                  ) : null}
                </>
              ) : null}
            </g>
          );
        })}

        {/* The account core: breathing rings behind a gradient disc. */}
        {centre ? (
          <g transform={`translate(${centre.x} ${centre.y})`} className={styles.coreGroup}>
            <circle r="30" className={styles.beat} />
            <circle r="30" className={`${styles.beat} ${styles.beatLate}`} />
          </g>
        ) : null}

        {/* Nodes arrive in sequence around the ring. */}
        {placed.map((node, index) => {
          const isCentre = node.kind === "account";
          const r = isCentre ? 30 : NODE_R;
          const dim = connected ? !connected.has(node.id) : false;
          const colours = avatarStyle(node.label);
          const iconOnly = node.kind === "deal" || node.kind === "requirement";
          return (
            <g
              key={node.id}
              transform={`translate(${node.x} ${node.y})`}
              className={styles.node}
              style={{ animationDelay: `${isCentre ? 0 : 120 + index * 55}ms` }}
              data-kind={node.kind}
              data-live={node.live ? "true" : "false"}
              data-dim={dim ? "true" : undefined}
              data-active={active === node.id ? "true" : undefined}
              onMouseEnter={() => setHover(node.id)}
              onMouseLeave={() => setHover(null)}
              onClick={() => setPinned((current) => (current === node.id ? null : node.id))}
              role="button"
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  setPinned((current) => (current === node.id ? null : node.id));
                }
              }}
              aria-label={`${node.label}, ${node.sub}`}
            >
              <g className={styles.nodeScale}>
                <circle r={r + 5} className={styles.halo} />
                <circle r={r} className={styles.disc} style={isCentre ? { fill: "url(#rm-core)" } : { fill: colours.background }} />
                {isCentre ? (
                  <text y={1} className={styles.centreText} textAnchor="middle" dominantBaseline="middle">
                    {initials(node.label)}
                  </text>
                ) : iconOnly ? (
                  <foreignObject x={-9} y={-9} width={18} height={18} className={styles.nodeIcon}>
                    <span style={{ color: colours.color }}>
                      <Icon name={KIND_ICON[node.kind]} size={16} strokeWidth={2.2} />
                    </span>
                  </foreignObject>
                ) : (
                  <text y={1} className={styles.nodeText} textAnchor="middle" dominantBaseline="middle" style={{ fill: colours.color }}>
                    {initials(node.label)}
                  </text>
                )}
              </g>
              <text y={r + 14} className={styles.label} textAnchor="middle">
                {truncate(node.label, isCentre ? 26 : 22)}
              </text>
              {node.kind === "sia" ? (
                <text y={r + 26} className={styles.labelSub} textAnchor="middle">
                  SIA
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>

      <aside className={styles.rail} aria-live="polite">
        {activeNode ? (
          <div className={styles.detail} key={activeNode.id}>
            <div className={styles.detailHead}>
              <span className="avatar avatar-sm" style={avatarStyle(activeNode.label)}>
                {activeNode.kind === "deal" || activeNode.kind === "requirement" ? <Icon name={KIND_ICON[activeNode.kind]} size={14} /> : initials(activeNode.label)}
              </span>
              <div>
                <b>{activeNode.label}</b>
                <small>{activeNode.sub}</small>
              </div>
            </div>
            {activeNode.why ? <p className={styles.why}>{activeNode.why}</p> : <p className={styles.why}>The account at the centre. Hover any node to see how it connects.</p>}
            {activeEdges.length > 0 ? (
              <ul className={styles.edgeList}>
                {activeEdges.map((edge) => (
                  <li key={edge.id} data-kind={edge.kind}>
                    <i />
                    {describeEdge(edge)}
                  </li>
                ))}
              </ul>
            ) : null}
            {activeNode.href ? (
              <Link href={activeNode.href} className="link-button">
                Open record <Icon name="arrowRight" size={12} />
              </Link>
            ) : null}
            {pinned === activeNode.id ? (
              <button type="button" className={styles.unpin} onClick={() => setPinned(null)}>
                Unpin
              </button>
            ) : null}
          </div>
        ) : (
          <div className={styles.summary}>
            <p className={styles.summaryLede}>
              <Icon name="sparkles" size={13} /> Hover or click a node to see how it ties to the account.
            </p>
            <dl className={styles.counts}>
              <div>
                <dt>Stakeholders</dt>
                <dd className="tabular">{data.counts.contact}</dd>
              </div>
              <div>
                <dt>Associates</dt>
                <dd className="tabular">{data.counts.associate}</dd>
              </div>
              <div>
                <dt>SIAs</dt>
                <dd className="tabular">{data.counts.sia}</dd>
              </div>
              <div>
                <dt>Deals</dt>
                <dd className="tabular">{data.counts.deal}</dd>
              </div>
            </dl>
            {data.introductions.length > 0 ? (
              <div className={styles.intro}>
                <span className="kicker kicker-qiko">Introduction paths</span>
                {data.introductions.map((item) => (
                  <p key={`${item.introducerId}-${item.leadName}`}>
                    <b>{item.introducerName}</b> → {item.leadName} → <span>{item.outcome}</span>
                  </p>
                ))}
              </div>
            ) : (
              <p className={styles.noIntro}>No recorded introduction path. If an associate or SIA opened this door, note it on the lead.</p>
            )}
          </div>
        )}
        <ul className={styles.legend}>
          <li data-kind="placed">deployed</li>
          <li data-kind="introduced">introduced</li>
          <li data-kind="deal">deal</li>
          <li data-kind="delivered">past</li>
        </ul>
      </aside>
    </div>
  );
}
