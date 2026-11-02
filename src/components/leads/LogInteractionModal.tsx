"use client";

import { useState, type FormEvent } from "react";
import { crm } from "@/lib/crm-store";
import Button from "@/components/ui/Button";
import Icon from "@/components/ui/Icon";
import { Modal } from "@/components/ui/Overlay";
import { useWorkspace } from "@/components/shell/WorkspaceContext";
import { useDictation } from "./useDictation";
import styles from "./LogInteraction.module.css";

const CHANNELS = ["Call", "Email", "WhatsApp", "Meeting", "Message"] as const;

export default function LogInteractionModal({ leadId, leadName, onClose }: { leadId: string; leadName: string; onClose: () => void }) {
  const { toast } = useWorkspace();
  const [channel, setChannel] = useState<(typeof CHANNELS)[number]>("Call");
  const [summary, setSummary] = useState("");
  const [error, setError] = useState("");
  const voice = useDictation();

  const applyTranscript = (value: string) => {
    setSummary(value);
    setError("");
    voice.clearError();
  };

  const toggleVoice = () => {
    if (voice.listening) {
      voice.stop();
      return;
    }
    voice.start(summary, applyTranscript);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    voice.stop();
    if (summary.trim().length < 3) {
      setError("Add a short summary of what happened.");
      return;
    }
    crm.logInteraction(leadId, channel, summary.trim());
    toast(`${channel} with ${leadName} logged`);
    onClose();
  };

  return (
    <Modal
      kicker="Activity"
      title={`Log interaction with ${leadName}`}
      description="Recorded on the lead's timeline. New leads move to Contacted automatically."
      onClose={() => { voice.stop(); onClose(); }}
      size="small"
      footer={
        <>
          <Button variant="secondary" onClick={() => { voice.stop(); onClose(); }}>Cancel</Button>
          <Button type="submit" form="interaction-form" icon="check">Log {channel === "WhatsApp" ? "WhatsApp" : channel.toLowerCase()}</Button>
        </>
      }
    >
      <form id="interaction-form" className="form-grid" onSubmit={submit} noValidate>
        <div className="field">
          <span className="field-label">Channel</span>
          <div className="segmented" role="group" aria-label="Channel">
            {CHANNELS.map((item) => (
              <button type="button" key={item} aria-pressed={channel === item} onClick={() => setChannel(item)}>
                {item}
              </button>
            ))}
          </div>
        </div>
        <div className="field">
          <span>Summary</span>
          <div className={styles.summaryBox}>
            <textarea
              className={`textarea ${styles.summary} ${voice.listening ? styles.summaryLive : ""}`}
              rows={4}
              value={summary}
              onChange={(event) => {
                const value = event.target.value;
                setSummary(value);
                setError("");
                voice.noteTyped(value);
              }}
              placeholder="e.g. 20-minute call — interested in the Growth plan, wants pricing for 3 brands"
              aria-invalid={Boolean(error)}
              data-autofocus
            />
            <div className={styles.dock}>
              {voice.listening && (
                <span className={styles.side} aria-hidden="true">
                  {voice.levels.filter((_, index) => index % 2 === 0).slice(0, 5).map((level, index, list) => (
                    <i key={index} className={styles.bar} style={{ height: `${4 + level * 14}px`, opacity: 0.4 + ((index + 1) / list.length) * 0.6 }} />
                  ))}
                </span>
              )}
              <button
                type="button"
                className={`${styles.mic} ${voice.listening ? styles.micOn : ""}`}
                aria-pressed={voice.listening}
                aria-label={voice.listening ? "Stop voice note" : "Start voice note"}
                onClick={toggleVoice}
              >
                <Icon name="mic" size={13} />
              </button>
            </div>
            <span className="sr-only" aria-live="polite">{voice.listening ? "Listening. Words are added to the summary as you speak." : ""}</span>
          </div>
          {(error || voice.error) && <span className="field-error">{error || voice.error}</span>}
        </div>
      </form>
    </Modal>
  );
}
