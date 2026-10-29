import type { MouseEvent, ReactNode } from "react";
import Button from "./Button";
import styles from "./ConfirmDialog.module.css";

interface ConfirmDialogProps {
  title: string;
  description: ReactNode;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  title,
  description,
  confirmLabel = "Confirm",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <div className={styles.backdrop} role="presentation" onMouseDown={(event: MouseEvent<HTMLDivElement>) => {
      if (event.target === event.currentTarget) onCancel();
    }}>
      <section
        className={styles.dialog}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-description"
      >
        <span className={styles.eyebrow}>CONFIRM CHANGE</span>
        <h2 id="confirm-dialog-title">{title}</h2>
        <p id="confirm-dialog-description">{description}</p>
        <div className={styles.actions}>
          <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
          <Button type="button" onClick={onConfirm}>{confirmLabel}</Button>
        </div>
      </section>
    </div>
  );
}
