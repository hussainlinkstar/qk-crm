import styles from "./StatsCard.module.css";

interface StatsCardProps {
  label: string;
  value: string | number;
  change: string;
  urgent?: boolean;
}

export default function StatsCard({ label, value, change, urgent = false }: StatsCardProps) {
  return (
    <article className={`${styles.card}${urgent ? ` ${styles.urgent}` : ""}`}>
      <span className={styles.label}>{label}</span>
      <strong className={styles.value}>{value}</strong>
      <small className={styles.change}>{change}</small>
    </article>
  );
}
