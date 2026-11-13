"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import styles from "./BarList.module.css";

export interface BarRow {
  key: string;
  label: ReactNode;
  value: number;
  /** Formatted value shown at the right; defaults to the number. */
  display?: string;
  /** Short caption under the label, e.g. "2 deals". */
  caption?: string;
  href?: string;
  onClick?: () => void;
  tone?: "brand" | "qiko" | "success" | "warning" | "muted";
}

/**
 * Horizontal labelled bars for overview pages. Bars grow in on mount and the whole row is a
 * target when it has an href or onClick, so a chart row doubles as navigation.
 */
export default function BarList({ rows, max, label }: { rows: BarRow[]; max?: number; label: string }) {
  const top = Math.max(1, max ?? Math.max(...rows.map((row) => row.value)));
  return (
    <ul className={styles.list} aria-label={label}>
      {rows.map((row, index) => {
        const body = (
          <>
            <span className={styles.head}>
              <span className={styles.label}>
                {row.label}
                {row.caption ? <small>{row.caption}</small> : null}
              </span>
              <b className="tabular">{row.display ?? row.value.toLocaleString("en-GB")}</b>
            </span>
            <span className={styles.track} aria-hidden="true">
              <span
                className={styles.fill}
                data-tone={row.tone ?? "brand"}
                style={{ width: `${Math.max(row.value > 0 ? 2 : 0, (row.value / top) * 100)}%`, animationDelay: `${index * 50}ms` }}
              />
            </span>
          </>
        );
        const className = `${styles.row} ${row.href || row.onClick ? styles.rowHit : ""}`;
        return (
          <li key={row.key}>
            {row.href ? (
              <Link href={row.href} className={className}>
                {body}
              </Link>
            ) : row.onClick ? (
              <button type="button" className={className} onClick={row.onClick}>
                {body}
              </button>
            ) : (
              <div className={className}>{body}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
