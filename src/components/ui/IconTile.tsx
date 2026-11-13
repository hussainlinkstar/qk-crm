import Icon, { type IconName } from "./Icon";
import styles from "./IconTile.module.css";

export type IconTone = "brand" | "qiko" | "success" | "warning" | "danger" | "info" | "muted";

/**
 * A small tinted square with an icon: the visual anchor for a metric, a signal kind or a
 * section. Tones follow the colour roles, so indigo always means "Qiko worked this out".
 */
export default function IconTile({
  name,
  tone = "brand",
  size = "md",
  className = "",
}: {
  name: IconName;
  tone?: IconTone;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const iconSize = size === "sm" ? 13 : size === "lg" ? 20 : 15;
  return (
    <span className={`${styles.tile} ${styles[size]} ${className}`} data-tone={tone} aria-hidden="true">
      <Icon name={name} size={iconSize} strokeWidth={2.1} />
    </span>
  );
}
