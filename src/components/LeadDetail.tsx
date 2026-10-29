import { useState } from "react";
import Button from "./Button";
import styles from "./LeadDetail.module.css";

type LeadMessage = { id: number; channel: "email" | "whatsapp"; recipient: string; sender: string; direction: "sent" | "received"; subject?: string; body: string; sentAt: string };
type DetailTab = "upcoming" | "history" | "email" | "whatsapp" | "notes";
type NewTaskDetails = { title: string; detail: string; owner: string; due: string; priority: string };
type NoteItem = { id: number; title: string; content: string; createdAt: string };

interface LeadDetailProps {
  lead: { id: number; name: string; email: string; company: string; source: string; activity: string; time: string; status: string; owner: string; score: number };
  taskCreated: boolean;
  messages: LeadMessage[];
  onSendMessage: (message: Omit<LeadMessage, "id" | "sentAt" | "sender" | "direction">) => void;
  onClose: () => void;
  onCreateTask: (task: NewTaskDetails) => void;
}

export default function LeadDetail({ lead, taskCreated, messages, onSendMessage, onClose, onCreateTask }: LeadDetailProps) {
  const [centerTab, setCenterTab] = useState<DetailTab>("upcoming");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [whatsappBody, setWhatsappBody] = useState("");
  const [composeChannel, setComposeChannel] = useState<"email" | "whatsapp" | "note" | null>(null);
  const [composeMinimized, setComposeMinimized] = useState(false);
  const [composeMaximized, setComposeMaximized] = useState(false);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [notes, setNotes] = useState<NoteItem[]>([
    { id: 1, title: "Lead review", content: `${lead.name} is a promising contact at ${lead.company}. Follow up using the latest ${lead.source} activity.`, createdAt: "Today" },
  ]);
  const [newNoteTitle, setNewNoteTitle] = useState("");
  const [newNoteContent, setNewNoteContent] = useState("");
  const [taskTitle, setTaskTitle] = useState(`Follow up with ${lead.name}`);
  const [taskDescription, setTaskDescription] = useState(`${lead.company} · ${lead.email}`);
  const [taskOwner, setTaskOwner] = useState(lead.owner);
  const [taskDueDate, setTaskDueDate] = useState(() => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  });
  const [taskPriority, setTaskPriority] = useState("High");
  const initials = lead.name.split(" ").map((part) => part[0]).join("");
  const channelMessages = messages
    .filter((message) => message.channel === centerTab)
    .sort((first, second) => second.id - first.id);

  function sendEmail(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!emailSubject.trim() || !emailBody.trim()) return;
    onSendMessage({ channel: "email", recipient: lead.email, subject: emailSubject.trim(), body: emailBody.trim() });
    setEmailSubject("");
    setEmailBody("");
  }

  function sendWhatsApp(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!whatsappNumber.trim() || !whatsappBody.trim()) return;
    onSendMessage({ channel: "whatsapp", recipient: whatsappNumber.trim(), body: whatsappBody.trim() });
    setWhatsappNumber("");
    setWhatsappBody("");
  }

  function openCompose(channel: "email" | "whatsapp" | "note") {
    setComposeChannel(channel);
    setComposeMinimized(false);
    setComposeMaximized(false);
  }

  function submitTask(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!taskTitle.trim() || !taskDueDate) return;
    onCreateTask({
      title: taskTitle.trim(),
      detail: taskDescription.trim(),
      owner: taskOwner,
      due: new Date(`${taskDueDate}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }),
      priority: taskPriority,
    });
    setShowTaskForm(false);
  }

  function submitNote(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!newNoteTitle.trim() || !newNoteContent.trim()) return;
    setNotes((current) => [{
      id: Date.now(),
      title: newNoteTitle.trim(),
      content: newNoteContent.trim(),
      createdAt: "Just now",
    }, ...current]);
    setNewNoteTitle("");
    setNewNoteContent("");
  }

  return (
    <section className={styles.overlay} role="dialog" aria-modal="true" aria-label={`${lead.name} lead details`}>
      <aside className={styles.profile}>
        <button className={styles.back} type="button" onClick={onClose}>← <span>Back to leads</span></button>
        <div className={styles.avatar}>{initials}</div>
        <h2>{lead.name}</h2>
        <p className={styles.email}>{lead.email}</p>
        <div className={styles.tabs}><button className={styles.active}>Activity</button><button>Details</button></div>
        <dl className={styles.details}>
          <div><dt>Company</dt><dd>{lead.company}</dd></div>
          <div><dt>Source</dt><dd>{lead.source}</dd></div>
          <div><dt>Owner</dt><dd>{lead.owner}</dd></div>
          <div><dt>Engagement</dt><dd>{lead.score}/100</dd></div>
        </dl>
      </aside>

      <main className={styles.timeline}>
        <div className={styles.timelineHeader}><div><span>WORKFLOW</span><h2>Activity</h2></div><Button variant="secondary" onClick={() => setShowTaskForm(true)}>+ Create task</Button></div>
        <nav className={styles.centerTabs} aria-label="Lead activity sections">
          <button type="button" className={centerTab === "upcoming" ? styles.active : ""} onClick={() => setCenterTab("upcoming")}>Upcoming</button>
          <button type="button" className={centerTab === "history" ? styles.active : ""} onClick={() => setCenterTab("history")}>History</button>
          <button type="button" className={centerTab === "email" ? styles.active : ""} onClick={() => setCenterTab("email")}>Email</button>
          <button type="button" className={centerTab === "whatsapp" ? styles.active : ""} onClick={() => setCenterTab("whatsapp")}>WhatsApp</button>
          <button type="button" className={centerTab === "notes" ? styles.active : ""} onClick={() => setCenterTab("notes")}>Notes <span>{notes.length}</span></button>
        </nav>
        {showTaskForm && <form className={styles.taskForm} onSubmit={submitTask}>
          <div className={styles.taskFormHeading}><div><span>NEW TASK</span><h3>Create task for {lead.name}</h3></div><button type="button" aria-label="Close task form" onClick={() => setShowTaskForm(false)}>×</button></div>
          <label>Task title<input value={taskTitle} onChange={(event) => setTaskTitle(event.target.value)} required /></label>
          <label>Description<textarea value={taskDescription} onChange={(event) => setTaskDescription(event.target.value)} rows={3} /></label>
          <div className={styles.taskFormRow}>
            <label>Owner<select value={taskOwner} onChange={(event) => setTaskOwner(event.target.value)}>{[lead.owner, "Ed Walker", "Sarah Ahmed", "Ali Khan", "Maya Patel"].filter((owner, index, owners) => owners.indexOf(owner) === index).map((owner) => <option key={owner}>{owner}</option>)}</select></label>
            <label>Priority<select value={taskPriority} onChange={(event) => setTaskPriority(event.target.value)}><option>Low</option><option>Medium</option><option>High</option></select></label>
          </div>
          <label>Due date<input type="date" value={taskDueDate} onChange={(event) => setTaskDueDate(event.target.value)} required /></label>
          <div className={styles.taskFormActions}><Button type="button" variant="secondary" onClick={() => setShowTaskForm(false)}>Cancel</Button><Button type="submit">Create task</Button></div>
        </form>}
        {!showTaskForm && <>
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
        {centerTab === "notes" && <section className={styles.notesPanel}>
          <div className={styles.notesHeader}>
            <div className={styles.sectionTitle}>Notes <span>{notes.length}</span></div>
            <Button variant="secondary" size="small" onClick={() => openCompose("note")}>Add note</Button>
          </div>
          <div className={styles.notesList}>
            {notes.map((note) => <article className={styles.noteCard} key={note.id}><strong>{note.title}</strong><p>{note.content}</p><span>{note.createdAt}</span></article>)}
          </div>
        </section>}
        {(centerTab === "email" || centerTab === "whatsapp") && <section className={styles.messagesPanel}>
          <div className={styles.messagePanelHeader}>
            <div className={styles.sectionTitle}>{centerTab === "email" ? "Email conversation" : "WhatsApp conversation"}</div>
            <Button variant="secondary" size="small" onClick={() => openCompose(centerTab)}>
              {centerTab === "email" ? "Compose email" : "New message"}
            </Button>
          </div>
          <p className={styles.demoNotice}>Demo mode: messages are saved in this workspace only and are not delivered.</p>
          <div className={styles.messageList} aria-live="polite">
            {channelMessages.length === 0 ? <p className={styles.emptyMessages}>No {centerTab === "email" ? "emails" : "WhatsApp messages"} yet.</p> : channelMessages.map((message) => <article className={styles.sentMessage} key={message.id}>
              <div><strong>{message.channel === "email" ? message.subject : "WhatsApp message"}</strong><time>{message.sentAt}</time></div>
              <p>{message.body}</p>
              <small>{message.direction === "sent" ? "From" : "To"}: {message.sender} · {message.direction === "sent" ? "To" : "From"}: {message.recipient}</small>
            </article>)}
          </div>
        </section>}
        </>}
      </main>

      {composeChannel && <section className={`${styles.composeWindow}${composeMinimized ? ` ${styles.composeWindowMinimized}` : ""}${composeMaximized ? ` ${styles.composeWindowMaximized}` : ""}`} role="dialog" aria-modal="false" aria-labelledby="compose-title">
        <div className={styles.composeHeader}>
          <strong id="compose-title">{composeChannel === "email" ? "New email" : composeChannel === "whatsapp" ? "New WhatsApp message" : "New note"}</strong>
          <div className={styles.composeControls}>
            <button type="button" aria-label={composeMinimized ? "Restore compose window" : "Minimize compose window"} onClick={() => setComposeMinimized((minimized) => !minimized)}>{composeMinimized ? "□" : "−"}</button>
            <button type="button" aria-label={composeMaximized ? "Restore compose window size" : "Maximize compose window"} onClick={() => { setComposeMaximized((maximized) => !maximized); setComposeMinimized(false); }}>{composeMaximized ? "❐" : "□"}</button>
            <button type="button" aria-label="Close compose window" onClick={() => setComposeChannel(null)}>×</button>
          </div>
        </div>
        {!composeMinimized && (composeChannel === "email" ? <form className={styles.composeForm} onSubmit={sendEmail}>
          <label>To<input type="email" value={lead.email} readOnly /></label>
          <label>Subject<input value={emailSubject} onChange={(event) => setEmailSubject(event.target.value)} required /></label>
          <label>Message<textarea value={emailBody} onChange={(event) => setEmailBody(event.target.value)} rows={6} required /></label>
          <div className={styles.composeActions}><Button type="submit">Send email</Button></div>
        </form> : composeChannel === "whatsapp" ? <form className={styles.composeForm} onSubmit={sendWhatsApp}>
          <label>WhatsApp number<input type="tel" value={whatsappNumber} onChange={(event) => setWhatsappNumber(event.target.value)} placeholder="+1 555 123 4567" required /></label>
          <label>Message<textarea value={whatsappBody} onChange={(event) => setWhatsappBody(event.target.value)} rows={6} required /></label>
          <div className={styles.composeActions}><Button type="submit">Send WhatsApp</Button></div>
        </form> : <form className={styles.composeForm} onSubmit={submitNote}>
          <label>Title<input value={newNoteTitle} onChange={(event) => setNewNoteTitle(event.target.value)} placeholder="Call notes" required /></label>
          <label>Note<textarea value={newNoteContent} onChange={(event) => setNewNoteContent(event.target.value)} rows={6} placeholder="Add context about this lead..." required /></label>
          <div className={styles.composeActions}><Button type="submit">Save note</Button></div>
        </form>)}
      </section>}

      <aside className={styles.sidePanel}>
        <section><div className={styles.panelHeading}><h3>Deals</h3><button type="button">View all</button></div><article className={styles.dealCard}><strong>Qiko Core opportunity</strong><span>{lead.company}</span><div><b>{lead.status}</b><em>High intent</em></div></article></section>
        <section><div className={styles.panelHeading}><h3>Tasks</h3><button type="button">View all</button></div><article className={styles.taskCard}><span>{taskCreated ? "In progress" : "Waiting on you"}</span><strong>{taskCreated ? `Follow up with ${lead.name}` : "Create follow-up task"}</strong><small>Recommended next step</small></article></section>
      </aside>
    </section>
  );
}
