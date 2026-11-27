"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import BarList from "@/components/ui/BarList";
import CountUp from "@/components/ui/CountUp";
import IconTile, { type IconTone } from "@/components/ui/IconTile";
import type { IconName } from "@/components/ui/Icon";
import Select from "@/components/ui/Select";
import { SkeletonRows } from "@/components/ui/bits";
import { useWorkspace } from "@/components/shell/WorkspaceContext";
import pricing from "@/components/sales/PricingIntelligence.module.css";
import { FUNNEL, fullName, funnelCounts, inDateRange, lastTouch, planOf } from "@/lib/signal-growth/engine";
import { resetGrowth, useGrowth } from "@/lib/signal-growth/store";
import type { Stage } from "@/lib/signal-growth/types";
import Button from "@/components/ui/Button";
import buttonStyles from "@/components/ui/Button.module.css";
import { AskBar, DecisionBanner, FilterRow, OutcomeGrid, PageHero, PillLink } from "@/components/ui/workspace";
import signal from "./signal.module.css";

const URGENCY: Stage[] = ["Checkout started", "Replied", "Signed up", "Audit run", "Contacted", "New", "Paid", "Lost"];

const TOUCHES: Array<{ key: "email" | "whatsapp" | "linkedin" | "Direct"; label: string; icon: IconName; tone: IconTone }> = [
  { key: "email", label: "Email", icon: "mail", tone: "brand" },
  { key: "whatsapp", label: "WhatsApp", icon: "whatsapp", tone: "success" },
  { key: "linkedin", label: "LinkedIn", icon: "linkedin", tone: "info" },
  { key: "Direct", label: "Direct", icon: "globe", tone: "muted" },
];

export default function GrowthHome() {
  const state = useGrowth();
  const { askQiko } = useWorkspace();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [channel, setChannel] = useState("");

  const leads = useMemo(() => {
    if (!state) return [];
    return state.leads.filter((lead) => inDateRange(lead.createdAt, from, to) && (!channel || lastTouch(lead) === channel));
  }, [state, from, to, channel]);

  if (!state) {
    return (
      <div className="page">
        <SkeletonRows rows={4} height={110} />
      </div>
    );
  }

  const counts = funnelCounts(leads);
  const paid = leads.filter((lead) => lead.stage === "Paid");
  const free = leads.filter((lead) => planOf(lead) === "Free");
  const upgraded = paid.length;
  const days = paid
    .map((lead) => {
      const start = lead.history.find((mark) => mark.stage === "Signed up")?.at;
      const end = lead.history.find((mark) => mark.stage === "Paid")?.at;
      if (!start || !end) return null;
      return (new Date(end).getTime() - new Date(start).getTime()) / 86_400_000;
    })
    .filter((value): value is number => value != null);
  const avgDays = days.length ? Math.round(days.reduce((sum, value) => sum + value, 0) / days.length) : 0;
  const credits = state.caps.apolloUsed + state.caps.auditsUsed;
  const rate = free.length + upgraded ? Math.round((upgraded / Math.max(free.length + upgraded, 1)) * 100) : 0;
  const next = [...leads].filter((lead) => lead.stage !== "Paid" && lead.stage !== "Lost").sort((a, b) => URGENCY.indexOf(a.stage) - URGENCY.indexOf(b.stage))[0];
  const recovered = leads.filter((lead) => lead.stage === "Paid" && lead.timeline.some((event) => event.summary.toLowerCase().includes("checkout") && event.kind === "sent")).length;
  const touchCounts = TOUCHES.map((channel) => ({
    ...channel,
    count: paid.filter((lead) => lastTouch(lead) === channel.key).length,
  }));
  const funnelRows = FUNNEL.map((step, index) => ({
    key: step.key,
    label: step.label,
    value: counts[index] ?? 0,
    href: step.key === "leads" ? "/growth/leads" : `/growth/leads?stage=${encodeURIComponent(step.key)}`,
    tone: "brand" as const,
  }));
  const paidLead = paid[0];
  const headline = upgraded === 1 && paidLead
    ? `${fullName(paidLead)}${paidLead.company ? ` · ${paidLead.company}` : ""} is the paid user in this range`
    : upgraded > 1
      ? `${upgraded} leads in this range have paid`
      : leads.length
        ? "No lead in this range has paid yet"
        : "No leads in this range";

  return (
    <div className="page">
      <PageHero
        kicker="Signal"
        title="Signal growth"
        lede="Which messages bring paying users. This panel is for the Qiko team. Existing Signal users are already imported as leads."
        action={
          <>
            <Button variant="secondary" onClick={() => resetGrowth()}>Reset sample</Button>
            <Link href="/growth/leads" className={`${buttonStyles.button} ${buttonStyles.primary} ${buttonStyles.medium}`}>Open leads</Link>
          </>
        }
      />

      <FilterRow label="Date and channel">
        <input className="input" type="date" aria-label="From" value={from} onChange={(event) => setFrom(event.target.value)} />
        <input className="input" type="date" aria-label="To" value={to} onChange={(event) => setTo(event.target.value)} />
        <Select className="select" value={channel} onChange={(event) => setChannel(event.target.value)} aria-label="Last-touch channel">
          <option value="">All channels</option>
          <option value="email">Email</option>
          <option value="whatsapp">WhatsApp</option>
          <option value="linkedin">LinkedIn</option>
          <option value="Direct">Direct</option>
        </Select>
      </FilterRow>

      <AskBar
        placeholder="Ask Qiko who to contact, what is stuck, or what to do next…"
        prompts={["Who is closest to paying?", "Which checkout needs a follow-up?", "Who should not be contacted?", "What should I do next?"]}
        onAsk={(question) => askQiko(question)}
      />

      {next ? (
        <DecisionBanner
          kicker="Qiko · Best next move"
          context={next.stage}
          title={`Move ${fullName(next)} forward`}
          summary={`${next.company || "No company"} · ${next.title || next.source}. ${next.tasks.find((task) => !task.done)?.text ?? `Currently ${next.stage.toLowerCase()}.`}`}
          facts={[
            { icon: "mail", text: next.email },
            { icon: "zap", text: `Last touch ${lastTouch(next)} · plan ${planOf(next)}` },
          ]}
          action={<PillLink href={`/growth/leads/${next.id}`}>Open lead</PillLink>}
          link={{ href: "/growth/pipeline", label: "Open pipeline" }}
        />
      ) : null}

      <OutcomeGrid
        tiles={[
          { key: "leads", href: "/growth/leads", label: "Leads", numeric: leads.length, sub: `${free.length} on Free`, icon: "users", iconTone: "brand", tone: "brand", series: counts, kind: "bars", seriesLabel: "People by funnel step" },
          { key: "paid", href: "/growth/leads?stage=Paid", label: "Paid", numeric: upgraded, sub: `${rate}% free to paid`, icon: "trendUp", iconTone: "success", tone: "success", series: [free.length, upgraded], kind: "bars", seriesLabel: "Free and paid" },
          { key: "days", href: "/growth/leads", label: "Days to upgrade", numeric: avgDays, sub: "Sign-up to paid", icon: "clock", iconTone: "info", tone: "brand", series: days.length ? days : [0], kind: "line", seriesLabel: "Days from sign-up to paid" },
          { key: "credits", href: "/growth/apollo", label: "Credits per paid", value: upgraded ? String(Math.round(credits / upgraded)) : "—", sub: `${credits} credits used`, icon: "sparkles", iconTone: "qiko", tone: "qiko" },
        ]}
      />

      <section className={`card ${pricing.card}`} aria-labelledby="signal-funnel-title">
        <div className={pricing.head}>
          <div className={pricing.headCopy}>
            <IconTile name="sparkles" tone="qiko" size="md" />
            <div>
              <p className="kicker kicker-qiko">Qiko · Signal growth</p>
              <h2 id="signal-funnel-title">{headline}</h2>
              <p className={pricing.sub}>Each paid user sits in one channel, or Direct.</p>
            </div>
          </div>
          <div className={pricing.avg}>
            <b className="tabular"><CountUp value={upgraded} /></b>
            <span>paid</span>
          </div>
        </div>

        <div className={pricing.grid}>
          <div className={pricing.col}>
            <div className={signal.colHead}>
              <h3 className="kicker">Funnel</h3>
              <Link href="/growth/leads" className="text-link">Open leads</Link>
            </div>
            <BarList rows={funnelRows} label="Funnel" />
            <p className={pricing.quiet}>Checkouts recovered by a follow-up: {recovered}</p>
          </div>

          <div className={pricing.col}>
            <h3 className="kicker">Last touch before payment</h3>
            <ul className={signal.touchList} aria-label="Last touch before payment">
              {touchCounts.map((channel) => (
                <li key={channel.key}>
                  <Link href="/growth/leads" className={signal.touchRow}>
                    <IconTile name={channel.icon} tone={channel.tone} size="sm" />
                    <b>{channel.label}</b>
                    <span className={`${signal.touchCount} tabular`}>{channel.count} paid</span>
                  </Link>
                </li>
              ))}
            </ul>
            <p className={pricing.quiet}>Apollo credits {state.caps.apolloUsed}/{state.caps.apolloCap} · Audit credits {state.caps.auditsUsed}/{state.caps.auditCap}</p>
          </div>
        </div>
      </section>
    </div>
  );
}
