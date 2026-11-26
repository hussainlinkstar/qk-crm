"use client";

import Link from "next/link";
import { useState, type FormEvent, type ReactNode } from "react";
import Button from "@/components/ui/Button";
import CountUp from "@/components/ui/CountUp";
import Icon, { type IconName } from "@/components/ui/Icon";
import IconTile, { type IconTone } from "@/components/ui/IconTile";
import Spark from "@/components/ui/Spark";
import styles from "./workspace.module.css";

export function PageHero({
  kicker,
  title,
  lede,
  action,
}: {
  kicker?: ReactNode;
  title: ReactNode;
  lede?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <header className={styles.hero}>
      <div className={styles.heroCopy}>
        {kicker ? <p className="kicker">{kicker}</p> : null}
        <h1>{title}</h1>
        {lede ? <p className={styles.lede}>{lede}</p> : null}
      </div>
      {action ? <div className={styles.heroActions}>{action}</div> : null}
    </header>
  );
}

export function FilterRow({ children, label = "Filters" }: { children: ReactNode; label?: string }) {
  return (
    <div className={styles.filters} role="group" aria-label={label}>
      {children}
    </div>
  );
}

export function PillLink({
  href,
  children,
  external,
}: {
  href: string;
  children: ReactNode;
  external?: boolean;
}) {
  return (
    <Link href={href} className={styles.pill} {...(external ? { target: "_blank", rel: "noopener" } : {})}>
      {children}
    </Link>
  );
}

export function PillButton({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button type="button" className={styles.pill} onClick={onClick}>
      {children}
    </button>
  );
}

export function AskBar({
  placeholder,
  prompts,
  onAsk,
  promptLabel = "Try",
  tour,
}: {
  placeholder: string;
  prompts: string[];
  onAsk: (question: string) => void;
  promptLabel?: string;
  tour?: string;
}) {
  const [question, setQuestion] = useState("");
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const next = question.trim();
    if (!next) return;
    onAsk(next);
    setQuestion("");
  };

  return (
    <section className={styles.askSection} aria-label="Ask Qiko" data-tour={tour}>
      <form onSubmit={submit} className={styles.ask}>
        <span className={styles.askOrb}>
          <Icon name="sparkles" size={15} />
        </span>
        <input value={question} onChange={(event) => setQuestion(event.target.value)} placeholder={placeholder} aria-label="Ask Qiko" />
        <kbd className={styles.askKbd}>⌘K</kbd>
        <Button type="submit" variant="qiko" size="small" iconRight="arrowRight" disabled={!question.trim()}>
          Ask
        </Button>
      </form>
      {prompts.length > 0 && (
        <div className={styles.prompts}>
          <span className={styles.promptsLabel}>{promptLabel}</span>
          {prompts.map((prompt) => (
            <button key={prompt} type="button" onClick={() => onAsk(prompt)}>
              {prompt}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

export type OutcomeTile = {
  key: string;
  href?: string;
  label: string;
  value?: ReactNode;
  numeric?: number;
  format?: (value: number) => string;
  sub: string;
  icon: IconName;
  iconTone?: IconTone;
  tone?: "brand" | "qiko" | "success";
  series?: number[];
  kind?: "bars" | "line";
  seriesLabel?: string;
};

export function OutcomeGrid({ tiles, label = "Outcomes" }: { tiles: OutcomeTile[]; label?: string }) {
  return (
    <section className={styles.outcomes} aria-label={label}>
      {tiles.map((tile) => {
        const body = (
          <>
            <span className={styles.tileCopy}>
              <span className={styles.tileLabel}>{tile.label}</span>
              <b className={`tabular ${styles.tileValue}`}>
                {tile.numeric !== undefined ? <CountUp value={tile.numeric} format={tile.format ?? ((n) => String(Math.round(n)))} /> : tile.value}
              </b>
              <span className={styles.tileSub}>{tile.sub}</span>
            </span>
            <span className={styles.tileSide}>
              <IconTile name={tile.icon} tone={tile.iconTone ?? "brand"} size="sm" />
              {tile.series ? <Spark values={tile.series} kind={tile.kind} tone={tile.tone ?? "brand"} width={64} height={26} label={tile.seriesLabel ?? tile.label} /> : null}
            </span>
          </>
        );
        return tile.href ? (
          <Link key={tile.key} href={tile.href} className={styles.tile} data-tone={tile.tone}>
            {body}
          </Link>
        ) : (
          <article key={tile.key} className={styles.tile} data-tone={tile.tone}>
            {body}
          </article>
        );
      })}
    </section>
  );
}

export function DecisionBanner({
  titleId = "move-title",
  kicker,
  context,
  title,
  summary,
  facts,
  action,
  link,
  tour,
}: {
  titleId?: string;
  kicker: string;
  context?: string;
  title: string;
  summary: string;
  facts: Array<{ icon: IconName; text: string }>;
  action?: ReactNode;
  link?: { href: string; label: string; external?: boolean };
  tour?: string;
}) {
  return (
    <section className={styles.move} aria-labelledby={titleId} data-tour={tour}>
      <div className={styles.moveLead}>
        <div className={styles.moveHead}>
          <IconTile name="pulse" tone="qiko" size="sm" />
          <p className="kicker kicker-qiko">{kicker}</p>
          {context ? <span className={styles.moveBlock}>{context}</span> : null}
        </div>
        <h2 id={titleId}>{title}</h2>
        <p className={styles.moveSummary}>{summary}</p>
      </div>
      <div className={styles.moveSide}>
        <ul className={styles.moveFacts}>
          {facts.map((fact) => (
            <li key={fact.text}>
              <Icon name={fact.icon} size={12} />
              {fact.text}
            </li>
          ))}
        </ul>
        {(action || link) && (
          <div className={styles.moveActions}>
            {action}
            {link ? (
              <Link href={link.href} className={styles.moveLink} {...(link.external ? { target: "_blank", rel: "noopener" } : {})}>
                {link.label} {link.external ? <Icon name="external" size={12} /> : <Icon name="arrowRight" size={12} />}
              </Link>
            ) : null}
          </div>
        )}
      </div>
    </section>
  );
}

export type RankedItem = {
  id: string;
  href: string;
  title: string;
  summary: string;
  area: string;
  priority?: "high" | "medium" | "low";
  actionLabel: string;
  icon: IconName;
  iconTone?: IconTone;
  meta?: ReactNode;
  aside?: ReactNode;
};

export function RankedList({ items }: { items: RankedItem[] }) {
  return (
    <ol className={styles.focusList}>
      {items.map((item, index) => (
        <li key={item.id}>
          <Link href={item.href} className={styles.focusRow} data-priority={item.priority}>
            <span className={styles.focusRank} aria-hidden="true">
              <span className={styles.focusRankNumber}>{index + 1}</span>
              <IconTile name={item.icon} tone={item.iconTone ?? "brand"} size="sm" className={styles.focusRankIcon} />
            </span>
            <span className={styles.focusCopy}>
              <span className={styles.focusTitle}>{item.title}</span>
              <span className={styles.focusWhy}>{item.summary}</span>
            </span>
            <span className={styles.focusMeta}>
              <span className={styles.focusArea} data-area={item.area}>
                {item.area}
              </span>
              {item.meta}
              <span className={styles.focusAction}>
                {item.actionLabel} <Icon name="arrowRight" size={13} />
              </span>
            </span>
          </Link>
          {item.aside}
        </li>
      ))}
    </ol>
  );
}

export function FocusPanel({
  id,
  title,
  sub,
  count,
  span,
  children,
  foot,
  tour,
}: {
  id: string;
  title: string;
  sub?: string;
  count?: number;
  span?: 2;
  children: ReactNode;
  foot?: ReactNode;
  tour?: string;
}) {
  return (
    <section className={`card ${styles.focus}`} aria-labelledby={id} data-span={span} data-tour={tour}>
      <div className={styles.focusHead}>
        <div>
          <h2 id={id}>{title}</h2>
          {sub ? <p className={styles.focusSub}>{sub}</p> : null}
        </div>
        {count !== undefined && count > 0 ? <span className="tag tabular">{count}</span> : null}
      </div>
      {children}
      {foot ? <div className={styles.focusFoot}>{foot}</div> : null}
    </section>
  );
}

export function WorkPanel({
  id,
  title,
  action,
  children,
  foot,
  className = "",
}: {
  id: string;
  title: string;
  action?: ReactNode;
  children: ReactNode;
  foot?: ReactNode;
  className?: string;
}) {
  return (
    <section className={`card ${styles.panel} ${className}`} aria-labelledby={id}>
      <div className={styles.panelHead}>
        <h2 id={id}>{title}</h2>
        {action}
      </div>
      {children}
      {foot ? <div className={styles.panelFoot}>{foot}</div> : null}
    </section>
  );
}

export function LinkList({
  items,
}: {
  items: Array<{ id: string; href?: string; title: string; detail: string }>;
}) {
  return (
    <ul className={styles.linkList}>
      {items.map((item) => (
        <li key={item.id}>
          {item.href ? (
            <Link href={item.href} className={styles.linkRow}>
              <b>{item.title}</b>
              <span>{item.detail}</span>
            </Link>
          ) : (
            <div className={styles.linkRow}>
              <b>{item.title}</b>
              <span>{item.detail}</span>
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

export function Columns({ children, variant = "pair" }: { children: ReactNode; variant?: "pair" | "three" | "rail" }) {
  const className = variant === "three" ? styles.primaryRow : variant === "rail" ? styles.secondaryRow : styles.pair;
  return <div className={className}>{children}</div>;
}
