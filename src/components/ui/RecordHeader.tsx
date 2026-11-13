import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import Icon from "./Icon";
import styles from "./RecordHeader.module.css";

export interface RecordFact {
  label: string;
  value: ReactNode;
  href?: string;
  tone?: "default" | "danger" | "success" | "qiko";
}

interface RecordHeaderProps {
  back: { href: string; label: string };
  /** Avatar, initials or icon block shown left of the title. */
  mark?: ReactNode;
  /** Colour the mark, e.g. `avatarStyle(name)` for a person or organisation. */
  markStyle?: CSSProperties;
  title: string;
  /** Status and category chips rendered beside the title. */
  chips?: ReactNode;
  /** One quiet line under the title: who, where, what. */
  meta?: ReactNode;
  /** Key numbers for this record. Keep to six; each can link to its source. */
  facts?: RecordFact[];
  actions?: ReactNode;
}

/**
 * Shared header for record pages (account, requirement, …): identity on top, the facts that
 * matter on one strip underneath, actions on the right. Keeps detail pages reading alike.
 */
export default function RecordHeader({ back, mark, markStyle, title, chips, meta, facts = [], actions }: RecordHeaderProps) {
  return (
    <header className={styles.header}>
      <Link href={back.href} className={styles.back}>
        <Icon name="arrowLeft" size={13} />
        {back.label}
      </Link>
      <div className={styles.top}>
        {mark ? (
          <div className={styles.mark} style={markStyle}>
            {mark}
          </div>
        ) : null}
        <div className={styles.identity}>
          <div className={styles.titleRow}>
            <h1>{title}</h1>
            {chips ? <div className={styles.chips}>{chips}</div> : null}
          </div>
          {meta ? <p className={styles.meta}>{meta}</p> : null}
        </div>
        {actions ? <div className={styles.actions}>{actions}</div> : null}
      </div>
      {facts.length > 0 ? (
        <dl className={styles.facts}>
          {facts.map((fact) => {
            const body = (
              <>
                <dt>{fact.label}</dt>
                <dd data-tone={fact.tone ?? "default"}>{fact.value}</dd>
              </>
            );
            return fact.href ? (
              <Link key={fact.label} href={fact.href} className={styles.fact}>
                {body}
              </Link>
            ) : (
              <div key={fact.label} className={styles.fact}>
                {body}
              </div>
            );
          })}
        </dl>
      ) : null}
    </header>
  );
}
