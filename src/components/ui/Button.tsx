import type { ButtonHTMLAttributes, ReactNode } from "react";
import Icon, { type IconName } from "./Icon";
import styles from "./Button.module.css";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "soft";
type ButtonSize = "small" | "medium" | "large";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children?: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  icon?: IconName;
  iconRight?: IconName;
  loading?: boolean;
}

export default function Button({ children, variant = "primary", size = "medium", fullWidth = false, icon, iconRight, loading = false, className = "", type = "button", disabled, ...props }: ButtonProps) {
  const iconSize = size === "small" ? 14 : 16;
  return (
    <button
      {...props}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={[styles.button, styles[variant], styles[size], fullWidth ? styles.fullWidth : "", !children ? styles.iconOnly : "", className].filter(Boolean).join(" ")}
    >
      {loading ? <span className={styles.spinner} aria-hidden="true" /> : icon && <Icon name={icon} size={iconSize} />}
      {children}
      {iconRight && !loading && <Icon name={iconRight} size={iconSize} />}
    </button>
  );
}
