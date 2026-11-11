"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo } from "react";
import { useWorkspaceData } from "@/components/ui/bits";
import styles from "@/app/(workspace)/pulse/pulse.module.css";

const LINKS = [
  { href: "/pulse", label: "Pulse", exact: true },
  { href: "/pulse/knowledge", label: "Knowledge" },
  { href: "/pulse/insights", label: "Insights" },
  { href: "/pulse/actions", label: "To-Dos" },
  { href: "/pulse/value", label: "Value" },
  { href: "/pulse/connections", label: "Connections" },
  { href: "/settings", label: "Settings" },
] as const;

export default function PulseSubnav() {
  const pathname = usePathname();
  const { state } = useWorkspaceData();

  useEffect(() => {
    document.documentElement.setAttribute("data-product", "pulse");
    return () => document.documentElement.removeAttribute("data-product");
  }, []);

  const open = useMemo(
    () =>
      state
        ? state.tasks.filter(
            (task) =>
              (task.description.includes("[pulse-insight:") || task.description.includes("[pulse-board]")) &&
              (task.status === "pending" || task.status === "in_progress"),
          ).length
        : 0,
    [state],
  );

  return (
    <nav className={styles.pulseTabsExact} aria-label="Pulse sections">
      {LINKS.map((link) => {
        const active = "exact" in link && link.exact ? pathname === link.href : pathname === link.href || pathname.startsWith(`${link.href}/`);
        return (
          <Link key={link.href} href={link.href} className={`${styles.pulseTabExact} ${active ? styles.pulseTabOn : ""}`} aria-current={active ? "page" : undefined}>
            <span>{link.label}</span>
            {link.href === "/pulse" ? (
              <span
                aria-hidden="true"
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: 9999,
                  background: "#10b981",
                  boxShadow: "0 0 0 3px rgba(16,185,129,.15)",
                }}
              />
            ) : null}
            {link.href === "/pulse/knowledge" ? (
              <span className="tabular" style={{ fontSize: 10, color: "#94a3b8" }}>4</span>
            ) : null}
            {link.href === "/pulse/actions" ? (
              <span className="tabular" style={{ fontSize: 10, color: "#94a3b8" }}>{open}</span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
