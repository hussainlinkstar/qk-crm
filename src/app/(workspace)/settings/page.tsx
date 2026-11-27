"use client";

import { useState, type FormEvent } from "react";
import { crm } from "@/lib/crm-store";
import { formatDateTime, initials } from "@/lib/format";
import Button from "@/components/ui/Button";
import Icon, { type IconName } from "@/components/ui/Icon";
import { SkeletonRows, useWorkspaceData } from "@/components/ui/bits";
import { useWorkspace } from "@/components/shell/WorkspaceContext";
import styles from "./settings.module.css";

const SOURCES: { name: string; icon: IconName; scope: string; note: string }[] = [
  { name: "Qiko Signal", icon: "scan", scope: "Registrations, free scans, reports, product activity", note: "Sample data · API integration pending validation" },
];

export default function SettingsPage() {
  const { state } = useWorkspaceData();
  const { session, toast } = useWorkspace();
  const [name, setName] = useState(session.name);

  if (!state) {
    return (
      <div className="page">
        <SkeletonRows rows={4} height={120} />
      </div>
    );
  }

  const saveProfile = (event: FormEvent) => {
    event.preventDefault();
    if (name.trim().length < 2) {
      toast("Enter your name", "error");
      return;
    }
    crm.updateProfile(name.trim());
    toast("Profile updated");
  };

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Settings</h1>
          <p className="subtitle">Your profile and where Signal data comes from.</p>
        </div>
      </header>

      <div className="notice-banner" role="note">
        <div>
          <b>Qiko operating workspace</b>
          <div>Powered by Qiko Core. Signal sample data stays in this browser.</div>
        </div>
      </div>

      <div className={styles.grid}>
        <section className={`card ${styles.wide}`}>
          <div className="card-head">
            <div>
              <h2>Your details</h2>
            </div>
          </div>
          <form className={`card-body form-grid ${styles.profile}`} onSubmit={saveProfile}>
            <div className={styles.me}>
              <span className="avatar avatar-lg">{initials(name || session.name)}</span>
              <div>
                <b>{session.name}</b>
                <small>Signed in {formatDateTime(session.signedInAt)}</small>
              </div>
            </div>
            <label className="field">
              <span>Display name</span>
              <input className="input" value={name} onChange={(event) => setName(event.target.value)} />
              <span className="field-hint">Used in your greeting and on activity.</span>
            </label>
            <label className="field">
              <span>Email</span>
              <input className="input" value={session.email} disabled />
            </label>
            <div className={styles.formEnd}>
              <Button type="submit" icon="check" disabled={name.trim() === session.name}>Save profile</Button>
            </div>
          </form>
        </section>

        <section className={`card ${styles.wide}`}>
          <div className="card-head">
            <div>
              <h2>Where Signal data comes from</h2>
              <p className="card-sub">This workspace runs on sample data. Nothing here is a live send.</p>
            </div>
          </div>
          <ul className={styles.sources}>
            {SOURCES.map((source) => (
              <li key={source.name}>
                <span className={styles.sourceIcon}><Icon name={source.icon} size={16} /></span>
                <span className={styles.memberText}>
                  <b>{source.name}</b>
                  <small>{source.scope}</small>
                </span>
                <span className={styles.sourceNote}>{source.note}</span>
                <span className="chip chip-demo">Sample data</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
