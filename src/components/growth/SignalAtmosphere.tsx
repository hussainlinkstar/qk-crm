import type { ReactNode } from "react";
import styles from "./atmosphere.module.css";

export default function SignalAtmosphere({ children }: { children: ReactNode }) {
  return (
    <div className={styles.atmosphere}>
      <div className={styles.veil} aria-hidden="true">
        <span className={`${styles.orb} ${styles.orbA}`} />
        <span className={`${styles.orb} ${styles.orbB}`} />
        <span className={`${styles.orb} ${styles.orbC}`} />
      </div>
      <div className={styles.content}>{children}</div>
    </div>
  );
}
