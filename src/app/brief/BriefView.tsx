"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useCrm, useSession } from "@/lib/crm-store";
import { briefAsText, morningBrief } from "@/lib/morning-brief";
import { firstName, greeting } from "@/lib/format";
import Icon from "@/components/ui/Icon";
import styles from "./brief.module.css";

/**
 * The morning brief outside the app: one sheet, readable on a phone before the first call, with
 * the same numbers and priorities Home shows. Copy as text drops it into email or chat.
 */
export default function BriefView() {
  const state = useCrm();
  const session = useSession();
  const [copied, setCopied] = useState(false);
  const brief = useMemo(() => (state ? morningBrief(state) : null), [state]);
  if (!state || !brief) return <main className={styles.page} />;
  const name = firstName(session?.name ?? "there");

  const copy = async () => {
    const text = briefAsText(brief, name);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      window.prompt("Copy the brief", text);
    }
  };

  return (
    <main className={styles.page}>
      <article className={styles.sheet}>
        <header className={styles.masthead}>
          <div>
            <div className={styles.brand}>
              <span className={styles.mark}>Q</span>
              <span>Qiko · Morning brief</span>
            </div>
            <h1>
              {greeting(new Date())}, {name}.
            </h1>
            <p>{brief.date} · built from the workspace as it stands now.</p>
          </div>
          <div className={styles.tools}>
            <button type="button" onClick={copy}>
              <Icon name={copied ? "check" : "copy"} size={13} /> {copied ? "Copied" : "Copy as text"}
            </button>
            <button type="button" onClick={() => window.print()}>
              <Icon name="file" size={13} /> Print
            </button>
            <Link href="/">
              Open workspace <Icon name="arrowRight" size={12} />
            </Link>
          </div>
        </header>

        <section className={styles.section}>
          <h2>Numbers</h2>
          <div className={styles.numbers}>
            {brief.numbers.map((item) => (
              <div key={item.label}>
                <b className="tabular">{item.value}</b>
                <span>{item.label}</span>
                <small>{item.sub}</small>
              </div>
            ))}
          </div>
        </section>

        {brief.bestMove ? (
          <section className={styles.section}>
            <h2>Best next move</h2>
            <div className={styles.move}>
              <b>{brief.bestMove.title}</b>
              <p>{brief.bestMove.summary}</p>
            </div>
          </section>
        ) : null}

        <section className={styles.section}>
          <h2>What matters today</h2>
          {brief.priorities.length === 0 ? (
            <p className={styles.quiet}>Nothing urgent. A good day to originate.</p>
          ) : (
            <ol className={styles.list}>
              {brief.priorities.map((item) => (
                <li key={item.id}>
                  <div>
                    <b>{item.title}</b>
                    <p>{item.summary}</p>
                    <small>{item.actionLabel}</small>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>

        {brief.proposals.length > 0 ? (
          <section className={styles.section}>
            <h2>Waiting for your OK</h2>
            <ul className={styles.plain}>
              {brief.proposals.map((item) => (
                <li key={item.id}>
                  <b>{item.title}</b>
                  <span>{item.rule.name}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {brief.changes.length > 0 ? (
          <section className={styles.section}>
            <h2>What changed this week</h2>
            <ul className={styles.plain}>
              {brief.changes.map((item) => (
                <li key={item.title}>
                  <b>{item.title}</b>
                  <span>{item.detail}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <footer className={styles.foot}>
          <span>
            Qiko&apos;s record: {brief.record.actedOn} actions taken from its calls · {brief.record.outcomes} outcomes recorded
            {brief.record.accuracyPct !== null ? ` · ${brief.record.accuracyPct}% rated right` : ""}
          </span>
          <span>Scheduled delivery needs an email or chat connector.</span>
        </footer>
      </article>
    </main>
  );
}
