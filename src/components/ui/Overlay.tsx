"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import Button from "./Button";
import Icon from "./Icon";
import styles from "./Overlay.module.css";

function useOverlay(onClose: () => void, focusPanel = false) {
  const panelRef = useRef<HTMLElement>(null);
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        closeRef.current();
      }
    };
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusable = focusPanel ? null : panelRef.current?.querySelector<HTMLElement>("[data-autofocus], input:not([type=hidden]), textarea, select");
    (focusable ?? panelRef.current)?.focus({ preventScroll: true });
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      previous?.focus?.({ preventScroll: true });
    };
  }, [focusPanel]);
  return panelRef;
}

interface ModalProps {
  title: string;
  kicker?: string;
  description?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  size?: "small" | "medium" | "large";
}

export function Modal({ title, kicker, description, onClose, children, footer, size = "medium" }: ModalProps) {
  const ref = useOverlay(onClose);
  const titleId = useId();
  return (
    <div className={styles.backdrop} onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section ref={ref} tabIndex={-1} className={`${styles.modal} ${styles[size]}`} role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <header className={styles.header}>
          <div>
            {kicker && <p className="kicker">{kicker}</p>}
            <h2 id={titleId}>{title}</h2>
            {description && <p className={styles.description}>{description}</p>}
          </div>
          <Button variant="ghost" size="small" icon="x" aria-label="Close" onClick={onClose} />
        </header>
        <div className={styles.body}>{children}</div>
        {footer && <footer className={styles.footer}>{footer}</footer>}
      </section>
    </div>
  );
}

interface DrawerProps {
  title: ReactNode;
  kicker?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  actions?: ReactNode;
  width?: number;
  focusPanel?: boolean;
}

export function Drawer({ title, kicker, onClose, children, footer, actions, width = 520, focusPanel = false }: DrawerProps) {
  const ref = useOverlay(onClose, focusPanel);
  const titleId = useId();
  return (
    <div className={`${styles.backdrop} ${styles.drawerBackdrop}`} onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <aside ref={ref} tabIndex={-1} className={styles.drawer} style={{ width: `min(${width}px, 100vw)` }} role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <header className={styles.drawerHeader}>
          <div className={styles.drawerTitle}>
            {kicker && <p className="kicker">{kicker}</p>}
            <h2 id={titleId}>{title}</h2>
          </div>
          <div className={styles.drawerActions}>
            {actions}
            <Button variant="ghost" size="small" icon="x" aria-label="Close panel" onClick={onClose} />
          </div>
        </header>
        <div className={styles.drawerBody}>{children}</div>
        {footer && <footer className={styles.drawerFooter}>{footer}</footer>}
      </aside>
    </div>
  );
}

interface ConfirmProps {
  title: string;
  description: ReactNode;
  confirmLabel?: string;
  tone?: "default" | "danger";
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({ title, description, confirmLabel = "Confirm", tone = "default", onConfirm, onCancel }: ConfirmProps) {
  const ref = useOverlay(onCancel);
  const titleId = useId();
  return (
    <div className={`${styles.backdrop} ${styles.confirmBackdrop}`} onMouseDown={(event) => event.target === event.currentTarget && onCancel()}>
      <section ref={ref} tabIndex={-1} className={`${styles.modal} ${styles.small} ${styles.confirm}`} role="alertdialog" aria-modal="true" aria-labelledby={titleId}>
        <span className={`${styles.confirmIcon} ${tone === "danger" ? styles.confirmDanger : ""}`}>
          <Icon name={tone === "danger" ? "alert" : "info"} size={18} />
        </span>
        <h2 id={titleId}>{title}</h2>
        <div className={styles.description}>{description}</div>
        <div className={styles.confirmActions}>
          <Button variant="secondary" onClick={onCancel}>Cancel</Button>
          <Button variant={tone === "danger" ? "danger" : "primary"} onClick={onConfirm} data-autofocus>{confirmLabel}</Button>
        </div>
      </section>
    </div>
  );
}
