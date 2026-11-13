"use client";

import { useState } from "react";
import { parseCv, SAMPLE_CV, type ParsedCv } from "@/lib/cv-parser";
import Button from "@/components/ui/Button";
import Icon from "@/components/ui/Icon";
import IconTile from "@/components/ui/IconTile";
import styles from "./CvParser.module.css";

/**
 * Paste a CV, let Qiko read it into the profile form. Deterministic keyword parse against the
 * network's own vocabulary; everything it fills stays editable before saving.
 */
export default function CvParser({ vocabulary, onApply }: { vocabulary: { skills: string[]; sectors: string[] }; onApply: (parsed: ParsedCv) => void }) {
  const [text, setText] = useState("");
  const [parsed, setParsed] = useState<ParsedCv | null>(null);
  const [open, setOpen] = useState(false);

  const run = (source: string) => {
    const result = parseCv(source, vocabulary);
    setParsed(result);
    onApply(result);
  };

  return (
    <section className={styles.box} data-open={open || undefined}>
      <div className={styles.head}>
        <IconTile name="sparkles" tone="qiko" size="sm" />
        <div className={styles.copy}>
          <b>Start from a CV</b>
          <small>Paste the text and Qiko fills skills, sectors, seniority, rate and summary. Check before saving.</small>
        </div>
        {!open ? (
          <Button size="small" variant="qiko" icon="file" onClick={() => setOpen(true)}>
            Paste CV
          </Button>
        ) : null}
      </div>
      {open ? (
        <>
          <textarea className="textarea" rows={6} value={text} onChange={(event) => setText(event.target.value)} placeholder="Paste the CV text here…" aria-label="CV text" />
          <div className={styles.actions}>
            <Button size="small" variant="qiko" icon="sparkles" disabled={text.trim().length < 20} onClick={() => run(text)}>
              Parse with Qiko
            </Button>
            <button
              type="button"
              className="link-button"
              onClick={() => {
                setText(SAMPLE_CV);
                run(SAMPLE_CV);
              }}
            >
              Use a sample CV
            </button>
            {parsed ? (
              <span className={styles.result}>
                <Icon name="check" size={12} strokeWidth={2.6} /> Found {parsed.found.join(", ")} · {parsed.coverage}% of the form
              </span>
            ) : null}
          </div>
          <p className={styles.note}>Keyword match against the Talent Network vocabulary. No document leaves this browser.</p>
        </>
      ) : null}
    </section>
  );
}
