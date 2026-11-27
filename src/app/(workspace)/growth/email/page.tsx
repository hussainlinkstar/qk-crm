"use client";

import { useLayoutEffect, useRef, useState } from "react";
import Button from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Overlay";
import Icon from "@/components/ui/Icon";
import Select from "@/components/ui/Select";
import { SkeletonRows } from "@/components/ui/bits";
import { OutcomeGrid, PageHero } from "@/components/ui/workspace";
import { useWorkspace } from "@/components/shell/WorkspaceContext";
import { avatarStyle, formatDateTime, initials, plural } from "@/lib/format";
import { campaignStats, fullName, renderTemplate, segmentLeads } from "@/lib/signal-growth/engine";
import { growth, useGrowth } from "@/lib/signal-growth/store";
import type { Campaign, EmailTemplate } from "@/lib/signal-growth/types";
import styles from "./email.module.css";

const MERGE = [
  ["firstName", "First name"],
  ["company", "Company"],
  ["site", "Website"],
  ["aio", "AIO score"],
  ["seo", "SEO score"],
  ["topProblem", "Top problem"],
  ["reportLink", "Report link"],
  ["offerEnd", "Offer end"],
] as const;

const EMOJIS = ["👋", "🙂", "😊", "🙏", "✨", "✅", "📈", "💡", "🎯", "⭐", "👍", "🎉", "💬", "🚀", "💼", "🕒", "🔥", "📌", "🌟", "✍️", "📎", "💚", "👀", "🧠"];

type Attachment = { id: string; name: string; size: number };
type Panel = "" | "emoji" | "merge" | "link";

function toLocalInput(iso?: string) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function readableSubject(value: string) {
  return value.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key: string) => key.replace(/([A-Z])/g, " $1").trim().toLowerCase());
}

const TEMPLATE_KINDS = ["Sequence", "Campaign", "Trigger", "Letter"] as const;
type TemplateKind = (typeof TEMPLATE_KINDS)[number];

function slugOf(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || "template";
}

function templateUse(state: NonNullable<ReturnType<typeof useGrowth>>, id: string) {
  const sequenceUses = state.sequences.reduce((sum, sequence) => sum + sequence.steps.filter((step) => step.templateId === id).length, 0);
  const campaignUses = state.campaigns.filter((item) => item.templateId === id).length;
  const triggerUses = state.triggers.filter((item) => item.templateId === id).length;
  const uses = sequenceUses + campaignUses + triggerUses;
  const kind: TemplateKind = sequenceUses ? "Sequence" : campaignUses ? "Campaign" : triggerUses ? "Trigger" : "Letter";
  return { uses, kind, status: uses ? "Active" : "Draft" };
}

function fileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function renderBody(text: string) {
  const escaped = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const marked = escaped
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*(.+?)\*/g, "$1<em>$2</em>")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2">$1</a>');
  const blocks: string[] = [];
  let list: string[] = [];
  const flush = () => {
    if (!list.length) return;
    blocks.push(`<ul>${list.map((item) => `<li>${item}</li>`).join("")}</ul>`);
    list = [];
  };
  for (const line of marked.split("\n")) {
    const item = line.match(/^\s*[-•]\s+(.*)$/);
    if (item) {
      list.push(item[1]);
      continue;
    }
    flush();
    if (line.trim()) blocks.push(`<p>${line}</p>`);
  }
  flush();
  return blocks.join("") || "<p>The message will show here.</p>";
}

function letterMarkup(text: string) {
  if (!/<\/?[a-z][\s\S]*>/i.test(text)) return renderBody(text);
  return text
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/<iframe[\s\S]*?>[\s\S]*?<\/iframe>/gi, "")
    .replace(/\son\w+\s*=\s*(['"]).*?\1/gi, "")
    .replace(/\son\w+\s*=\s*[^\s>]+/gi, "")
    .replace(/javascript:/gi, "");
}

function textHtml(value: string) {
  return value.trim() ? letterMarkup(value) : "";
}

export default function EmailPage() {
  const state = useGrowth();
  const { toast, session } = useWorkspace();
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const bodyValue = useRef("");
  const fileRef = useRef<HTMLInputElement>(null);
  const [hydrated, setHydrated] = useState(false);
  const [templateId, setTemplateId] = useState("tm_audit");
  const [campaignId, setCampaignId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [offerEnd, setOfferEnd] = useState("Friday");
  const [campaignName, setCampaignName] = useState("");
  const [segmentId, setSegmentId] = useState("sg_uae");
  const [sampleId, setSampleId] = useState("");
  const [when, setWhen] = useState("");
  const [limit, setLimit] = useState<number | null>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [panel, setPanel] = useState<Panel>("");
  const [linkUrl, setLinkUrl] = useState("https://");
  const [browsing, setBrowsing] = useState(true);
  const [kindFilter, setKindFilter] = useState<"All" | TemplateKind>("All");
  const [templateQuery, setTemplateQuery] = useState("");
  const [logsOpen, setLogsOpen] = useState(false);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorMode, setEditorMode] = useState<"edit" | "preview">("edit");
  const [bodyFormat, setBodyFormat] = useState<"text" | "html">("text");
  bodyValue.current = body;
  useLayoutEffect(() => {
    if (bodyFormat !== "text" || !textRef.current) return;
    textRef.current.innerHTML = textHtml(bodyValue.current);
  }, [bodyFormat, editorOpen]);

  if (state && !hydrated) {
    const template = state.templates.find((item) => item.id === "tm_audit") ?? state.templates[0];
    setHydrated(true);
    if (template) {
      setTemplateId(template.id);
      setName(template.name);
      setSubject(template.subject);
      setBody(template.body);
      setOfferEnd(template.offerEnd);
      setCampaignName(template.name);
    }
    const sample = state.leads.find((lead) => !lead.dnc.email) ?? state.leads[0];
    if (sample) setSampleId(sample.id);
  }

  if (!state || !hydrated) return <div className="page"><SkeletonRows rows={8} /></div>;

  const template = state.templates.find((item) => item.id === templateId);
  const campaign = state.campaigns.find((item) => item.id === campaignId);
  const sample = state.leads.find((lead) => lead.id === sampleId) ?? state.leads.find((lead) => !lead.dnc.email) ?? state.leads[0];
  const audience = segmentLeads(state, segmentId);
  const blocked = audience.filter((lead) => lead.dnc.email).length;
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const preview = sample
    ? renderTemplate(
        {
          id: templateId || "draft",
          name,
          subject,
          body,
          offerEnd,
          fallbacks: template?.fallbacks ?? { firstName: "there", company: "your team", site: "your site", aio: "your AIO score", seo: "your SEO score", topProblem: "the main issue we found", reportLink: "your private report link", offerEnd: offerEnd || "soon" },
        },
        sample,
        origin,
      )
    : null;
  const sentCampaign = campaign?.status === "sent";

  const openEditor = (source: string) => {
    setPreviewId(null);
    setLogsOpen(false);
    setEditorMode("edit");
    setBodyFormat(/<\/?[a-z]/i.test(source) ? "html" : "text");
    setEditorOpen(true);
  };

  const loadTemplate = (item: EmailTemplate) => {
    setTemplateId(item.id);
    setCampaignId(null);
    setName(item.name);
    setSubject(item.subject);
    setBody(item.body);
    setOfferEnd(item.offerEnd);
    setCampaignName(item.name);
    setWhen("");
    setAttachments([]);
    setPanel("");
    openEditor(item.body);
  };

  const loadCampaign = (item: Campaign) => {
    const source = state.templates.find((row) => row.id === item.templateId);
    setCampaignId(item.id);
    setSegmentId(item.segmentId);
    setCampaignName(item.name);
    setWhen(toLocalInput(item.scheduledFor));
    setAttachments([]);
    setPanel("");
    if (source) {
      setTemplateId(source.id);
      setName(source.name);
      setSubject(source.subject);
      setBody(source.body);
      setOfferEnd(source.offerEnd);
    }
    openEditor(source?.body ?? "");
  };

  const syncText = () => {
    if (textRef.current) setBody(textRef.current.innerHTML);
  };

  const insert = (snippet: string) => {
    if (bodyFormat === "text" && textRef.current) {
      textRef.current.focus();
      document.execCommand("insertText", false, snippet);
      syncText();
      return;
    }
    const field = bodyRef.current;
    const start = field?.selectionStart ?? body.length;
    const end = field?.selectionEnd ?? body.length;
    setBody(body.slice(0, start) + snippet + body.slice(end));
    const caret = start + snippet.length;
    requestAnimationFrame(() => {
      field?.focus();
      field?.setSelectionRange(caret, caret);
    });
  };

  const wrap = (before: string, after: string) => {
    if (bodyFormat === "text" && textRef.current) {
      textRef.current.focus();
      const command = before === "**" ? "bold" : before === "*" ? "italic" : "";
      if (command) document.execCommand(command);
      else document.execCommand("insertText", false, `${before}text${after}`);
      syncText();
      return;
    }
    const field = bodyRef.current;
    const start = field?.selectionStart ?? body.length;
    const end = field?.selectionEnd ?? body.length;
    const selected = body.slice(start, end) || "text";
    setBody(body.slice(0, start) + before + selected + after + body.slice(end));
    requestAnimationFrame(() => {
      field?.focus();
      field?.setSelectionRange(start + before.length, start + before.length + selected.length);
    });
  };

  const bullet = () => {
    if (bodyFormat === "text" && textRef.current) {
      textRef.current.focus();
      document.execCommand("insertUnorderedList");
      syncText();
      return;
    }
    const field = bodyRef.current;
    const start = field?.selectionStart ?? body.length;
    const end = field?.selectionEnd ?? body.length;
    const selected = body.slice(start, end) || "point";
    const snippet = selected.split("\n").map((line) => (line.startsWith("- ") ? line : `- ${line}`)).join("\n");
    setBody(body.slice(0, start) + snippet + body.slice(end));
    requestAnimationFrame(() => field?.focus());
  };

  const persistTemplate = () => {
    const id = growth.saveTemplate({
      id: templateId || undefined,
      name: name.trim() || "Untitled",
      subject,
      body,
      offerEnd,
    });
    setTemplateId(id);
    return id;
  };

  const saveDraft = (schedule: boolean) => {
    if (schedule && !when) {
      toast("Pick a send time first.");
      return;
    }
    const id = persistTemplate();
    const payload = {
      name: campaignName.trim() || name.trim() || "Untitled",
      templateId: id,
      segmentId,
      scheduledFor: schedule ? new Date(when).toISOString() : "",
    };
    if (campaign && campaign.status !== "sent") {
      growth.updateCampaign(campaign.id, payload);
    } else {
      setCampaignId(growth.scheduleCampaign(payload));
    }
    toast(schedule ? "Scheduled. It sends within 5 minutes of that time." : "Draft saved.");
  };

  const addFiles = (list: FileList | null) => {
    if (!list?.length) return;
    const next: Attachment[] = [];
    for (const file of Array.from(list)) {
      if (file.size > 8 * 1024 * 1024) {
        toast(`${file.name} is over 8 MB.`);
        continue;
      }
      next.push({ id: `${file.name}-${file.size}-${file.lastModified}`, name: file.name, size: file.size });
    }
    setAttachments((current) => [...current, ...next]);
    if (fileRef.current) fileRef.current.value = "";
  };

  const groups: { label: string; tone: "draft" | "scheduled" | "sent"; items: Campaign[] }[] = [
    { label: "Drafts", tone: "draft", items: state.campaigns.filter((item) => item.status === "draft") },
    { label: "Scheduled", tone: "scheduled", items: state.campaigns.filter((item) => item.status === "scheduled") },
    { label: "Sent", tone: "sent", items: state.campaigns.filter((item) => item.status === "sent") },
  ];
  const plain = body.replace(/\{\{[^}]+\}\}/g, " ").replace(/[*_\[\]()]/g, " ").trim();
  const words = plain ? plain.split(/\s+/).length : 0;
  const seconds = words ? Math.max(5, Math.round((words / 180) * 60)) : 0;
  const segment = state.segments.find((item) => item.id === segmentId);
  const reachable = audience.length - blocked;
  const stats = campaign ? campaignStats(state, campaign.id) : null;
  const statTiles = stats
    ? [
        ["Sent", stats.sent],
        ["Delivered", stats.delivered],
        ["Opened", stats.opened],
        ["Clicked", stats.clicked],
        ["Replied", stats.replied],
        ["Signed up", stats.signedUp],
        ["Paid", stats.paid],
      ]
    : [];
  const startBlank = () => {
    setTemplateId("");
    setCampaignId(null);
    setName("Untitled");
    setSubject("");
    setBody("");
    setOfferEnd("Friday");
    setCampaignName("Untitled");
    setWhen("");
    setAttachments([]);
    setPanel("");
    openEditor("");
  };

  const catalog = state.templates.map((item) => ({ item, ...templateUse(state, item.id) }));
  const activeCount = catalog.filter((row) => row.status === "Active").length;
  const emailsSent = state.leads.reduce((sum, lead) => sum + lead.timeline.filter((event) => event.channel === "email" && event.kind === "sent").length, 0);
  const kindTabs = ["All" as const, ...TEMPLATE_KINDS.filter((kind) => catalog.some((row) => row.kind === kind))];
  const query = templateQuery.trim().toLowerCase();
  const visible = (kindFilter === "All" ? catalog : catalog.filter((row) => row.kind === kindFilter)).filter((row) => {
    if (!query) return true;
    return `${row.item.name} ${slugOf(row.item.name)} ${row.item.subject} ${row.kind}`.toLowerCase().includes(query);
  });
  const previewTemplate = state.templates.find((item) => item.id === previewId) ?? null;
  const previewRow = catalog.find((row) => row.item.id === previewId) ?? null;
  const previewLetter = previewTemplate && sample ? renderTemplate(previewTemplate, sample, origin) : null;

  const kindChip: Record<TemplateKind, string> = {
    Sequence: "chip chip-contacted",
    Campaign: "chip chip-new",
    Trigger: "chip chip-pending",
    Letter: "chip chip-ai",
  };

  return (
      <div className="page">
        <PageHero
          kicker="Signal"
          title="Email templates"
          lede="Letters you can send, schedule, or place in a sequence."
          action={
            <>
              <Button variant="secondary" aria-expanded={logsOpen} onClick={() => { setPreviewId(null); setLogsOpen(true); }}>View logs</Button>
              <Button icon="plus" onClick={startBlank}>New template</Button>
            </>
          }
        />

        <OutcomeGrid
          label="Template totals"
          tiles={[
            { key: "total", label: "Total templates", numeric: catalog.length, sub: "Letters ready to send", icon: "mail", iconTone: "qiko", tone: "qiko" },
            { key: "active", label: "Active", numeric: activeCount, sub: "Used in a flow or a send", icon: "check", iconTone: "qiko", tone: "qiko" },
            { key: "sent", label: "Emails sent", numeric: emailsSent, sub: "Across every lead", icon: "send", iconTone: "qiko", tone: "qiko" },
            { key: "today", label: "Sent today", numeric: state.caps.emailsSent, sub: `of ${state.caps.emailLimit}`, icon: "calendar", iconTone: "qiko", tone: "qiko" },
          ]}
        />

        <section className="card">
          <div className={styles.toolbar}>
            <div className="segmented" role="group" aria-label="Template kinds">
              {kindTabs.map((kind) => {
                const count = kind === "All" ? catalog.length : catalog.filter((row) => row.kind === kind).length;
                return (
                  <button type="button" key={kind} aria-pressed={kindFilter === kind} onClick={() => setKindFilter(kind)}>
                    {kind} <span className="count">{count}</span>
                  </button>
                );
              })}
            </div>
            <label className={`search-field ${styles.search}`}>
              <Icon name="search" size={15} />
              <input value={templateQuery} onChange={(event) => setTemplateQuery(event.target.value)} placeholder="Search name or subject" aria-label="Search templates" />
            </label>
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Template</th>
                  <th>Category</th>
                  <th>Subject</th>
                  <th>Status</th>
                  <th>Uses</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {visible.length === 0 ? (
                  <tr>
                    <td colSpan={6} className={styles.emptyCell}>{query ? `No templates match “${templateQuery.trim()}”.` : "No templates in this category."}</td>
                  </tr>
                ) : visible.map((row) => (
                  <tr key={row.item.id}>
                    <td>
                      <button type="button" className={styles.templateName} onClick={() => loadTemplate(row.item)}>
                        <b>{row.item.name}</b>
                        <small>{slugOf(row.item.name)}</small>
                      </button>
                    </td>
                    <td><span className={kindChip[row.kind]}>{row.kind}</span></td>
                    <td className={styles.subjectCell} title={row.item.subject}>{row.item.subject}</td>
                    <td><span className={row.status === "Active" ? "chip chip-won" : "chip"}>{row.status}</span></td>
                    <td className="tabular">{row.uses}</td>
                    <td>
                      <div className={styles.rowActions}>
                        <button type="button" className={styles.iconBtn} aria-label={`Preview ${row.item.name}`} aria-pressed={previewId === row.item.id} onClick={() => { setLogsOpen(false); setPreviewId((current) => current === row.item.id ? null : row.item.id); }}><Icon name="eye" size={16} /></button>
                        <button type="button" className={styles.iconBtn} aria-label={`Edit ${row.item.name}`} onClick={() => loadTemplate(row.item)}><Icon name="edit" size={16} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

          {previewTemplate && previewLetter ? (
            <Drawer
              kicker="Email"
              width={480}
              title={
                <span className={styles.panelTitle}>
                  <span>
                    {previewTemplate.name}
                    <small>{previewRow ? `${previewRow.kind} · ${previewRow.status}` : "Template"}</small>
                  </span>
                </span>
              }
              onClose={() => setPreviewId(null)}
              footer={
                <button type="button" className={styles.editTemplate} onClick={() => { setPreviewId(null); loadTemplate(previewTemplate); }}>
                  Edit template <Icon name="arrowRight" size={14} />
                </button>
              }
            >
              <aside className={`${styles.inbox} ${styles.drawerInbox}`} aria-label="Inbox preview">
                <div className={styles.inboxBar}>
                  <div>
                    <p>Their inbox</p>
                    <b>{sample ? fullName(sample) : "No lead"}</b>
                  </div>
                  <Select className={styles.previewPick} value={sample?.id ?? ""} aria-label="Preview as" onChange={(event) => setSampleId(event.target.value)}>
                    {state.leads.map((lead) => <option key={lead.id} value={lead.id}>{fullName(lead)}</option>)}
                  </Select>
                </div>
                <article className={styles.message}>
                  <div className={styles.fromLine}>
                    <span className="avatar" style={avatarStyle(session.name)}>{initials(session.name)}</span>
                    <span>
                      <b>{session.name}</b>
                      <small>to {sample?.email || "a lead"}</small>
                    </span>
                  </div>
                  <h3>{previewLetter.subject || "No subject yet"}</h3>
                  <div className={styles.paperBody} dangerouslySetInnerHTML={{ __html: letterMarkup(previewLetter.body) }} />
                </article>
              </aside>
            </Drawer>
          ) : null}

          {logsOpen ? (
            <Drawer title="Send log" kicker="Signal" width={420} onClose={() => setLogsOpen(false)}>
              <p className={styles.logIntro}>Drafts, scheduled letters, and letters already sent.</p>
              <div className={styles.limitRow}>
                <span>{state.caps.emailsSent} of {state.caps.emailLimit} today</span>
                <input className={`input ${styles.capField}`} type="number" min={0} value={limit ?? state.caps.emailLimit} onChange={(event) => setLimit(Number(event.target.value))} aria-label="Daily send limit" />
                <Button size="small" variant="secondary" onClick={() => { growth.setEmailLimit(limit ?? state.caps.emailLimit); toast("Send limit saved"); }}>Save</Button>
              </div>
              {state.campaigns.length === 0 ? (
                <p className={styles.emptyCell}>No sends yet.</p>
              ) : (
                <ul className={styles.logList}>
                  {state.campaigns.map((item) => {
                    const source = state.templates.find((row) => row.id === item.templateId);
                    return (
                      <li key={item.id}>
                        <button type="button" onClick={() => { setLogsOpen(false); loadCampaign(item); }}>
                          <b>{item.name}</b>
                          <small>{source?.name ?? "Template"}{item.scheduledFor ? ` · ${formatDateTime(item.scheduledFor)}` : ""}</small>
                        </button>
                        <span className={item.status === "sent" ? "chip chip-won" : "chip"}>{item.status}</span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Drawer>
          ) : null}

          {editorOpen ? (
            <Drawer
              width={760}
              title={name.trim() || "New template"}
              onClose={() => setEditorOpen(false)}
              header={
                <>
                  <p className={styles.editorTitle}>{name.trim() || "New template"}</p>
                  <div className={styles.letterHead}>
                    <div className={styles.people}>
                      <span className={styles.who}>
                        <span className="avatar" style={avatarStyle(session.name)}>{initials(session.name)}</span>
                        <span>
                          <b>{session.name}</b>
                          <small>{session.email}</small>
                        </span>
                      </span>
                      <span className={styles.toWord}>to</span>
                      <span className={styles.audience}>
                        <Select className={styles.segmentPick} value={segmentId} aria-label="Segment" onChange={(event) => setSegmentId(event.target.value)}>
                          {state.segments.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                        </Select>
                        <small>{plural(reachable, "person", "people")} receive it · {blocked} skipped</small>
                      </span>
                    </div>
                  </div>
                </>
              }
              footer={
                <>
                  <Button variant="secondary" onClick={() => saveDraft(false)}>Save draft</Button>
                  <Button variant="secondary" icon="calendar" disabled={!when || sentCampaign} onClick={() => saveDraft(true)}>Schedule</Button>
                  <Button onClick={() => { persistTemplate(); toast("Template saved."); }}>Save</Button>
                </>
              }
            >
              <div className={styles.editorPane}>
              {editorMode === "edit" ? (
                <div className={styles.editorFields}>
                  <label>
                    Name
                    <input className="input" value={name} onChange={(event) => setName(event.target.value)} aria-label="Template name" />
                  </label>
                  <label>
                    Subject
                    <input className="input" value={subject} onChange={(event) => setSubject(event.target.value)} aria-label="Subject" placeholder="The line they see first" />
                  </label>
                  <div className={styles.toolRow}>
                  <div className={styles.dock} role="toolbar" aria-label="Formatting">
                    <button type="button" className={styles.tool} aria-label="Bold" onClick={() => wrap("**", "**")}><span className={styles.toolMark}>B</span></button>
                    <button type="button" className={styles.tool} aria-label="Italic" onClick={() => wrap("*", "*")}><span className={styles.toolMark}><em>I</em></span></button>
                    <button type="button" className={styles.tool} aria-label="Bulleted list" onClick={bullet}><Icon name="list" size={15} /></button>
                    <button type="button" className={styles.tool} aria-label="Insert link" aria-expanded={panel === "link"} onClick={() => setPanel(panel === "link" ? "" : "link")}><Icon name="link" size={15} /></button>
                    <span className={styles.dockSplit} />
                    <button type="button" className={styles.tool} aria-label="Insert emoji" aria-expanded={panel === "emoji"} onClick={() => setPanel(panel === "emoji" ? "" : "emoji")}>Emoji</button>
                    {panel === "emoji" ? (
                      <div className={styles.popover} role="dialog" aria-label="Emoji">
                        <p>Drop one in</p>
                        <div className={styles.emojiGrid}>
                          {EMOJIS.map((emoji) => (
                            <button type="button" key={emoji} onClick={() => { insert(emoji); setPanel(""); }}>{emoji}</button>
                          ))}
                        </div>
                      </div>
                    ) : null}
                    {panel === "link" ? (
                      <form className={`${styles.popover} ${styles.linkForm}`} onSubmit={(event) => { event.preventDefault(); wrap("[", `](${linkUrl.trim() || "https://"})`); setPanel(""); }}>
                        <input className="input" value={linkUrl} onChange={(event) => setLinkUrl(event.target.value)} aria-label="Link address" placeholder="https://" />
                        <Button type="submit" size="small" variant="secondary">Insert</Button>
                      </form>
                    ) : null}
                  </div>
                  <span className={styles.spacer} />
                  <div className={`segmented ${styles.formatSwitch}`} role="group" aria-label="Email format">
                    <button type="button" aria-pressed={bodyFormat === "text"} onClick={() => setBodyFormat("text")}>Text</button>
                    <button type="button" aria-pressed={bodyFormat === "html"} onClick={() => setBodyFormat("html")}>HTML</button>
                  </div>
                  <div className={`segmented ${styles.modeSwitch}`} role="group" aria-label="Editor mode">
                    <button type="button" aria-pressed={editorMode === "edit"} onClick={() => setEditorMode("edit")}>Edit</button>
                    <button type="button" aria-pressed={editorMode === "preview"} onClick={() => setEditorMode("preview")}>Preview</button>
                  </div>
                  <button type="button" className={styles.attach} aria-label="Attach files" onClick={() => fileRef.current?.click()}><Icon name="file" size={15} /> Attach</button>
                  <input ref={fileRef} type="file" multiple hidden onChange={(event) => addFiles(event.target.files)} />
                  </div>
                  <div className={styles.mergeRow}>
                    {MERGE.map(([key, label]) => (
                      <button type="button" key={key} className={styles.token} onClick={() => insert(`{{${key}}}`)}>{label}</button>
                    ))}
                  </div>
                  {bodyFormat === "html" ? (
                    <textarea ref={bodyRef} className={`${styles.htmlField} ${styles.htmlFieldCode}`} value={body} onChange={(event) => setBody(event.target.value)} aria-label="Email" placeholder="Paste or write HTML." />
                  ) : (
                    <div ref={textRef} className={styles.htmlField} contentEditable role="textbox" aria-multiline="true" aria-label="Email" data-placeholder="Write the email." onInput={syncText} />
                  )}
                  {attachments.length ? (
                    <div className={styles.files}>
                      {attachments.map((file) => (
                        <span key={file.id} className={styles.fileCard}>
                          <span className={styles.fileMark}><Icon name="file" size={16} /></span>
                          <span>
                            <b>{file.name}</b>
                            <small className={styles.hint}>{fileSize(file.size)}</small>
                          </span>
                          <button type="button" aria-label={`Remove ${file.name}`} onClick={() => setAttachments((current) => current.filter((item) => item.id !== file.id))}><Icon name="x" size={14} /></button>
                        </span>
                      ))}
                    </div>
                  ) : null}
                  <div className={styles.letterMeta}>
                    <span className={styles.readTime}>{words ? `${plural(words, "word")} · ${seconds} sec to read` : "Empty email"}</span>
                    <label>
                      Offer ends
                      <input className="input" value={offerEnd} onChange={(event) => setOfferEnd(event.target.value)} aria-label="Offer end" />
                    </label>
                    <label>
                      Send at
                      <input className="input" type="datetime-local" value={when} onChange={(event) => setWhen(event.target.value)} aria-label="Send at" />
                    </label>
                  </div>
                  <p className={styles.logIntro}>{bodyFormat === "html" ? "HTML is shown as the lead would read it in Preview." : "Text keeps bold, lists, and links. Switch to HTML to paste a designed email."} Tokens such as {"{{firstName}}"} fill in for the lead.</p>
                </div>
              ) : (
                <>
                <div className={styles.previewTools}>
                  <div className={`segmented ${styles.modeSwitch}`} role="group" aria-label="Editor mode">
                    <button type="button" aria-pressed={editorMode === "edit"} onClick={() => setEditorMode("edit")}>Edit</button>
                    <button type="button" aria-pressed={editorMode === "preview"} onClick={() => setEditorMode("preview")}>Preview</button>
                  </div>
                </div>
                <aside className={`${styles.inbox} ${styles.drawerInbox} ${styles.editorPreview}`} aria-label="Inbox preview">
                  <div className={styles.inboxBar}>
                    <div>
                      <p>Their inbox</p>
                      <b>{sample ? fullName(sample) : "No lead"}</b>
                    </div>
                    <Select className={styles.previewPick} value={sample?.id ?? ""} aria-label="Preview as" onChange={(event) => setSampleId(event.target.value)}>
                      {state.leads.map((lead) => <option key={lead.id} value={lead.id}>{fullName(lead)}</option>)}
                    </Select>
                  </div>
                  <article className={styles.message}>
                    <div className={styles.fromLine}>
                      <span className="avatar" style={avatarStyle(session.name)}>{initials(session.name)}</span>
                      <span>
                        <b>{session.name}</b>
                        <small>to {sample?.email || "a lead"}</small>
                      </span>
                    </div>
                    <h3>{preview?.subject || "No subject yet"}</h3>
                    <div className={styles.paperBody} dangerouslySetInnerHTML={{ __html: letterMarkup(preview?.body || "") }} />
                  </article>
                </aside>
                </>
              )}
              </div>
            </Drawer>
          ) : null}
      </div>
    );
}
