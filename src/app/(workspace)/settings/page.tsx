"use client";

import { useState, type FormEvent } from "react";
import { crm } from "@/lib/crm-store";
import { formatDateTime, initials } from "@/lib/format";
import Button from "@/components/ui/Button";
import Icon, { type IconName } from "@/components/ui/Icon";
import { ConfirmDialog } from "@/components/ui/Overlay";
import { SkeletonRows, useWorkspaceData } from "@/components/ui/bits";
import { useWorkspace } from "@/components/shell/WorkspaceContext";
import styles from "./settings.module.css";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const SOURCES: { name: string; icon: IconName; scope: string; status: "demo" | "future"; note: string }[] = [
  { name: "Qiko Signal", icon: "scan", scope: "Registrations, free scans, reports, product activity", status: "demo", note: "Sample data · API integration pending validation" },
  { name: "Qiko website", icon: "globe", scope: "Contact and assessment enquiries", status: "demo", note: "Sample data · submission flow not yet connected" },
  { name: "Qiko Admin V2", icon: "users", scope: "Users, account records, activity", status: "demo", note: "Sample data · backend services not yet connected" },
  { name: "Qiko Core CRM store", icon: "database", scope: "Lead status, notes, ownership, tasks", status: "demo", note: "Saved in this browser (local storage)" },
  { name: "Qiko Pulse", icon: "pulse", scope: "AI insights and recommendations", status: "future", note: "Future integration · interface ready" },
];

export default function SettingsPage() {
  const { state } = useWorkspaceData();
  const { session, toast } = useWorkspace();
  const [name, setName] = useState(session.name);
  const [member, setMember] = useState({ name: "", email: "", role: "" });
  const [memberError, setMemberError] = useState("");
  const [removeId, setRemoveId] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

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

  const addMember = (event: FormEvent) => {
    event.preventDefault();
    if (member.name.trim().length < 2) return setMemberError("Enter the teammate's name.");
    if (!EMAIL.test(member.email.trim())) return setMemberError("Enter a valid email address.");
    if (state.members.some((item) => item.email.toLowerCase() === member.email.trim().toLowerCase())) return setMemberError("This person is already on the team.");
    crm.addMember({ name: member.name.trim(), email: member.email.trim().toLowerCase(), role: member.role.trim() || "Team member" });
    setMember({ name: "", email: "", role: "" });
    setMemberError("");
    toast(`${member.name.trim()} added to the team`);
  };

  const removing = state.members.find((item) => item.id === removeId);
  const assignedCount = (id: string) => state.leads.filter((lead) => lead.ownerId === id).length + state.tasks.filter((task) => task.ownerId === id).length;

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <p className="kicker">Account</p>
          <h1>Settings</h1>
          <p className="subtitle">Manage your profile, your sales team and the data powering this workspace.</p>
        </div>
      </header>

      <div className={styles.grid}>
        <section className="card">
          <div className="card-head">
            <div>
              <p className="kicker">Profile</p>
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
              <span className="field-hint">Used in your greeting, on tasks and in activity history.</span>
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

        <section className="card">
          <div className="card-head">
            <div>
              <p className="kicker">Team</p>
              <h2>Sales team · {state.members.length}</h2>
              <p className="card-sub">Team members can own leads and be assigned tasks.</p>
            </div>
          </div>
          <div className="card-body">
            <ul className={styles.members}>
              {state.members.map((item) => (
                <li key={item.id}>
                  <span className="avatar">{initials(item.name)}</span>
                  <span className={styles.memberText}>
                    <b>{item.name}{item.id === "me" && <span className="tag">You</span>}</b>
                    <small>{item.email} · {item.role}</small>
                  </span>
                  <span className={styles.assigned}>{assignedCount(item.id)} assigned</span>
                  {item.id !== "me" && <Button size="small" variant="ghost" icon="trash" aria-label={`Remove ${item.name}`} onClick={() => setRemoveId(item.id)} />}
                </li>
              ))}
            </ul>
            <form className={styles.addMember} onSubmit={addMember} noValidate>
              <p className="field-label">Add a teammate</p>
              <div className={styles.addRow}>
                <input className="input" value={member.name} onChange={(event) => { setMember({ ...member, name: event.target.value }); setMemberError(""); }} placeholder="Full name" aria-label="Teammate name" />
                <input className="input" type="email" value={member.email} onChange={(event) => { setMember({ ...member, email: event.target.value }); setMemberError(""); }} placeholder="Email" aria-label="Teammate email" />
                <input className="input" value={member.role} onChange={(event) => setMember({ ...member, role: event.target.value })} placeholder="Role (optional)" aria-label="Teammate role" />
                <Button type="submit" icon="userPlus">Add</Button>
              </div>
              {memberError && <span className="field-error">{memberError}</span>}
            </form>
          </div>
        </section>

        <section className={`card ${styles.wide}`}>
          <div className="card-head">
            <div>
              <p className="kicker">Data sources</p>
              <h2>Where workspace data comes from</h2>
              <p className="card-sub">This V1 runs on clearly labelled demo data behind a replaceable data layer. Nothing here is presented as live production data.</p>
            </div>
            <span className="chip chip-demo">Demo mode</span>
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
                <span className={`chip ${source.status === "demo" ? "chip-demo" : ""}`}>{source.status === "demo" ? "Demo data" : "Coming soon"}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className={`card ${styles.wide}`}>
          <div className="card-head">
            <div>
              <p className="kicker">Workspace data</p>
              <h2>Reset demo workspace</h2>
              <p className="card-sub">Restore the original sample leads, activity and tasks. Your changes in this browser will be replaced. Demo data last generated {formatDateTime(state.seededAt)}.</p>
            </div>
            <Button variant="danger" icon="refresh" onClick={() => setConfirmReset(true)}>Reset data</Button>
          </div>
        </section>
      </div>

      {removing && (
        <ConfirmDialog
          tone="danger"
          title={`Remove ${removing.name}?`}
          description={assignedCount(removing.id) ? `Their ${assignedCount(removing.id)} assigned leads and tasks will become unassigned.` : "They have no assigned leads or tasks."}
          confirmLabel="Remove"
          onCancel={() => setRemoveId(null)}
          onConfirm={() => {
            crm.removeMember(removing.id);
            toast(`${removing.name} removed`, "info");
            setRemoveId(null);
          }}
        />
      )}
      {confirmReset && (
        <ConfirmDialog
          tone="danger"
          title="Reset the demo workspace?"
          description="All leads, notes, tasks and decisions return to the original sample data."
          confirmLabel="Reset data"
          onCancel={() => setConfirmReset(false)}
          onConfirm={() => {
            crm.resetDemoData();
            setConfirmReset(false);
            toast("Demo data restored");
          }}
        />
      )}
    </div>
  );
}
