"use client";

import { useState, type FormEvent } from "react";
import { crm } from "@/lib/crm-store";
import { formatDateTime, initials } from "@/lib/format";
import Button from "@/components/ui/Button";
import Icon, { type IconName } from "@/components/ui/Icon";
import { ConfirmDialog } from "@/components/ui/Overlay";
import { SkeletonRows, useWorkspaceData } from "@/components/ui/bits";
import { useWorkspace } from "@/components/shell/WorkspaceContext";
import { AUTOMATION_RULES, automationEnabled, automationHistory } from "@/lib/automations";
import styles from "./settings.module.css";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MEMBERS_PER_PAGE = 10;

const SOURCES: { name: string; icon: IconName; scope: string; status: "demo" | "future"; note: string }[] = [
  { name: "Qiko Signal", icon: "scan", scope: "Registrations, free scans, reports, product activity", status: "demo", note: "Sample data · API integration pending validation" },
  { name: "Qiko website", icon: "globe", scope: "Contact and assessment enquiries", status: "demo", note: "Sample data · submission flow not yet connected" },
  { name: "Qiko Admin V2", icon: "users", scope: "Users, account records, activity", status: "demo", note: "Sample data · backend services not yet connected" },
  { name: "Qiko Core CRM store", icon: "database", scope: "Lead status, notes, ownership, tasks", status: "demo", note: "Saved in this browser (local storage)" },
  { name: "Qiko Pulse · Tessiant", icon: "pulse", scope: "Knowledge blocks, insights, accept/reject, value attribution", status: "demo", note: "Rules on shared Tessiant CRM data — no automatic model training" },
  { name: "Tessiant staffing", icon: "users", scope: "Talent network, requirements, assignments, Pulse events", status: "demo", note: "Sample staffing data in this browser workspace" },
  { name: "Salesforce / SharePoint", icon: "database", scope: "External CRM and document repositories", status: "future", note: "Not connected" },
];

export default function SettingsPage() {
  const { state } = useWorkspaceData();
  const { session, toast } = useWorkspace();
  const [name, setName] = useState(session.name);
  const [member, setMember] = useState({ name: "", email: "", role: "" });
  const [memberPage, setMemberPage] = useState(1);
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
    setMemberPage(Math.ceil((state.members.length + 1) / MEMBERS_PER_PAGE));
    setMember({ name: "", email: "", role: "" });
    setMemberError("");
    toast(`${member.name.trim()} added to the team`);
  };

  const removing = state.members.find((item) => item.id === removeId);
  const assignedCount = (id: string) => state.leads.filter((lead) => lead.ownerId === id).length + state.tasks.filter((task) => task.ownerId === id).length;
  const memberPages = Math.max(1, Math.ceil(state.members.length / MEMBERS_PER_PAGE));
  const currentMemberPage = Math.min(memberPage, memberPages);
  const visibleMembers = state.members.slice((currentMemberPage - 1) * MEMBERS_PER_PAGE, currentMemberPage * MEMBERS_PER_PAGE);

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Settings</h1>
          <p className="subtitle">Profile, team, automation rules and data sources.</p>
        </div>
      </header>

      <div className="notice-banner" role="note">
        <div>
          <b>Tessiant operating workspace</b>
          <div>
            Powered by Qiko Core. Sample data and connector status live here so the main business screens stay focused on work.
          </div>
        </div>
      </div>

      <div className={styles.grid}>
        <section className="card">
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
              <h2>Sales team · {state.members.length}</h2>
              <p className="card-sub">Team members can own leads and be assigned tasks.</p>
            </div>
          </div>
          <div className="card-body">
            <ul className={styles.members}>
              {visibleMembers.map((item) => (
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
            {memberPages > 1 && (
              <nav className={styles.memberPager} aria-label="Sales team pagination">
                <span>Page {currentMemberPage} of {memberPages}</span>
                <div>
                  <Button size="small" variant="secondary" icon="chevronLeft" disabled={currentMemberPage === 1} onClick={() => setMemberPage(currentMemberPage - 1)} aria-label="Previous team page" />
                  {Array.from({ length: memberPages }, (_, index) => index + 1).map((page) => (
                    <button type="button" key={page} className={styles.memberPageButton} aria-current={page === currentMemberPage ? "page" : undefined} onClick={() => setMemberPage(page)}>
                      {page}
                    </button>
                  ))}
                  <Button size="small" variant="secondary" icon="chevronRight" disabled={currentMemberPage === memberPages} onClick={() => setMemberPage(currentMemberPage + 1)} aria-label="Next team page" />
                </div>
              </nav>
            )}
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

        <section className={`card ${styles.wide}`} id="automations">
          <div className="card-head">
            <div>
              <h2>Automations · human in the loop</h2>
              <p className="card-sub">Each rule proposes; nothing runs until someone approves it on Home. {automationHistory(state).filter((item) => item.decision === "done").length} approved so far.</p>
            </div>
            <span className="chip chip-ai">Qiko</span>
          </div>
          <ul className={styles.sources}>
            {AUTOMATION_RULES.map((rule) => (
              <li key={rule.id}>
                <span className={styles.sourceIcon}><Icon name="zap" size={16} /></span>
                <span className={styles.memberText}>
                  <b>{rule.name}</b>
                  <small>When: {rule.trigger}</small>
                </span>
                <span className={styles.sourceNote}>Then: {rule.action}</span>
                <label className={styles.toggle}>
                  <input type="checkbox" checked={automationEnabled(state, rule.id)} onChange={(event) => { crm.setAutomationPref(rule.id, event.target.checked); toast(event.target.checked ? `${rule.name} on` : `${rule.name} off`, "info"); }} />
                  <span>{automationEnabled(state, rule.id) ? "On" : "Off"}</span>
                </label>
              </li>
            ))}
            <li>
              <span className={styles.sourceIcon}><Icon name="sun" size={16} /></span>
              <span className={styles.memberText}>
                <b>Morning brief</b>
                <small>The Home read as a page outside the app, with copy-as-text for email or chat.</small>
              </span>
              <span className={styles.sourceNote}>Scheduled delivery needs an email or chat connector; none is attached yet.</span>
              <a href="/brief" target="_blank" rel="noopener" className="link-button">Open today&apos;s brief</a>
            </li>
          </ul>
        </section>

        <section className={`card ${styles.wide}`}>
          <div className="card-head">
            <div>
              <h2>Where workspace data comes from</h2>
              <p className="card-sub">This workspace runs on sample data behind a replaceable data layer. Nothing here is live production data.</p>
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
                <span className={`chip ${source.status === "demo" ? "chip-demo" : ""}`}>{source.status === "demo" ? "Sample data" : "Coming soon"}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className={`card ${styles.wide}`}>
          <div className="card-head">
            <div>
              <h2>Reset workspace data</h2>
              <p className="card-sub">Restore the original sample leads, activity and tasks. Your changes in this browser will be replaced. Sample data last generated {formatDateTime(state.seededAt)}.</p>
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
          title="Reset the workspace data?"
          description="All leads, notes, tasks and decisions return to the original sample data."
          confirmLabel="Reset data"
          onCancel={() => setConfirmReset(false)}
          onConfirm={() => {
            crm.resetDemoData();
            setConfirmReset(false);
            toast("Sample data restored");
          }}
        />
      )}
    </div>
  );
}
