"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
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

  useEffect(() => {
    document.documentElement.setAttribute("data-product", "pulse");
    return () => document.documentElement.removeAttribute("data-product");
  }, []);

  return (
    <nav className={styles.subnav} aria-label="Pulse sections">
      {LINKS.map((link) => {
        const active = "exact" in link && link.exact ? pathname === link.href : pathname === link.href || pathname.startsWith(`${link.href}/`);
        return (
          <Link key={link.href} href={link.href} className={`${styles.subnavLink} ${active ? styles.subnavActive : ""}`} aria-current={active ? "page" : undefined}>
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
