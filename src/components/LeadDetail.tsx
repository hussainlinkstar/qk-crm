import { useState } from "react";
import Button from "./Button";
import styles from "./LeadDetail.module.css";

interface LeadDetailProps {
  lead: { id: number; name: string; email: string; company: string; source: string; activity: string; time: string; status: string; score: number };
  taskCreated: boolean;
  onClose: () => void;
  onCreateTask: () => void;
}

export default function LeadDetail({ lead, taskCreated, onClose, onCreateTask }: LeadDetailProps) {
  const [centerTab, setCenterTab] = useState<"upcoming" | "history" | "notes">("upcoming");
  const initials = lead.name.split(" ").map((part) => part[0]).join("");

  return (
    <section className={styles.overlay} role="dialog" aria-modal="true" aria-label={`${lead.name} lead details`}>
      <aside className={styles.profile}>
        <button className={styles.back} type="button" onClick={onClose}>← <span>Back to leads</span></button>
        <div className={styles.avatar}>{initials}</div>
        <h2>{lead.name}</h2>
        <p className={styles.email}>{lead.email}</p>
        <Button variant="primary" fullWidth>Convert to customer</Button>
        <div className={styles.tabs}><button className={styles.active}>Activity</button><button>Details</button></div>
        <dl className={styles.details}>
          <div><dt>Company</dt><dd>{lead.company}</dd></div>
          <div><dt>Source</dt><dd>{lead.source}</dd></div>
          <div><dt>Status</dt><dd>{lead.status}</dd></div>
          <div><dt>Engagement</dt><dd>{lead.score}/100</dd></div>
        </dl>
      </aside>

      <main className={styles.timeline}>
        <div className={styles.timelineHeader}><div><span>WORKFLOW</span><h2>Activity</h2></div><Button variant="secondary" onClick={onCreateTask} disabled={taskCreated}>{taskCreated ? "Task created" : "+ Create task"}</Button></div>
        <nav className={styles.centerTabs} aria-label="Lead activity sections">
          <button type="button" className={centerTab === "upcoming" ? styles.active : ""} onClick={() => setCenterTab("upcoming")}>Upcoming</button>
          <button type="button" className={centerTab === "history" ? styles.active : ""} onClick={() => setCenterTab("history")}>History</button>
          <button type="button" className={centerTab === "notes" ? styles.active : ""} onClick={() => setCenterTab("notes")}>Notes <span>1</span></button>
        </nav>
        {centerTab === "upcoming" && <>
          <div className={styles.sectionTitle}>Upcoming activity</div>
          <article className={styles.activityCard}>
            <div className={styles.activityIcon}>☎</div>
            <div className={styles.activityBody}><strong>Pre-demo Qualification</strong><p>Activity created by Jane Cooper</p></div>
            <div className={styles.activityMeta}><span>Due: <b>Today</b></span><time>9:30 AM</time><button type="button" aria-label="More options">•••</button></div>
            <p className={styles.activityDescription}>Reach out to potential clients via email, phone, or other communication channels. Introduce the product, understand their needs, and briefly explain the benefits.</p>
          </article>
          <article className={styles.activityCard}>
            <div className={styles.calendarIcon}>▣</div>
            <div className={styles.activityBody}><strong>Calendar: Intro meeting with {lead.name}</strong><p>Activity created by Jane Cooper</p></div>
            <div className={styles.activityMeta}><span>Due: <b>Today</b></span><time>10:30 AM</time><button type="button" aria-label="More options">•••</button></div>
            <p className={styles.activityDescription}>Hi {lead.name.split(" ")[0]}, connect with our team to discuss your requirements.<br /><a href="#zoom-meeting">Zoom meeting link</a></p>
          </article>
          <article className={styles.activityCard}>
            <div className={styles.calendarIcon}>▣</div>
            <div className={styles.activityBody}><strong>Calendar: Product demo for {lead.company}</strong><p>Activity created by Jane Cooper</p></div>
            <div className={styles.activityMeta}><span>Due: <b>Today</b></span><time>12:00 PM</time><button type="button" aria-label="More options">•••</button></div>
            <p className={styles.activityDescription}>A guided product demo covering {lead.company}&apos;s business goals.<br /><a href="#zoom-meeting">Zoom meeting link</a></p>
          </article>
        </>}
        {centerTab === "history" && <>
          <div className={styles.sectionTitle}>Activity history</div>
          <div className={styles.historyGroup}><span>Today</span>
            <article className={styles.historyCard}><div className={styles.historyIcon}>☎</div><div><strong>Pre-demo qualification</strong><p>Jane Cooper logged a call with {lead.name}</p></div><time>10 min ago</time></article>
            <article className={styles.historyCard}><div className={styles.historyIcon}>▣</div><div><strong>Demo link sent to {lead.name}</strong><p>Jane Cooper shared the Zoom meeting link for {lead.company}</p></div><time>Yesterday</time></article>
          </div>
          <div className={styles.historyGroup}><span>Yesterday</span>
            <article className={styles.historyCard}><div className={styles.historyIcon}>↗</div><div><strong>Lead created from {lead.source}</strong><p>{lead.name} was added to Qiko Core</p></div><time>Yesterday</time></article>
            <article className={styles.historyCard}><div className={styles.historyIcon}>✉</div><div><strong>Welcome email opened</strong><p>{lead.email}</p></div><time>Yesterday</time></article>
          </div>
        </>}
        {centerTab === "notes" && <div className={styles.notesPanel}><div className={styles.sectionTitle}>Notes <span>1</span></div><article className={styles.noteCard}><strong>Lead review</strong><p>{lead.name} is a promising contact at {lead.company}. Follow up using the latest {lead.source} activity.</p><span>Today</span></article></div>}
      </main>

      <aside className={styles.sidePanel}>
        <section><div className={styles.panelHeading}><h3>Deals</h3><button type="button">View all</button></div><article className={styles.dealCard}><strong>Qiko Core opportunity</strong><span>{lead.company}</span><div><b>{lead.status}</b><em>High intent</em></div></article></section>
        <section><div className={styles.panelHeading}><h3>Tasks</h3><button type="button">View all</button></div><article className={styles.taskCard}><span>{taskCreated ? "In progress" : "Waiting on you"}</span><strong>{taskCreated ? `Follow up with ${lead.name}` : "Create follow-up task"}</strong><small>Recommended next step</small></article></section>
      </aside>
    </section>
  );
}
