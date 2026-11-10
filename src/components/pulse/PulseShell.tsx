import type { ReactNode } from "react";
import styles from "@/app/(workspace)/pulse/pulse.module.css";

/** Scopes Qiko Pulse product tokens without adding a conflicting App Router layout route. */
export default function PulseShell({ children }: { children: ReactNode }) {
  return (
    <div className={styles.pulseProduct} data-product="pulse">
      {children}
    </div>
  );
}
