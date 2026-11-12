"use client";

import {
  Children,
  isValidElement,
  useEffect,
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import Icon from "./Icon";
import styles from "./Select.module.css";

interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface SelectProps {
  id?: string;
  name?: string;
  value?: string | number;
  className?: string;
  style?: CSSProperties;
  disabled?: boolean;
  "aria-label"?: string;
  children?: ReactNode;
  onChange?: (event: ChangeEvent<HTMLSelectElement>) => void;
}

function textOf(node: ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (isValidElement<{ children?: ReactNode }>(node)) return textOf(node.props.children);
  return "";
}

function readOptions(children: ReactNode): SelectOption[] {
  const options: SelectOption[] = [];
  Children.forEach(children, (child) => {
    if (!isValidElement<{ value?: string | number; disabled?: boolean; children?: ReactNode }>(child)) return;
    if (child.type !== "option") return;
    const label = textOf(child.props.children).replace(/\s+/g, " ").trim();
    const value = child.props.value != null ? String(child.props.value) : label;
    options.push({ value, label: label || value, disabled: child.props.disabled });
  });
  return options;
}

export default function Select({ id, name, value, className = "", style, disabled, children, onChange, ...rest }: SelectProps) {
  const options = readOptions(children);
  const selected = options.find((item) => item.value === String(value ?? "")) ?? options[0];
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [menu, setMenu] = useState<{ top?: number; bottom?: number; left: number; width: number; maxHeight: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  const place = () => {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUp = spaceBelow < 220 && rect.top > spaceBelow;
    const width = Math.max(rect.width, 196);
    const left = Math.min(rect.left, window.innerWidth - width - 8);
    setMenu({
      left: Math.max(8, left),
      width,
      top: openUp ? undefined : rect.bottom + 6,
      bottom: openUp ? window.innerHeight - rect.top + 6 : undefined,
      maxHeight: Math.max(140, Math.min(280, (openUp ? rect.top : spaceBelow) - 16)),
    });
  };

  useEffect(() => {
    if (!open) return;
    place();
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (buttonRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onReflow = () => place();
    document.addEventListener("pointerdown", onPointer);
    window.addEventListener("resize", onReflow);
    window.addEventListener("scroll", onReflow, true);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("resize", onReflow);
      window.removeEventListener("scroll", onReflow, true);
    };
  }, [open]);

  const choose = (next: string) => {
    const event = {
      target: { value: next, name: name ?? "" },
      currentTarget: { value: next, name: name ?? "" },
      preventDefault() {},
      stopPropagation() {},
    } as unknown as ChangeEvent<HTMLSelectElement>;
    onChange?.(event);
    setOpen(false);
    buttonRef.current?.focus();
  };

  const openMenu = () => {
    if (disabled) return;
    const index = Math.max(0, options.findIndex((item) => item.value === String(value ?? "")));
    setActive(index);
    setOpen(true);
  };

  const onKey = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return;
    if (!open && (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      openMenu();
      return;
    }
    if (!open) return;
    if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      let next = active;
      for (let i = 0; i < options.length; i += 1) {
        next = (next + step + options.length) % options.length;
        if (!options[next]?.disabled) break;
      }
      setActive(next);
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      const option = options[active];
      if (option && !option.disabled) choose(option.value);
    }
  };

  return (
    <>
      <button
        ref={buttonRef}
        id={id}
        type="button"
        className={`${styles.trigger} ${className}`.trim()}
        style={style}
        disabled={disabled}
        aria-label={rest["aria-label"]}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        onClick={() => (open ? setOpen(false) : openMenu())}
        onKeyDown={onKey}
      >
        <span className={styles.label}>{selected?.label ?? "Select"}</span>
        <Icon name="chevronDown" size={14} />
      </button>
      {open && menu
        ? createPortal(
            <div
              ref={menuRef}
              id={listId}
              className={styles.menu}
              role="listbox"
              style={{ top: menu.top, bottom: menu.bottom, left: menu.left, width: menu.width, maxHeight: menu.maxHeight }}
            >
              {options.map((option, index) => (
                <button
                  key={`${option.value}-${index}`}
                  type="button"
                  role="option"
                  className={styles.option}
                  disabled={option.disabled}
                  aria-selected={option.value === String(value ?? "")}
                  data-active={index === active ? "true" : undefined}
                  onMouseEnter={() => setActive(index)}
                  onClick={() => choose(option.value)}
                >
                  <span>{option.label}</span>
                  {option.value === String(value ?? "") ? <Icon name="check" size={14} /> : null}
                </button>
              ))}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
