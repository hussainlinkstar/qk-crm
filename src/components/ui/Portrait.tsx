"use client";

import { avatarStyle, initials } from "@/lib/format";
import styles from "./Portrait.module.css";

/**
 * Illustrative portrait for a person: a seeded two-tone gradient with a soft shape behind the
 * initials. Honest stand-in for a photo in the demo (no real photos are stored), consistent per
 * name so the same person looks the same everywhere.
 */
export default function Portrait({ name, size = 40, ring }: { name: string; size?: number; ring?: "available" | "limited" | "unavailable" | "unknown" | null }) {
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  const hue = hash % 360;
  const hue2 = (hue + 40 + (hash % 50)) % 360;
  const shape = hash % 3;
  const colours = avatarStyle(name);
  const id = `pg-${hash.toString(36)}`;

  return (
    <span className={styles.wrap} data-ring={ring ?? undefined} style={{ width: size, height: size }} aria-hidden="true">
      <svg viewBox="0 0 40 40" width={size} height={size} className={styles.svg}>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={`hsl(${hue} 70% 88%)`} />
            <stop offset="100%" stopColor={`hsl(${hue2} 60% 72%)`} />
          </linearGradient>
        </defs>
        <rect width="40" height="40" rx="20" fill={`url(#${id})`} />
        {shape === 0 ? <circle cx="29" cy="12" r="9" fill="rgba(255,255,255,0.35)" /> : null}
        {shape === 1 ? <path d="M0 30 Q 20 14 40 30 V40 H0Z" fill="rgba(255,255,255,0.32)" /> : null}
        {shape === 2 ? <rect x="-6" y="24" width="52" height="30" rx="14" transform="rotate(-18 20 20)" fill="rgba(255,255,255,0.3)" /> : null}
        <text x="20" y="21" textAnchor="middle" dominantBaseline="middle" fontSize="14" fontWeight="700" fill={colours.color} style={{ letterSpacing: "-0.02em" }}>
          {initials(name)}
        </text>
      </svg>
    </span>
  );
}
