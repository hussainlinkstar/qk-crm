"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Button from "./Button";
import StatsCard from "./StatsCard";
import LeadDetail from "./LeadDetail";

const actions = [
  { id: 1, title: "Review 5 new Signal leads", detail: "5 registrations need follow-up", owner: "Ed", due: "Today", priority: "High", status: "Pending" },
  { id: 2, title: "Review 3 completed free scans", detail: "Potential sales opportunities found", owner: "Ed", due: "Today", priority: "High", status: "In progress" },
  { id: 3, title: "Follow up with 2 engaged prospects", detail: "Strong recent product activity", owner: "Ed", due: "Tomorrow", priority: "Medium", status: "Pending" },
];

const initialLeads = [
  { id: 1, name: "Amelia Hart", email: "amelia@northstar.com", company: "Northstar Retail", source: "Qiko Signal", activity: "Completed a free scan", time: "32 min ago", status: "Qualified", owner: "Ed", score: 92 },
  { id: 2, name: "Marcus Chen", email: "marcus@fieldhouse.io", company: "Fieldhouse", source: "Website", activity: "Submitted an enquiry", time: "2 hours ago", status: "New", owner: "Ed", score: 78 },
  { id: 3, name: "Priya Shah", email: "priya@atlaslabs.ai", company: "Atlas Labs", source: "Qiko Signal", activity: "Created an account", time: "Yesterday", status: "Contacted", owner: "Ed", score: 68 },
  { id: 4, name: "Liam O'Connor", email: "liam@harbour.co", company: "Harbour & Co", source: "Free audit", activity: "Downloaded a scan report", time: "Yesterday", status: "Qualified", owner: "Ed", score: 84 },
];

export default function CoreApp({ sales = false }: { sales?: boolean }) {
  const router = useRouter();
  const [authenticated, setAuthenticated] = useState(false);
  const [ready, setReady] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");
  const [signupName, setSignupName] = useState("");
  const [selectedLead, setSelectedLead] = useState<number | null>(null);
  const [actionStatus, setActionStatus] = useState<Record<number, string>>({});
  const [query, setQuery] = useState("");
  const [leads, setLeads] = useState(initialLeads);
  const [showAddLead, setShowAddLead] = useState(false);
  const [newLead, setNewLead] = useState({ name: "", email: "", company: "", source: "Manual entry", status: "New" });
  const [tasks, setTasks] = useState(actions);
  const [taskToast, setTaskToast] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setAuthenticated(sessionStorage.getItem("qiko-core-auth") === "true");
      setReady(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  if (!ready) return null;

  if (!authenticated) {
    return (
      <main className="login-page">
        <section className="login-brand-side" aria-label="Qiko Core">
          <div className="login-brand"><strong>Qiko Core</strong></div>
          <div className="login-brand-copy"><span className="login-brand-chip">◉ Secure access</span><h1>See how your business<br />moves forward.</h1><p>A clear workspace for customer activity, sales priorities and the actions that turn interest into opportunity.</p><ul><li>Lead signals that read at a glance</li><li>Follow-ups and tasks in one place</li><li>Customer context without the clutter</li></ul></div>
          <div className="login-brand-footer">Trusted business intelligence for modern teams.</div>
        </section>
        <section className="login-form-side">
          <form className="login-card" onSubmit={(event) => {
            event.preventDefault();
            const validLogin = email.trim().toLowerCase() === "admin@qiko.ai" && password === "Admin@123";
            const validSignup = signupName.trim().length > 1 && email.trim().length > 3 && password.length >= 6;
            if ((authMode === "signin" && validLogin) || (authMode === "signup" && validSignup)) {
              sessionStorage.setItem("qiko-core-auth", "true");
              setAuthenticated(true);
            } else setLoginError(authMode === "signin" ? "The email or password is incorrect." : "Enter your name, email and a password of at least 6 characters.");
          }}>
            <div className="login-heading"><h1>{authMode === "signin" ? "Welcome back" : "Create your account"}</h1><p>{authMode === "signin" ? "Sign in to pick up where your last sales review left off." : "One workspace for leads, tasks and sales opportunities."}</p></div>
            {authMode === "signup" && <label>Full name<div className="login-input"><span>◯</span><input value={signupName} onChange={(e) => setSignupName(e.target.value)} placeholder="Your full name" /></div></label>}
            <label>Email address<div className="login-input"><span>@</span><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@company.com" /></div></label>
            <label>Password<div className="login-input"><span>•</span><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter your password" /></div></label>
            <div className="login-options">{authMode === "signin" ? <label><input type="checkbox" /> Keep me signed in</label> : <span className="password-tip">Use 6+ characters</span>}<button type="button">Forgot password?</button></div>
            {loginError && <p className="login-error">{loginError}</p>}
            <Button type="submit" variant="primary" size="large" fullWidth><span>{authMode === "signin" ? "Sign in" : "Create account"}</span></Button>
            <p className="auth-switch">{authMode === "signin" ? "New to Qiko Core?" : "Already have an account?"} <button type="button" onClick={() => { setAuthMode(authMode === "signin" ? "signup" : "signin"); setLoginError(""); }}>{authMode === "signin" ? "Create an account" : "Sign in"}</button></p>
            <p className="demo-note">Demo workspace · Mock CRM data</p>
          </form>
          <footer className="login-footer"><span>© 2026 Qiko Core</span><button>Privacy</button><button>Help</button></footer>
        </section>
      </main>
    );
  }

  function addLead(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!newLead.name.trim() || !newLead.email.trim()) return;

    setLeads((current) => [{
      id: Math.max(...current.map((item) => item.id), 0) + 1,
      name: newLead.name.trim(),
      email: newLead.email.trim(),
      company: newLead.company.trim() || "Not provided",
      source: newLead.source,
      activity: "Lead added manually",
      time: "Just now",
      status: newLead.status,
      owner: "Ed",
      score: 50,
    }, ...current]);
    setNewLead({ name: "", email: "", company: "", source: "Manual entry", status: "New" });
    setShowAddLead(false);
    setQuery("");
  }

  function createFollowUpTask() {
    if (!lead) return;
    const taskId = Math.max(...tasks.map((item) => item.id), 0) + 1;
    setTasks((current) => [{
      id: taskId,
      title: `Follow up with ${lead.name}`,
      detail: `${lead.company} · ${lead.email}`,
      owner: "Ed",
      due: "Today",
      priority: "High",
      status: "In progress",
    }, ...current]);
    setActionStatus((current) => ({ ...current, [lead.id]: "Task created" }));
    setTaskToast(`Follow-up task created for ${lead.name}`);
    setSelectedLead(null);
    window.setTimeout(() => setTaskToast(""), 3200);
  }

  function completeTask(taskId: number) {
    setTasks((current) => current.map((task) => task.id === taskId ? { ...task, status: "Completed" } : task));
  }

  const lead = leads.find((item) => item.id === selectedLead);
  const visibleLeads = leads.filter((item) => `${item.name} ${item.company} ${item.email}`.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><div className="brand-mark">Q</div><div><strong>Qiko Core</strong><span>Ed&apos;s workspace</span></div></div>
        <nav>
          <div className="nav-section-label">Workspace</div>
          <button className={!sales ? "nav-item active" : "nav-item"} onClick={() => router.push("/")}><span className="nav-icon">⌂</span><span className="nav-text">Home</span>{!sales && <i className="nav-active-dot" />}</button>
          <button className={sales ? "nav-item active" : "nav-item"} onClick={() => router.push("/sales") }><span className="nav-icon">⌁</span><span className="nav-text">Sales</span>{sales && <i className="nav-active-dot" />}</button>
          <button className="nav-item muted"><span className="nav-icon">◫</span><span className="nav-text">Marketing</span><b>Soon</b></button>
          <button className="nav-item muted"><span className="nav-icon">◎</span><span className="nav-text">Finance Ops</span><b>Soon</b></button>
          <div className="nav-section-label account-label">Account</div>
          <button className="nav-item"><span className="nav-icon">♙</span><span className="nav-text">My profile</span></button>
          <button className="nav-item"><span className="nav-icon">⚙</span><span className="nav-text">Workspace settings</span></button>
        </nav>
        <div className="pulse"><div className="pulse-icon">✦</div><div><strong>Qiko Pulse</strong><span>Advanced intelligence</span></div><b>SOON</b></div>
        <button className="profile" onClick={() => { sessionStorage.removeItem("qiko-core-auth"); setAuthenticated(false); }}><span className="avatar">E</span><span><strong>Ed Walker</strong><small>Workspace admin</small></span><span>⋮</span></button>
      </aside>

      <main className="workspace">
        <header className="topbar"><div className="mobile-brand">Qiko Core</div><label className="global-search"><span>⌕</span><input aria-label="Search Qiko Core" placeholder="Search anything" /><kbd>⌘ K</kbd></label><button className="help-button" aria-label="Help">?</button><button className="notification-button" aria-label="Notifications"><span>♢</span><i /></button><button className="top-avatar" aria-label="Ed Walker profile">E</button></header>
        {!sales ? (
          <div className="content home-content">
            {taskToast && <div className="task-toast" role="status"><span>✓</span>{taskToast}</div>}
            <section className="welcome"><div><span className="eyebrow">HOME</span><h1>Good morning, Ed.</h1><p>What can I help you with today?</p></div><span className="date-pill">29 Oct 2026</span></section>
            <div className="copilot"><span className="sparkle">✦</span><input aria-label="Ask Qiko" placeholder="Ask Qiko anything about your business..." /><button className="copilot-send" aria-label="Send question">Send <span aria-hidden="true">↗</span></button></div>
            <div className="prompt-chips"><button>What needs my attention today?</button><button>Review new Signal leads</button><button>Show my follow-ups</button><button>Create a sales action</button></div>
            <section className="snapshot-section"><div className="snapshot-label"><span>▥</span> Snapshot</div><div className="snapshot-grid"><article className="snapshot-card revenue-card"><div className="snapshot-card-heading"><span>Sales revenue</span><b>⋮⋮</b></div><div className="snapshot-main"><strong>$134M</strong><small>+3.9M this week</small></div><svg className="mini-line-chart" viewBox="0 0 240 78" aria-label="Revenue trend" role="img"><defs><linearGradient id="homeRevenueFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#7657e8" stopOpacity=".18"/><stop offset="100%" stopColor="#7657e8" stopOpacity="0"/></linearGradient></defs><path className="mini-line-area" d="M0 68 C22 65 30 54 48 58 S78 45 94 49 S124 34 143 38 S170 24 188 29 S214 12 240 17 L240 78 L0 78 Z"/><path className="mini-line-path" d="M0 68 C22 65 30 54 48 58 S78 45 94 49 S124 34 143 38 S170 24 188 29 S214 12 240 17"/><circle cx="240" cy="17" r="4"/></svg></article><article className="snapshot-card pipeline-card"><div className="snapshot-card-heading"><span>Pipeline value</span><b>⋮⋮</b></div><div className="pipeline-content"><div><strong>$297M</strong><small>24 of 27 qualified</small></div><div className="mini-donut"><span>$26.4M<small>in pipeline</small></span></div></div></article><article className="snapshot-card attention-card"><div className="snapshot-card-heading"><span>Needs attention</span><b>⋮⋮</b></div><div className="attention-grid"><div><small>New leads</small><strong>73</strong><em>+12 this week</em></div><div><small>Follow-ups due</small><strong>46</strong><em>5 high priority</em></div><div><small>Scans reviewed</small><strong>31/36</strong><em>5 remaining</em></div>            </div></article></div></section>
            <section className="home-actions-grid"><article><div className="snapshot-label"><span>ϟ</span> Needs action</div>{tasks.slice(0,3).map((task, index) => <button className="action-list-row" key={task.id}><span>{task.title}</span><b>{index === 0 ? 5 : index === 1 ? 3 : 2}</b><i>→</i></button>)}</article><article><div className="snapshot-label"><span>⊙</span> Progress checklist</div><div className="checklist-total"><strong>86%</strong><span>31 of 36 complete</span></div><div className="checklist-bar"><i /></div>{["Review new Signal leads","Qualify completed scans","Follow up engaged prospects"].map((item,index)=><button className="checklist-row" key={item}><i className={index===0?"checked":""}>{index===0?"✓":""}</i><span>{item}</span><b>{index===0?"Needs review":"To do"}</b></button>)}</article><article><div className="snapshot-label"><span>♧</span> Pinned reports</div><button className="report-row"><span>▭</span><strong>Sales pipeline report</strong><i>→</i></button><button className="report-row"><span>⌁</span><strong>Lead activity summary</strong><i>→</i></button><button className="report-row"><span>◷</span><strong>Weekly opportunities</strong><i>→</i></button></article></section>
            <section className="priorities">
              <div className="section-heading"><div><span className="eyebrow">YOUR DAY</span><h2>Top priorities</h2></div><button>View action workspace →</button></div>
              <div className="priority-grid">{tasks.map((item, index) => <article className={`priority-card ${item.status === "Completed" ? "completed-task" : ""}`} key={item.id}><div className="priority-number">{index + 1}</div><div><span className="priority-label">{item.status}</span><h3>{item.title}</h3><p>{item.detail}</p><small className="task-meta">{item.owner} · Due {item.due} · {item.priority} priority</small></div>{item.status !== "Completed" ? <button className="complete-task" aria-label={`Complete ${item.title}`} onClick={() => completeTask(item.id)}>✓</button> : <span className="task-complete-mark">✓</span>}</article>)}</div>
            </section>
            <section className="home-bottom">
              <div className="workspace-panel"><div className="section-heading"><div><span className="eyebrow">WORKSPACE</span><h2>Jump back in</h2></div></div><button className="workspace-card sales-card" onClick={() => router.push("/sales")}><span className="workspace-icon">⌁</span><div><strong>Sales</strong><small>15 items need attention</small></div><span>→</span></button><button className="workspace-card disabled"><span className="workspace-icon">◫</span><div><strong>Marketing</strong><small>Available in a future release</small></div><b>Soon</b></button><button className="workspace-card disabled"><span className="workspace-icon">◎</span><div><strong>Finance Ops</strong><small>Available in a future release</small></div><b>Soon</b></button></div>
              <div className="activity-panel"><div className="section-heading"><div><span className="eyebrow">LIVE ACTIVITY</span><h2>Recent changes</h2></div></div><div className="activity-item"><i className="green"/><div><strong>3 free scans completed</strong><span>2 opportunities identified · 18 min ago</span></div></div><div className="activity-item"><i className="purple"/><div><strong>5 new Signal registrations</strong><span>Lead review actions created · 1 hour ago</span></div></div><div className="activity-item"><i className="orange"/><div><strong>Website enquiry received</strong><span>Marcus Chen · 2 hours ago</span></div></div></div>
            </section>
          </div>
        ) : (
          <div className="content sales-content">
            <section className="sales-header"><div><span className="eyebrow">SALES WORKSPACE</span><h1>Sales overview</h1><p>A unified view of customer and prospect activity.</p></div><Button variant="secondary" onClick={() => setShowAddLead(true)}>+ Add lead</Button></section>
            {showAddLead && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowAddLead(false); }}><form className="add-lead-modal" onSubmit={addLead}><div className="modal-heading"><div><span className="eyebrow">NEW CRM RECORD</span><h2>Add lead</h2></div><button type="button" className="close-panel modal-close" onClick={() => setShowAddLead(false)}>×</button></div><label>Full name<input required value={newLead.name} onChange={(event) => setNewLead({ ...newLead, name: event.target.value })} placeholder="e.g. Alex Morgan" /></label><label>Email address<input required type="email" value={newLead.email} onChange={(event) => setNewLead({ ...newLead, email: event.target.value })} placeholder="alex@company.com" /></label><label>Company<input value={newLead.company} onChange={(event) => setNewLead({ ...newLead, company: event.target.value })} placeholder="Company name" /></label><div className="form-row"><label>Source<select value={newLead.source} onChange={(event) => setNewLead({ ...newLead, source: event.target.value })}><option>Manual entry</option><option>Qiko Signal</option><option>Website</option><option>Free audit</option></select></label><label>Status<select value={newLead.status} onChange={(event) => setNewLead({ ...newLead, status: event.target.value })}><option>New</option><option>Contacted</option><option>Qualified</option><option>Won</option><option>Lost</option></select></label></div><div className="modal-actions"><Button variant="secondary" onClick={() => setShowAddLead(false)}>Cancel</Button><Button type="submit">Add lead</Button></div></form></div>}
            <section className="analytics-grid"><article className="chart-card"><div className="chart-heading"><div><span className="eyebrow">30 DAY TREND</span><h2>Lead activity</h2></div><div className="chart-total"><strong>148</strong><span>+12.4%</span></div></div><div className="line-chart" aria-label="Lead activity trend"><svg viewBox="0 0 600 180" role="img"><defs><linearGradient id="activityFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#7657e8" stopOpacity=".22"/><stop offset="100%" stopColor="#7657e8" stopOpacity="0"/></linearGradient></defs><g className="chart-grid"><line x1="0" y1="150" x2="600" y2="150"/><line x1="0" y1="105" x2="600" y2="105"/><line x1="0" y1="60" x2="600" y2="60"/><line x1="0" y1="15" x2="600" y2="15"/></g><path className="chart-area" d="M0 145 C45 138 62 120 100 124 S158 108 200 112 S260 78 300 88 S350 58 400 66 S455 43 500 50 S558 22 600 28 L600 150 L0 150 Z"/><path className="chart-line" d="M0 145 C45 138 62 120 100 124 S158 108 200 112 S260 78 300 88 S350 58 400 66 S455 43 500 50 S558 22 600 28"/><circle cx="600" cy="28" r="5"/></svg><div className="chart-axis"><span>Oct 1</span><span>Oct 8</span><span>Oct 15</span><span>Oct 22</span><span>Oct 29</span></div></div></article><article className="chart-card source-card"><div className="chart-heading"><div><span className="eyebrow">BY SOURCE</span><h2>Lead sources</h2></div><span className="chart-period">This month</span></div><div className="source-chart"><div className="donut-chart"><div><strong>148</strong><span>Total leads</span></div></div><div className="source-list"><div><i className="signal"/><span>Qiko Signal</span><strong>76</strong></div><div><i className="website"/><span>Website</span><strong>34</strong></div><div><i className="audit"/><span>Free audit</span><strong>23</strong></div><div><i className="manual"/><span>Manual</span><strong>15</strong></div></div></div></article></section>
            <section className="metrics"><StatsCard label="Total leads" value="148" change="+12 this week" /><StatsCard label="Signal sign-ups" value="76" change="+9 this week" /><StatsCard label="Free scans" value="34" change="+6 this week" /><StatsCard label="Follow-ups due" value="15" change="5 high priority" urgent /></section>
            <section className="leads-panel"><div className="leads-toolbar"><div><span className="eyebrow">UNIFIED CRM</span><h2>Leads</h2></div><div className="tools"><div className="search"><span>⌕</span><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search leads" /></div><button className="filter-button">≡ Filter</button></div></div><div className="table-wrap"><table><thead><tr><th>Lead</th><th>Company</th><th>Source</th><th>Last activity</th><th>Status</th><th>Owner</th><th /></tr></thead><tbody>{visibleLeads.map((item) => <tr key={item.id} onClick={() => setSelectedLead(item.id)}><td><div className="person"><span className="lead-avatar">{item.name.split(" ").map((n) => n[0]).join("")}</span><span><strong>{item.name}</strong><small>{item.email}</small></span></div></td><td>{item.company}</td><td>{item.source}</td><td><strong>{item.activity}</strong><small>{item.time}</small></td><td><span className={`status ${item.status.toLowerCase()}`}>{item.status}</span></td><td><span className="owner">E</span></td><td><Button size="small" variant="secondary" aria-label={`Open ${item.name}`} onClick={(event) => { event.stopPropagation(); setSelectedLead(item.id); }}>View</Button></td></tr>)}</tbody></table></div></section>
            {lead && <LeadDetail lead={lead} taskCreated={actionStatus[lead.id] === "Task created"} onClose={() => setSelectedLead(null)} onCreateTask={createFollowUpTask} />}
          </div>
        )}
      </main>
    </div>
  );
}

