"use client";

import { useRef, useState } from "react";
import Button from "@/components/ui/Button";
import Icon from "@/components/ui/Icon";
import Select from "@/components/ui/Select";
import { SkeletonRows } from "@/components/ui/bits";
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

export default function EmailPage() {
  const state = useGrowth();
  const { toast, session } = useWorkspace();
  const bodyRef = useRef<HTMLTextAreaElement>(null);
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
  };

  const loadCampaign = (item: Campaign) => {
    const source = state.templates.find((row) => row.id === item.templateId);
    setCampaignId(item.id);
    setSegmentId(item.segmentId);
    setCampaignName(item.name);
    setWhen(toLocalInput(item.scheduledFor));
    setAttachments([]);
    setPanel("");
    if (!source) return;
    setTemplateId(source.id);
    setName(source.name);
    setSubject(source.subject);
    setBody(source.body);
    setOfferEnd(source.offerEnd);
  };

  const insert = (snippet: string) => {
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

  const sendNow = () => {
    if (!subject.trim() || !body.trim()) {
      toast("Add a subject and a message first.");
      return;
    }
    const id = persistTemplate();
    let target = campaign && campaign.status !== "sent" ? campaign.id : "";
    const payload = { name: campaignName.trim() || name.trim() || "Untitled", templateId: id, segmentId, scheduledFor: "" };
    if (target) growth.updateCampaign(target, payload);
    else {
      target = growth.scheduleCampaign(payload);
      setCampaignId(target);
    }
    toast(growth.sendCampaign(target, origin));
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
  const cap = Math.max(state.caps.emailLimit, 1);
  const used = Math.min(100, Math.round((state.caps.emailsSent / cap) * 100));
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
  };

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <p className="kicker">Signal</p>
          <h1>Email studio</h1>
          <p className="subtitle">Write the letter, watch it land in their inbox, then save, schedule, or send. A send uses the subject and body and stops at today’s limit.</p>
        </div>
        <div className={styles.capacity}>
          <div>
            <b className="tabular">{state.caps.emailsSent} of {state.caps.emailLimit}</b>
            <small>sent today</small>
            <div className={styles.meter} data-hot={used >= 80 ? "true" : undefined}><span style={{ width: `${used}%` }} /></div>
          </div>
          <input className={`input ${styles.capField}`} type="number" min={0} value={limit ?? state.caps.emailLimit} onChange={(event) => setLimit(Number(event.target.value))} aria-label="Daily send limit" />
          <Button size="small" variant="secondary" onClick={() => { growth.setEmailLimit(limit ?? state.caps.emailLimit); toast("Send limit saved"); }}>Save</Button>
        </div>
      </header>

      <div className={styles.studio}>
        <aside className={styles.library} aria-label="Templates and drafts">
          <Button icon="plus" variant="secondary" fullWidth onClick={startBlank}>New letter</Button>
          <p className={styles.groupLabel}>Templates</p>
          {state.templates.map((item) => (
            <button type="button" key={item.id} className={styles.mailCard} aria-current={!campaignId && templateId === item.id ? "true" : undefined} onClick={() => loadTemplate(item)}>
              <i className={styles.pip} data-tone="template" />
              <span>
                <b>{item.name}</b>
                <small>{readableSubject(item.subject)}</small>
              </span>
            </button>
          ))}
          {groups.map((group) => group.items.length ? (
            <div key={group.label}>
              <p className={styles.groupLabel}>{group.label}</p>
              {group.items.map((item) => (
                <button type="button" key={item.id} className={styles.mailCard} aria-current={campaignId === item.id ? "true" : undefined} onClick={() => loadCampaign(item)}>
                  <i className={styles.pip} data-tone={group.tone} />
                  <span>
                    <b>{item.name}</b>
                    <small>{item.scheduledFor ? formatDateTime(item.scheduledFor) : item.status}</small>
                  </span>
                </button>
              ))}
            </div>
          ) : null)}
        </aside>

        <section className={styles.letter} aria-label="Email composer">
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
            <input className={styles.draftName} value={campaignName} onChange={(event) => setCampaignName(event.target.value)} aria-label="Draft name" placeholder="Draft name" />
          </div>

          <input className={styles.subject} value={subject} onChange={(event) => setSubject(event.target.value)} aria-label="Subject" placeholder="The line they see first" />

          <div className={styles.dock} role="toolbar" aria-label="Formatting">
            <button type="button" className={styles.tool} aria-label="Bold" onClick={() => wrap("**", "**")}><span className={styles.toolMark}>B</span></button>
            <button type="button" className={styles.tool} aria-label="Italic" onClick={() => wrap("*", "*")}><span className={styles.toolMark}><em>I</em></span></button>
            <button type="button" className={styles.tool} aria-label="Bulleted list" onClick={bullet}><Icon name="list" size={15} /></button>
            <button type="button" className={styles.tool} aria-label="Insert link" aria-expanded={panel === "link"} onClick={() => setPanel(panel === "link" ? "" : "link")}><Icon name="link" size={15} /></button>
            <span className={styles.dockSplit} />
            <button type="button" className={styles.tool} aria-label="Insert emoji" aria-expanded={panel === "emoji"} onClick={() => setPanel(panel === "emoji" ? "" : "emoji")}>Emoji</button>
            <span className={styles.spacer} />
            <button type="button" className={styles.tool} aria-label="Attach files" onClick={() => fileRef.current?.click()}><Icon name="file" size={15} /> Attach</button>
            <input ref={fileRef} type="file" multiple hidden onChange={(event) => addFiles(event.target.files)} />
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

          <div className={styles.mergeRow}>
            {MERGE.map(([key, label]) => (
              <button type="button" key={key} className={styles.token} onClick={() => insert(`{{${key}}}`)}>{label}</button>
            ))}
          </div>

          <textarea ref={bodyRef} className={styles.body} value={body} onChange={(event) => setBody(event.target.value)} aria-label="Message" placeholder="Start with their name. One reason to open the report." />

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
            <span className={styles.readTime}>{words ? `${plural(words, "word")} · ${seconds} sec to read` : "Empty letter"}</span>
            <label>
              Offer ends
              <input value={offerEnd} onChange={(event) => setOfferEnd(event.target.value)} aria-label="Offer end" />
            </label>
            <label>
              Send at
              <input type="datetime-local" value={when} onChange={(event) => setWhen(event.target.value)} aria-label="Send at" />
            </label>
          </div>
          <p className={styles.note}>
            A chip drops in that lead’s own value, or a fallback when the value is empty. Saving updates every place this template is used.
            {attachments.length ? " Files stay on this letter for the session. A send uses the subject and body." : ""}
          </p>
          <div className={styles.actions}>
            <Button variant="ghost" onClick={() => { const id = persistTemplate(); toast(growth.sendTest(id, origin)); }}>Send test</Button>
            <span className={styles.spacer} />
            <Button variant="secondary" onClick={() => saveDraft(false)}>Save draft</Button>
            <Button variant="secondary" icon="calendar" disabled={!when || sentCampaign} onClick={() => saveDraft(true)}>Schedule</Button>
            <Button icon="send" disabled={sentCampaign} onClick={sendNow}>{sentCampaign ? "Sent" : "Send now"}</Button>
          </div>
        </section>

        <aside className={styles.inbox} aria-label="Inbox preview">
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
                <small>to {sample?.email} · {segment?.name}</small>
              </span>
            </div>
            <h3>{preview?.subject || "No subject yet"}</h3>
            <div className={styles.paperBody} dangerouslySetInnerHTML={{ __html: renderBody(preview?.body || "") }} />
            {attachments.length ? (
              <div className={styles.files}>
                {attachments.map((file) => (
                  <span key={file.id} className={styles.fileCard}>
                    <span className={styles.fileMark}><Icon name="file" size={16} /></span>
                    <b>{file.name}</b>
                  </span>
                ))}
              </div>
            ) : null}
            {statTiles.length ? null : <p className={styles.note}>Open a sent letter to see delivery, opens, and replies.</p>}
          </article>
          {statTiles.length ? (
            <div className={styles.stats}>
              {statTiles.map(([label, value]) => (
                <div key={label}><b className="tabular">{value}</b><span>{label}</span></div>
              ))}
            </div>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
