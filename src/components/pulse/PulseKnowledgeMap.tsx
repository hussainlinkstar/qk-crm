"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import styles from "@/app/(workspace)/pulse/pulse.module.css";

type Pt = { x: number; y: number };

type Area = {
  id: string;
  name: string;
  ang: number;
  col: string;
  agents: number;
  href: string;
  sub: string;
};

type Sys = { name: string; to: string[] };

type Node = Area & { x: number; y: number; r: number; c: string; phase: number; flash: number; a: Area };

type BlockId = "network" | "augmentation" | "commercial" | "capability";

export default function PulseKnowledgeMap({
  networkSub = "verified capacity",
  placementSub = "open requirements",
  subs,
}: {
  networkSub?: string;
  placementSub?: string;
  /** Live line per block; falls back to the two legacy props. */
  subs?: Partial<Record<BlockId, string>>;
}) {
  const subKey = JSON.stringify(subs ?? {});
  const router = useRouter();
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    const tip = tipRef.current;
    if (!canvas || !wrap || !tip) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const liveSubs: Record<BlockId, string> = {
      network: subs?.network ?? networkSub,
      augmentation: subs?.augmentation ?? placementSub,
      commercial: subs?.commercial ?? "accounts and deals",
      capability: subs?.capability ?? "bench and offerings",
    };
    const ROLE: Record<BlockId, string> = {
      network: "Network intelligence",
      augmentation: "Placement intelligence",
      commercial: "Commercial & relationship intelligence",
      capability: "Strategic capability intelligence",
    };
    // Four blocks around the core, one per quadrant.
    const AREAS: Area[] = [
      { id: "network", name: "Network Intelligence", ang: -2.35, col: "#6366F1", agents: 1, href: "/pulse/knowledge/network", sub: liveSubs.network },
      { id: "commercial", name: "Commercial & Relationship Intelligence", ang: -0.8, col: "#8B5CF6", agents: 1, href: "/pulse/knowledge/commercial", sub: liveSubs.commercial },
      { id: "augmentation", name: "Augmentation & Placement Intelligence", ang: 0.8, col: "#22D3EE", agents: 1, href: "/pulse/knowledge/augmentation", sub: liveSubs.augmentation },
      { id: "capability", name: "Strategic Capability Intelligence", ang: 2.35, col: "#10B981", agents: 1, href: "/pulse/knowledge/capability", sub: liveSubs.capability },
    ];
    const SYS: Sys[] = [
      { name: "Associates", to: ["network", "capability"] },
      { name: "Requirements", to: ["augmentation", "capability"] },
      { name: "Accounts & deals", to: ["commercial", "augmentation"] },
      { name: "Ask Pulse", to: ["network", "commercial"] },
    ];

    const hexA = (hex: string, a: number) => {
      const n = parseInt(hex.slice(1), 16);
      return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
    };
    const ctrl = (a: Pt, b: Pt, bend: number): Pt => ({
      x: (a.x + b.x) / 2 - (b.y - a.y) * bend,
      y: (a.y + b.y) / 2 + (b.x - a.x) * bend,
    });
    const qp = (a: Pt, c: Pt, b: Pt, t: number): Pt => {
      const u = 1 - t;
      return { x: u * u * a.x + 2 * u * t * c.x + t * t * b.x, y: u * u * a.y + 2 * u * t * c.y + t * t * b.y };
    };
    const roundRect = (x: number, y: number, w: number, h: number, r: number) => {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
    };
    const wrapLines = (text: string, maxW: number) => {
      const words = text.split(/\s+/);
      const lines: string[] = [];
      let cur = "";
      for (const word of words) {
        const next = cur ? `${cur} ${word}` : word;
        if (ctx.measureText(next).width > maxW && cur) {
          lines.push(cur);
          cur = word;
        } else cur = next;
      }
      if (cur) lines.push(cur);
      return lines.length ? lines : [text];
    };

    let W = 0;
    let H = 0;
    let dpr = 1;
    let nodes: Node[] = [];
    let sysNodes: { s: Sys; x: number; y: number }[] = [];
    const parts: { from: Pt; to: Node; c: Pt; t: number; sp: number; kind: "in" | "up"; col: string }[] = [];
    let core = { x: 0, y: 0 };
    let hoverNode: Node | null = null;
    let lastSpawn = 0;
    let raf = 0;
    let zoom: { n: Node; t0: number; done: boolean } | null = null;
    let destroyed = false;

    const layout = () => {
      const box = wrap.getBoundingClientRect();
      W = box.width;
      H = Math.max(420, box.height);
      dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      canvas.style.width = `${W}px`;
      canvas.style.height = `${H}px`;
      const cx = W / 2;
      const cy = H / 2 + 12;
      const rx = Math.min(W * 0.34, 460);
      const ry = Math.min(H * 0.32, 250);
      const base = Math.min(W, H);
      nodes = AREAS.map((a) => ({
        ...a,
        a,
        x: cx + Math.cos(a.ang) * rx,
        y: cy + Math.sin(a.ang) * ry,
        r: Math.max(64, Math.min(92, base * 0.12)),
        c: a.col,
        phase: Math.random() * 6,
        flash: 0,
      }));
      const sx = Math.min(W * 0.44, 580);
      const sy = Math.min(H * 0.4, 290);
      sysNodes = SYS.map((s, i) => {
        const t = -Math.PI / 2 + ((i + 0.5) / SYS.length) * Math.PI * 2;
        return { s, x: cx + Math.cos(t) * sx, y: cy + Math.sin(t) * sy };
      });
      core = { x: cx, y: cy };
    };

    const spawn = () => {
      const s = sysNodes[Math.floor(Math.random() * sysNodes.length)];
      if (!s) return;
      const id = s.s.to[Math.floor(Math.random() * s.s.to.length)];
      const n = nodes.find((x) => x.a.id === id);
      if (!n) return;
      parts.push({ from: s, to: n, c: ctrl(s, n, 0.18), t: 0, sp: 0.005 + Math.random() * 0.006, kind: "in", col: n.c });
    };
    const spawnUp = (n: Node) => {
      parts.push({ from: n, to: n, c: ctrl(n, core, -0.12), t: 0, sp: 0.011, kind: "up", col: n.c });
    };

    const tipPlace = (x: number, aboveAnchorY: number) => {
      const tipH = 118;
      const tipW = 230;
      return {
        x: Math.min(Math.max(x, tipW / 2 + 8), Math.max(tipW / 2 + 8, W - tipW / 2 - 8)),
        above: aboveAnchorY >= tipH + 12,
      };
    };
    const showTip = (name: string, lines: [string, string][], cta: string, x: number, y: number, above: boolean) => {
      tip.hidden = false;
      tip.className = `${styles.mapTipExact}${above ? ` ${styles.mapTipAboveExact}` : ""}`;
      tip.style.left = `${x}px`;
      tip.style.top = `${y}px`;
      tip.innerHTML = `<p style="margin:0;font-size:14px;font-weight:600">${name}</p>${lines
        .map(
          ([l, v]) =>
            `<p style="margin:.25rem 0 0;display:flex;justify-content:space-between;gap:.75rem;font-size:12.5px;color:#64748b"><span>${l}</span><span style="font-weight:600;color:#0f172a">${v}</span></p>`,
        )
        .join("")}<p style="margin:.5rem 0 0;font-size:12px;font-weight:600;color:#4f46e5">${cta}</p>`;
    };

    const hit = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      const x = e.clientX - r.left;
      const y = e.clientY - r.top;
      if (Math.hypot(x - core.x, y - core.y) < 28) return { kind: "core" as const };
      for (const n of nodes) if (Math.hypot(x - n.x, y - n.y) < n.r + 12) return { kind: "area" as const, n };
      return null;
    };

    const onMove = (e: PointerEvent) => {
      const f = hit(e);
      if (f?.kind === "area") {
        hoverNode = f.n;
        canvas.style.cursor = "pointer";
        const aboveY = f.n.y - f.n.r - 8;
        const belowY = f.n.y + f.n.r + 8;
        const place = tipPlace(f.n.x, aboveY);
        showTip(
          f.n.a.name,
          [
            ["Role", ROLE[f.n.a.id as BlockId] ?? f.n.a.name],
            ["Live", liveSubs[f.n.a.id as BlockId] ?? f.n.a.sub],
          ],
          "Open knowledge block →",
          place.x,
          place.above ? aboveY : belowY,
          place.above,
        );
      } else if (f?.kind === "core") {
        hoverNode = null;
        canvas.style.cursor = "pointer";
        const place = tipPlace(core.x, core.y - 36);
        showTip(
          "Company intelligence",
          [["Blocks", "Network · Placement"]],
          "Click to open →",
          place.x,
          place.above ? core.y - 36 : core.y + 28,
          place.above,
        );
      } else {
        hoverNode = null;
        canvas.style.cursor = "default";
        tip.hidden = true;
      }
    };

    const openMapNode = (href: string) => router.push(href);

    const onClick = (e: PointerEvent) => {
      if (zoom) return;
      const f = hit(e);
      if (!f) return;
      if (f.kind === "core") {
        openMapNode("/pulse/knowledge");
        return;
      }
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        openMapNode(f.n.a.href);
        return;
      }
      tip.hidden = true;
      hoverNode = null;
      zoom = { n: f.n, t0: performance.now(), done: false };
    };

    const onLeave = () => {
      hoverNode = null;
      tip.hidden = true;
      canvas.style.cursor = "default";
    };

    const draw = (ts: number) => {
      if (destroyed) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      if (zoom) {
        const p = Math.min(1, (ts - zoom.t0) / 520);
        const ease = 1 - (1 - p) ** 3;
        const sc = 1 + ease * 2.2;
        ctx.translate(W / 2, H / 2);
        ctx.scale(sc, sc);
        ctx.translate(-W / 2 + (W / 2 - zoom.n.x) * ease, -H / 2 + (H / 2 - zoom.n.y) * ease);
        if (p >= 1 && !zoom.done) {
          zoom.done = true;
          const href = zoom.n.a.href;
          window.setTimeout(() => openMapNode(href), 40);
        }
      }

      const tint = ctx.createRadialGradient(core.x, core.y, 10, core.x, core.y, Math.max(W, H) * 0.55);
      tint.addColorStop(0, "rgba(99,102,241,.06)");
      tint.addColorStop(1, "rgba(248,250,252,0)");
      ctx.fillStyle = tint;
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "rgba(148,163,184,.22)";
      for (let x = 12; x < W; x += 22) for (let y = 12; y < H; y += 22) ctx.fillRect(x, y, 1.2, 1.2);

      for (const s of sysNodes) {
        for (const id of s.s.to) {
          const n = nodes.find((x) => x.a.id === id);
          if (!n) continue;
          const c = ctrl(s, n, 0.18);
          ctx.strokeStyle = hoverNode?.a.id === id ? hexA(n.c, 0.55) : "rgba(148,163,184,.35)";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(s.x, s.y);
          ctx.quadraticCurveTo(c.x, c.y, n.x, n.y);
          ctx.stroke();
        }
      }
      for (const n of nodes) {
        const c = ctrl(n, core, -0.12);
        ctx.strokeStyle = hexA(n.c, 0.35);
        ctx.setLineDash([2, 5]);
        ctx.beginPath();
        ctx.moveTo(n.x, n.y);
        ctx.quadraticCurveTo(c.x, c.y, core.x, core.y);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      const beat = ((ts / 1000) % 2.4) / 2.4;
      for (let k = 0; k < 2; k += 1) {
        const p = (beat + k * 0.5) % 1;
        ctx.strokeStyle = `rgba(99,102,241,${(1 - p) * 0.18})`;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(core.x, core.y, 20 + p * 64, 0, Math.PI * 2);
        ctx.stroke();
      }
      const cg = ctx.createLinearGradient(core.x - 22, core.y - 22, core.x + 22, core.y + 22);
      cg.addColorStop(0, "#6366F1");
      cg.addColorStop(1, "#818CF8");
      ctx.shadowColor = "rgba(99,102,241,.18)";
      ctx.shadowBlur = 12;
      ctx.fillStyle = cg;
      ctx.beginPath();
      ctx.arc(core.x, core.y, 20, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(core.x - 9, core.y);
      ctx.lineTo(core.x - 4, core.y);
      ctx.lineTo(core.x - 1, core.y - 5);
      ctx.lineTo(core.x + 2, core.y + 5);
      ctx.lineTo(core.x + 5, core.y);
      ctx.lineTo(core.x + 9, core.y);
      ctx.stroke();
      ctx.textAlign = "center";
      ctx.font = "500 9.5px ui-monospace, monospace";
      ctx.fillStyle = "#64748B";
      ctx.fillText("COMPANY INTELLIGENCE", core.x, core.y + 36);

      for (let i = parts.length - 1; i >= 0; i -= 1) {
        const p = parts[i]!;
        p.t += p.sp;
        const dest = p.kind === "in" ? p.to : core;
        const curve = p.kind === "in" ? p.c : ctrl(p.to, core, -0.12);
        if (p.t >= 1) {
          if (p.kind === "in") {
            p.to.flash = 1;
            if (Math.random() < 0.35) spawnUp(p.to);
          }
          parts.splice(i, 1);
          continue;
        }
        for (let k = 0; k < 6; k += 1) {
          const q = qp(p.from, curve, dest, Math.max(0, p.t - k * 0.012));
          ctx.fillStyle = hexA(p.kind === "in" ? p.col : "#6366F1", 0.45 * (1 - k / 6));
          ctx.beginPath();
          ctx.arc(q.x, q.y, (p.kind === "in" ? 2.2 : 1.7) * (1 - k / 8), 0, Math.PI * 2);
          ctx.fill();
        }
      }

      ctx.font = "500 11px Inter, Geist, sans-serif";
      ctx.textAlign = "center";
      for (const s of sysNodes) {
        const tw = ctx.measureText(s.s.name).width + 18;
        roundRect(s.x - tw / 2, s.y - 11, tw, 22, 11);
        ctx.fillStyle = "#fff";
        ctx.fill();
        ctx.strokeStyle = "#E2E8F0";
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.fillStyle = "#475569";
        ctx.fillText(s.s.name, s.x, s.y + 4);
      }

      const t = ts / 1000;
      for (const n of nodes) {
        n.a.sub = liveSubs[n.a.id as BlockId] ?? n.a.sub;
        const isH = hoverNode === n;
        const r = n.r * (1 + Math.sin(t * 1.6 + n.phase) * 0.025) * (isH ? 1.07 : 1);
        n.flash = Math.max(0, n.flash - 0.04);
        const gl = ctx.createRadialGradient(n.x, n.y, r * 0.6, n.x, n.y, r * 1.7);
        gl.addColorStop(0, hexA(n.c, 0.1 + n.flash * 0.12));
        gl.addColorStop(1, hexA(n.c, 0));
        ctx.fillStyle = gl;
        ctx.beginPath();
        ctx.arc(n.x, n.y, r * 1.7, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#fff";
        ctx.shadowColor = "rgba(15,23,42,.08)";
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = hexA(n.c, isH ? 0.95 : 0.55);
        ctx.lineWidth = isH ? 2.4 : 1.6;
        ctx.beginPath();
        ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
        ctx.stroke();
        for (let k = 0; k < n.a.agents; k += 1) {
          const ang = t * 0.5 + k * (Math.PI * 2 / Math.max(n.a.agents, 1)) + n.phase;
          const ax = n.x + Math.cos(ang) * (r + 16);
          const ay = n.y + Math.sin(ang) * (r + 16);
          ctx.fillStyle = "#fff";
          ctx.strokeStyle = n.c;
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.arc(ax, ay, 4.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        }
        const titleSize = Math.max(11, Math.min(14, r * 0.18));
        ctx.font = `700 ${titleSize}px Geist, Inter, sans-serif`;
        ctx.fillStyle = "#0F172A";
        ctx.textAlign = "center";
        const titleLines = wrapLines(n.a.name, r * 1.55);
        const lineH = titleSize + 3;
        const titleBlockH = titleLines.length * lineH;
        const titleTop = n.y - titleBlockH / 2 - 6;
        titleLines.forEach((line, i) => ctx.fillText(line, n.x, titleTop + i * lineH + titleSize * 0.85));
        ctx.font = `500 ${Math.max(9, Math.min(11, r * 0.14))}px ui-monospace, monospace`;
        ctx.fillStyle = "#64748B";
        ctx.fillText(n.a.sub, n.x, titleTop + titleBlockH + 12);
      }

      if (!zoom && ts - lastSpawn > 170) {
        spawn();
        lastSpawn = ts;
      }
      raf = requestAnimationFrame(draw);
    };

    layout();
    for (let i = 0; i < 12; i += 1) spawn();
    const ro = new ResizeObserver(() => layout());
    ro.observe(wrap);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerleave", onLeave);
    canvas.addEventListener("click", onClick);
    raf = requestAnimationFrame(draw);

    return () => {
      destroyed = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerleave", onLeave);
      canvas.removeEventListener("click", onClick);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [networkSub, placementSub, subKey, router]);

  return (
    <div className={styles.mapWrapExact} ref={wrapRef}>
      <canvas ref={canvasRef} aria-label="Live knowledge map" />
      <div ref={tipRef} className={styles.mapTipExact} hidden />
      <div className={styles.mapLegendExact}>
        <span>
          <i style={{ background: "#6366F1" }} />
          Network Intelligence
        </span>
        <span>
          <i style={{ background: "#8B5CF6" }} />
          Commercial & Relationship
        </span>
        <span>
          <i style={{ background: "#22D3EE" }} />
          Augmentation & Placement
        </span>
        <span>
          <i style={{ background: "#10B981" }} />
          Strategic Capability
        </span>
      </div>
    </div>
  );
}
