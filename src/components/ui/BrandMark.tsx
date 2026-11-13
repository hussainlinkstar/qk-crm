"use client";

import { initials } from "@/lib/format";
import styles from "./BrandMark.module.css";

/**
 * Illustrative logo mark for an organisation: a seeded geometric tile with the monogram. Stands
 * in for a real logo in the demo (fictional companies have none) and stays the same per name.
 */
export default function BrandMark({ name, size = 40, radius }: { name: string; size?: number; radius?: number }) {
  let hash = 0;
  for (const char of name) hash = (hash * 33 + char.charCodeAt(0)) >>> 0;
  const hue = hash % 360;
  const dark = `hsl(${hue} 42% 28%)`;
  const mid = `hsl(${(hue + 18) % 360} 55% 48%)`;
  const light = `hsl(${(hue + 36) % 360} 70% 82%)`;
  const motif = hash % 4;
  const r = radius ?? Math.round(size * 0.28);
  const letters = initials(name).slice(0, 2);

  return (
    <span className={styles.wrap} style={{ width: size, height: size, borderRadius: r }} aria-hidden="true">
      <svg viewBox="0 0 40 40" width={size} height={size} style={{ borderRadius: r }}>
        <rect width="40" height="40" fill={dark} />
        {motif === 0 ? <circle cx="31" cy="9" r="14" fill={mid} /> : null}
        {motif === 1 ? <path d="M0 40 L40 0 V40Z" fill={mid} /> : null}
        {motif === 2 ? <rect x="20" y="-10" width="30" height="60" rx="8" transform="rotate(25 20 20)" fill={mid} /> : null}
        {motif === 3 ? <path d="M-4 24 Q 20 4 44 24 V44 H-4Z" fill={mid} /> : null}
        <circle cx="8" cy="33" r="3" fill={light} opacity="0.9" />
        <text x="20" y="21" textAnchor="middle" dominantBaseline="middle" fontSize="15" fontWeight="800" fill="#fff" style={{ letterSpacing: "-0.03em" }}>
          {letters}
        </text>
      </svg>
    </span>
  );
}
