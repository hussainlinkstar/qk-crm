"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";
import Select from "@/components/ui/Select";
import { SkeletonRows } from "@/components/ui/bits";
import { useWorkspace } from "@/components/shell/WorkspaceContext";
import { campaignStats } from "@/lib/signal-growth/engine";
import { growth, previewTemplate, useGrowth } from "@/lib/signal-growth/store";
import sales from "@/app/(workspace)/sales/sales.module.css";
import { PageHero } from "@/components/ui/workspace";

export default function EmailPage() {
  const state = useGrowth();
  const { toast } = useWorkspace();
  const [templateId, setTemplateId] = useState("tm_audit");
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [offerEnd, setOfferEnd] = useState("Friday");
  const [campaignName, setCampaignName] = useState("New campaign");
  const [segmentId, setSegmentId] = useState("sg_uae");
  const [when, setWhen] = useState("");
  const [limit, setLimit] = useState<number | null>(null);
  if (!state) return <div className="page"><SkeletonRows rows={4} /></div>;
  const template = state.templates.find((item) => item.id === templateId) ?? state.templates[0];
  const sample = state.leads.find((lead) => !lead.dnc.email) ?? state.leads[0];
  const preview = template && sample ? previewTemplate(template.id, sample.id, window.location.origin) : null;

  return (
    <div className="page">
      <PageHero kicker="Signal" title="Email" lede="One-off campaigns from the same lead list. Outreach uses its own daily send limit while the domain warms up." />

      <section className="card">
        <div className="card-head">
          <div>
            <h2>Sent today {state.caps.emailsSent} / {state.caps.emailLimit}</h2>
            <p className="card-sub">The limit stops the rest of a campaign for the day.</p>
          </div>
          <div className="page-actions">
            <input className="input" type="number" min={0} value={limit ?? state.caps.emailLimit} onChange={(event) => setLimit(Number(event.target.value))} aria-label="Daily send limit" style={{ width: 120 }} />
            <Button variant="secondary" onClick={() => { growth.setEmailLimit(limit ?? state.caps.emailLimit); toast("Send limit saved"); }}>Save limit</Button>
          </div>
        </div>
      </section>

      <div className={sales.overviewGrid}>
        <section className="card">
          <div className="card-head"><h2>Templates</h2></div>
          <div className="card-body">
            <div className="segmented" role="group" aria-label="Templates">
              {state.templates.map((item) => (
                <button type="button" key={item.id} aria-pressed={templateId === item.id} onClick={() => { setTemplateId(item.id); setName(item.name); setSubject(item.subject); setBody(item.body); setOfferEnd(item.offerEnd); }}>{item.name}</button>
              ))}
            </div>
            <div className="form-grid" style={{ marginTop: 14 }}>
              <label className="field"><span>Template name</span><input className="input" value={name} onChange={(event) => setName(event.target.value)} placeholder={template?.name} /></label>
              <label className="field"><span>Subject</span><input className="input" value={subject || template?.subject || ""} onChange={(event) => setSubject(event.target.value)} /></label>
              <label className="field"><span>Body</span><textarea className="input" rows={6} value={body || template?.body || ""} onChange={(event) => setBody(event.target.value)} /></label>
              <p className="card-sub">Merge fields: first name, company, site, AIO, SEO, top problem, report link, offer end. An empty value uses the fallback, never the code.</p>
              <div className="page-actions">
                <Button variant="secondary" onClick={() => { growth.saveTemplate({ id: templateId, name: name || template?.name || "Template", subject: subject || template?.subject || "", body: body || template?.body || "", offerEnd }); toast("Template saved"); }}>Save</Button>
                <Button variant="ghost" onClick={() => toast(growth.sendTest(template?.id ?? "", window.location.origin))}>Send test to me</Button>
              </div>
              {preview && (
                <div className="notice-banner">
                  <div><b>{preview.subject}</b><p>{preview.body}</p></div>
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="card">
          <div className="card-head"><h2>Campaigns</h2></div>
          <div className="card-body">
            <form className="form-grid" onSubmit={(event) => { event.preventDefault(); growth.scheduleCampaign({ name: campaignName, templateId: template?.id ?? "", segmentId, scheduledFor: when }); toast(when ? "Scheduled. It sends within 5 minutes of that time." : "Draft saved."); }}>
              <label className="field"><span>Name</span><input className="input" value={campaignName} onChange={(event) => setCampaignName(event.target.value)} required /></label>
              <label className="field">
                <span>Segment</span>
                <Select className="select" value={segmentId} onChange={(event) => setSegmentId(event.target.value)}>
                  {state.segments.map((segment) => <option key={segment.id} value={segment.id}>{segment.name}</option>)}
                </Select>
              </label>
              <label className="field"><span>Send at</span><input className="input" type="datetime-local" value={when} onChange={(event) => setWhen(event.target.value)} /></label>
              <Button type="submit" variant="secondary">Schedule</Button>
            </form>
            <div className="form-grid" style={{ marginTop: 16 }}>
              {state.campaigns.map((campaign) => {
                const stats = campaignStats(state, campaign.id);
                return (
                  <article key={campaign.id} className="notice-banner">
                    <div>
                      <div className="page-actions" style={{ marginBottom: 4 }}><b>{campaign.name}</b><span className="chip">{campaign.status}</span></div>
                      <p className="card-sub">{campaign.timezoneNote}{campaign.scheduledFor ? ` · ${new Date(campaign.scheduledFor).toLocaleString()}` : ""}</p>
                      <p className="card-sub">Sent {stats.sent} · Delivered {stats.delivered} · Opened {stats.opened} · Clicked {stats.clicked} · Replied {stats.replied} · Signed up {stats.signedUp} · Paid {stats.paid}</p>
                      {campaign.status !== "sent" && <Button size="small" onClick={() => toast(growth.sendCampaign(campaign.id, window.location.origin))}>Send now</Button>}
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
