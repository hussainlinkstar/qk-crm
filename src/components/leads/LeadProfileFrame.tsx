"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import Icon from "@/components/ui/Icon";
import { initials } from "@/lib/format";
import styles from "@/app/(workspace)/sales/leads/[id]/profile.module.css";

export interface LeadProfileTab {
  key: string;
  label: string;
  count?: number;
}

/**
 * The sales lead record chrome (header, tabs, main column, side column).
 * Sales and Signal growth both fill it with their own records.
 */
export default function LeadProfileFrame({
  back,
  name,
  chips,
  role,
  contact,
  controls,
  actions,
  tabs,
  tab,
  onTab,
  children,
  side,
}: {
  back: { href: string; label: string };
  name: string;
  chips?: ReactNode;
  role?: ReactNode;
  contact?: ReactNode;
  controls?: ReactNode;
  actions?: ReactNode;
  tabs: LeadProfileTab[];
  tab: string;
  onTab: (key: string) => void;
  children: ReactNode;
  side?: ReactNode;
}) {
  return (
    <div className="page">
      <Link href={back.href} className="breadcrumb">
        <Icon name="arrowLeft" size={14} /> {back.label}
      </Link>

      <section className={`card ${styles.header}`}>
        <div className={styles.identity}>
          <span className="avatar avatar-lg">{initials(name)}</span>
          <div className={styles.identityText}>
            <div className={styles.nameRow}>
              <h1>{name}</h1>
              {chips}
            </div>
            {role ? <p className={styles.role}>{role}</p> : null}
            {contact ? <p className={styles.contact}>{contact}</p> : null}
          </div>
        </div>
        {controls ? <div className={styles.controls}>{controls}</div> : null}
        {actions ? <div className={styles.actions}>{actions}</div> : null}
      </section>

      <div className={styles.layout}>
        <div className={styles.main}>
          <nav className={styles.tabs} aria-label="Lead sections">
            {tabs.map((item) => (
              <button type="button" key={item.key} aria-pressed={tab === item.key} onClick={() => onTab(item.key)}>
                {item.label}
                {item.count !== undefined && <span>{item.count}</span>}
              </button>
            ))}
          </nav>
          {children}
        </div>
        {side ? <aside className={styles.side}>{side}</aside> : null}
      </div>
    </div>
  );
}
