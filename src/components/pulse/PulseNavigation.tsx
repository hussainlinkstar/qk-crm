"use client";

import Image from "next/image";
import Link from "next/link";
import type { IconName } from "@/components/ui/Icon";
import Icon from "@/components/ui/Icon";
import { useWorkspaceData } from "@/components/ui/bits";
import { TESSIANT_KNOWLEDGE_BLOCKS } from "@/lib/tessiant-knowledge";
import styles from "@/components/shell/AppShell.module.css";

const LINKS: Array<{ href: string; label: string; icon: IconName; exact?: boolean }> = [
  { href: "/pulse", label: "Pulse", icon: "pulse", exact: true },
  { href: "/pulse/knowledge", label: "Knowledge", icon: "users" },
  { href: "/pulse/insights", label: "Insights", icon: "sparkles" },
  { href: "/pulse/actions", label: "To-Do", icon: "tasks" },
  { href: "/pulse/value", label: "Value", icon: "sales" },
  { href: "/pulse/connections", label: "Connections", icon: "database" },
];

export default function PulseNavigation({
  pathname,
  collapsed,
  onCollapse,
  onNavigate,
  onClose,
}: {
  pathname: string;
  collapsed: boolean;
  onCollapse: () => void;
  onNavigate: () => void;
  onClose: () => void;
}) {
  const { state } = useWorkspaceData();
  const openActions =
    state?.tasks.filter(
      (task) =>
        (task.description.includes("[pulse-insight:") || task.description.includes("[pulse-board]")) &&
        (task.status === "pending" || task.status === "in_progress"),
    ).length ?? 0;

  return (
    <>
      <div className={styles.brandRow}>
        <Link href="/pulse" className={styles.brand} onClick={onNavigate} aria-label="Qiko Pulse home">
          {collapsed ? (
            <Image src="/brand/qiko-icon.png" alt="Qiko" width={32} height={32} priority />
          ) : (
            <>
              <Image src="/brand/qiko-logo.png" alt="Qiko" width={70} height={28} priority className={styles.wordmark} />
              <span className={styles.product}>Pulse</span>
            </>
          )}
        </Link>
        <button type="button" className={styles.collapse} onClick={onCollapse} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
          <Icon name={collapsed ? "chevronRight" : "chevronLeft"} size={14} />
        </button>
        <button type="button" className={styles.mobileClose} onClick={onClose} aria-label="Close navigation">
          <Icon name="x" size={18} />
        </button>
      </div>

      <Link href="/" className={`${styles.pulseWorkspace} ${styles.hideCollapsed}`} onClick={onNavigate} aria-label="Back to Tessiant workspace">
        <span className={styles.pulseWorkspaceMark}>T</span>
        <span>
          <b>Tessiant</b>
          <small>Back to operating workspace</small>
        </span>
      </Link>

      <nav className={styles.nav} aria-label="Qiko Pulse navigation">
        <p className={`kicker ${styles.section}`}>Workspace intelligence</p>
        <ul>
          {LINKS.map((item) => {
            const active = item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
            const meta =
              item.href === "/pulse/knowledge"
                ? TESSIANT_KNOWLEDGE_BLOCKS.length
                : item.href === "/pulse/actions"
                  ? openActions
                  : null;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`${styles.navItem} ${active ? styles.active : ""}`}
                  aria-current={active ? "page" : undefined}
                  onClick={onNavigate}
                  title={collapsed ? item.label : undefined}
                >
                  <Icon name={item.icon} size={17} />
                  <span className={styles.hideCollapsed}>{item.label}</span>
                  {item.href === "/pulse" ? <i className={`${styles.pulseLiveDot} ${styles.hideCollapsed}`} aria-label="Live" /> : null}
                  {meta !== null ? <span className={`${styles.meta} ${styles.hideCollapsed}`}>{meta}</span> : null}
                </Link>
              </li>
            );
          })}
        </ul>

        <p className={`kicker ${styles.section} ${styles.sectionGap}`}>System</p>
        <ul>
          <li>
            <Link href="/settings" className={styles.navItem} onClick={onNavigate} title={collapsed ? "Settings" : undefined}>
              <Icon name="settings" size={17} />
              <span className={styles.hideCollapsed}>Settings</span>
            </Link>
          </li>
        </ul>
      </nav>

      <div className={styles.sidebarFoot}>
        <Link href="/" className={`${styles.navItem} ${styles.pulseBackFoot}`} onClick={onNavigate} title={collapsed ? "Back to Tessiant" : undefined}>
          <Icon name="arrowLeft" size={17} />
          <span className={styles.hideCollapsed}>Back to Tessiant</span>
        </Link>
      </div>
    </>
  );
}
