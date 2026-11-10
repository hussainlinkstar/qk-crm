"use client";

import { useMemo, useRef, useState } from "react";
import styles from "./TagMultiSelect.module.css";

type Props = {
  value: string[];
  options: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  "aria-label"?: string;
  allowCustom?: boolean;
};

export default function TagMultiSelect({
  value,
  options,
  onChange,
  placeholder = "Search or add…",
  "aria-label": ariaLabel = "Select values",
  allowCustom = true,
}: Props) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = useMemo(() => new Set(value.map((item) => item.toLowerCase())), [value]);
  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    return options
      .filter((item) => !selected.has(item.toLowerCase()))
      .filter((item) => !q || item.toLowerCase().includes(q))
      .slice(0, 8);
  }, [options, query, selected]);

  const add = (raw: string) => {
    const next = raw.trim();
    if (!next) return;
    if (selected.has(next.toLowerCase())) {
      setQuery("");
      return;
    }
    onChange([...value, next]);
    setQuery("");
    inputRef.current?.focus();
  };

  const remove = (item: string) => {
    onChange(value.filter((entry) => entry !== item));
  };

  return (
    <div className={styles.root}>
      <div
        className={styles.control}
        onClick={() => {
          setOpen(true);
          inputRef.current?.focus();
        }}
      >
        {value.map((item) => (
          <button key={item} type="button" className={styles.chip} onClick={() => remove(item)} aria-label={`Remove ${item}`}>
            {item}
            <span aria-hidden="true">×</span>
          </button>
        ))}
        <input
          ref={inputRef}
          className={styles.input}
          value={query}
          aria-label={ariaLabel}
          placeholder={value.length ? "" : placeholder}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            window.setTimeout(() => setOpen(false), 120);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              if (suggestions[0]) add(suggestions[0]);
              else if (allowCustom) add(query);
            } else if (e.key === "Backspace" && !query && value.length) {
              remove(value[value.length - 1]);
            }
          }}
        />
      </div>
      {open && (suggestions.length > 0 || (allowCustom && query.trim())) ? (
        <ul className={styles.menu} role="listbox">
          {suggestions.map((item) => (
            <li key={item}>
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => add(item)}>
                {item}
              </button>
            </li>
          ))}
          {allowCustom && query.trim() && !selected.has(query.trim().toLowerCase()) && !suggestions.some((item) => item.toLowerCase() === query.trim().toLowerCase()) ? (
            <li>
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => add(query)}>
                Add “{query.trim()}”
              </button>
            </li>
          ) : null}
        </ul>
      ) : null}
    </div>
  );
}
