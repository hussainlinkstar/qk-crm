import { useRef, useState } from "react";
import styles from "./LeadUser.module.css";

interface UserOption {
  name: string;
  email: string;
}

interface LeadUserProps {
  name: string;
  email: string;
  options?: UserOption[];
  onSelect?: (user: UserOption) => void;
}

export default function LeadUser({ name, email, options, onSelect }: LeadUserProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ left: 8, top: 8 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const initials = name.split(/\s+/).filter(Boolean).map((part) => part[0]).join("").slice(0, 2);
  const selectable = Boolean(options?.length && onSelect);

  function toggleMenu() {
    if (!selectable) return;
    if (!menuOpen && triggerRef.current) {
      const bounds = triggerRef.current.getBoundingClientRect();
      const menuHeight = Math.min(260, (options?.length ?? 0) * 48 + 10);
      setMenuPosition({
        left: Math.max(8, Math.min(bounds.left, window.innerWidth - 250 - 8)),
        top: bounds.bottom + menuHeight > window.innerHeight - 8
          ? Math.max(8, bounds.top - menuHeight - 6)
          : bounds.bottom + 6,
      });
    }
    setMenuOpen((open) => !open);
  }

  return (
    <span className={styles.userPicker} onClick={(event) => event.stopPropagation()}>
      <button
        ref={triggerRef}
        type="button"
        className={`${styles.user}${selectable ? ` ${styles.selectable}` : ""}`}
        aria-haspopup={selectable ? "listbox" : undefined}
        aria-expanded={selectable ? menuOpen : undefined}
        onClick={toggleMenu}
      >
        <span className={styles.avatar} aria-hidden="true">{initials}</span>
        <span className={styles.details}>
          <strong>{name}</strong>
          <small>{email}</small>
        </span>
        {selectable && <span className={`${styles.chevron} ${menuOpen ? styles.chevronOpen : ""}`} aria-hidden="true" />}
      </button>
      {selectable && menuOpen && <span className={styles.menu} style={menuPosition} role="listbox" aria-label="Select owner">
        {options?.map((option) => {
          const optionInitials = option.name.split(/\s+/).filter(Boolean).map((part) => part[0]).join("").slice(0, 2);
          return <button
            type="button"
            className={styles.option}
            role="option"
            aria-selected={option.name === name}
            key={option.name}
            onClick={() => {
              onSelect?.(option);
              setMenuOpen(false);
            }}
          >
            <span className={styles.avatar} aria-hidden="true">{optionInitials}</span>
            <span className={styles.details}><strong>{option.name}</strong><small>{option.email}</small></span>
          </button>;
        })}
      </span>}
    </span>
  );
}
