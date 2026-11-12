import styles from "./sales-theme.module.css";

export default function SalesLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={styles.surface} data-product="signal">
      {children}
    </div>
  );
}
