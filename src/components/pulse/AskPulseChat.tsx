"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import Button from "@/components/ui/Button";
import Icon from "@/components/ui/Icon";
import { Drawer } from "@/components/ui/Overlay";
import { askPulseCatalog, type AskPulseAnswer } from "@/lib/pulse-presentation";
import type { CrmState } from "@/lib/types";
import styles from "@/app/(workspace)/pulse/pulse.module.css";

export default function AskPulseChat({
  state,
  realised,
  embedded = false,
}: {
  state: CrmState;
  realised: number;
  embedded?: boolean;
}) {
  const catalog = useMemo(() => askPulseCatalog(state, realised), [state, realised]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<AskPulseAnswer | null>(null);
  const [custom, setCustom] = useState("");

  const ask = (item: AskPulseAnswer) => setActive(item);

  const submitCustom = () => {
    const text = custom.trim().toLowerCase();
    if (!text) return;
    const hit = catalog.find((item) => item.question.toLowerCase().includes(text) || text.includes(item.question.toLowerCase().slice(0, 18)));
    if (hit) {
      setActive(hit);
      setCustom("");
      return;
    }
    setActive({
      question: custom.trim(),
      answer: "Not supported from the Tessiant records. Ask about capability gaps, ending assignments, sector demand, thin coverage, or commercial follow-ups.",
      links: [{ label: "Browse insights", href: "/pulse/insights" }],
    });
    setCustom("");
  };

  const body = (
    <>
      <div className={styles.chatList}>
        {catalog.map((item) => (
          <button key={item.question} type="button" className={styles.chatBtn} onClick={() => ask(item)}>
            {item.question}
          </button>
        ))}
      </div>
      <div className={styles.actions} style={{ marginTop: 12 }}>
        <input
          className="input"
          value={custom}
          onChange={(event) => setCustom(event.target.value)}
          placeholder="Ask Pulse…"
          aria-label="Ask Pulse"
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              submitCustom();
            }
          }}
        />
        <Button size="small" onClick={submitCustom} disabled={!custom.trim()}>
          Ask
        </Button>
      </div>
      {active ? (
        <div className={styles.askAnswer}>
          <b>{active.question}</b>
          <p style={{ marginTop: 8 }}>{active.answer}</p>
          {active.links.length ? (
            <div className={styles.askLinks}>
              {active.links.map((link) => (
                <Link key={link.href + link.label} href={link.href} className="text-link">
                  {link.label}
                </Link>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </>
  );

  if (embedded) {
    return (
      <article className="card">
        <div className="card-head">
          <div>
            <h2>Ask Pulse</h2>
            <p className="card-sub">Grounded answers from Tessiant CRM records.</p>
          </div>
        </div>
        <div className="card-body">{body}</div>
      </article>
    );
  }

  return (
    <>
      <button
        type="button"
        className={`${styles.askLaunch} ${open ? styles.askLaunchOpen : ""}`}
        onClick={() => setOpen(true)}
        aria-label="Chat with Pulse"
        aria-expanded={open}
      >
        <Icon name="message" size={14} />
        <span>Chat with Pulse</span>
        <kbd>Ctrl K</kbd>
      </button>
      {open ? (
        <Drawer kicker="Qiko Pulse" title="Chat with Pulse" onClose={() => setOpen(false)} width={420}>
          <p className="muted" style={{ marginBottom: 12 }}>
            Answers stay inside Pulse and only use Tessiant records.
          </p>
          {body}
        </Drawer>
      ) : null}
    </>
  );
}
