"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import BarList from "@/components/ui/BarList";
import CountUp from "@/components/ui/CountUp";
import IconTile, { type IconTone } from "@/components/ui/IconTile";
import Icon, { type IconName } from "@/components/ui/Icon";
import Select from "@/components/ui/Select";
import { SkeletonRows } from "@/components/ui/bits";
import { useWorkspace } from "@/components/shell/WorkspaceContext";
import { FUNNEL, fullName, funnelCounts, inDateRange, lastTouch, matchLead, planOf } from "@/lib/signal-growth/engine";
import { resetGrowth, useGrowth } from "@/lib/signal-growth/store";
import { PLANS, SOURCES, STAGES, type Plan, type Source, type Stage } from "@/lib/signal-growth/types";
import Button from "@/components/ui/Button";
import buttonStyles from "@/components/ui/Button.module.css";
import { AskBar, DecisionBanner, OutcomeGrid, PillLink } from "@/components/ui/workspace";
import signal from "./signal.module.css";

const URGENCY: Stage[] = ["Checkout started", "Replied", "Signed up", "Audit run", "Contacted", "New", "Paid", "Lost"];

interface GrowthFilters {
  from: string;
  to: string;
  channel: string;
  stage: Stage | "";
  plan: Plan | "";
  source: Source | "";
  ownerId: string;
  country: string;
  industry: string;
}

const EMPTY_FILTERS: GrowthFilters = { from: "", to: "", channel: "", stage: "", plan: "", source: "", ownerId: "", country: "", industry: "" };

function FilterField({ icon, date, children }: { icon: IconName; date?: boolean; children: ReactNode }) {
  return (
    <div className={date ? `${signal.field} ${signal.dateField}` : signal.field}>
      <Icon name={icon} size={14} />
      {children}
    </div>
  );
}

const TOUCHES: Array<{ key: "email" | "whatsapp" | "linkedin" | "Direct"; label: string; icon: IconName; tone: IconTone }> = [
  { key: "email", label: "Email", icon: "mail", tone: "brand" },
  { key: "whatsapp", label: "WhatsApp", icon: "whatsapp", tone: "success" },
  { key: "linkedin", label: "LinkedIn", icon: "linkedin", tone: "info" },
  { key: "Direct", label: "Direct", icon: "globe", tone: "muted" },
];

export default function GrowthHome() {
  const state = useGrowth();
  const { askQiko } = useWorkspace();
  const [filters, setFilters] = useState<GrowthFilters>(EMPTY_FILTERS);
  const [moreOpen, setMoreOpen] = useState(false);
  const setField = <K extends keyof GrowthFilters>(key: K, value: GrowthFilters[K]) => setFilters((current) => ({ ...current, [key]: value }));

  const options = useMemo(() => {
    const leads = state?.leads ?? [];
    const present = <T extends string>(values: readonly T[], has: (value: T) => boolean) => values.filter(has);
    const unique = (values: string[]) => [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));
    return {
      stages: present(STAGES, (value) => leads.some((lead) => lead.stage === value)),
      plans: present(PLANS, (value) => leads.some((lead) => planOf(lead) === value)),
      sources: present(SOURCES, (value) => leads.some((lead) => lead.source === value)),
      owners: state?.owners.filter((owner) => leads.some((lead) => lead.ownerId === owner.id)) ?? [],
      unassigned: leads.some((lead) => !lead.ownerId),
      countries: unique(leads.map((lead) => lead.country)),
      industries: unique(leads.map((lead) => lead.industry)),
    };
  }, [state]);

  const leads = useMemo(() => {
    if (!state) return [];
    return state.leads.filter((lead) => inDateRange(lead.createdAt, filters.from, filters.to) && (!filters.channel || lastTouch(lead) === filters.channel) && matchLead(lead, filters));
  }, [state, filters]);

  const clearFilters = () => setFilters(EMPTY_FILTERS);
  const extraOn = [filters.country, filters.industry].filter(Boolean).length;
  const filtersOn = Object.values(filters).some(Boolean);

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
      <header className={signal.header}>
        <div className={signal.headerCopy}>
          <p className="kicker">Signal</p>
          <h1>Signal growth</h1>
          <p className={signal.headerSub}>Which messages bring paying users. Existing Signal users are already imported as leads.</p>
        </div>
        <div className={signal.headerActions}>
          <Button variant="secondary" onClick={() => resetGrowth()}>Reset sample</Button>
          <Link href="/growth/leads" className={`${buttonStyles.button} ${buttonStyles.primary} ${buttonStyles.medium}`}>Open leads</Link>
        </div>
      </header>

      <div className={signal.toolbar}>
        <div className={signal.toolbarLine}>
          <div className={signal.toolbarFields}>
          <FilterField icon="calendar" date><input className="input" type="date" aria-label="From" value={filters.from} onChange={(event) => setField("from", event.target.value)} /></FilterField>
          <FilterField icon="calendar" date><input className="input" type="date" aria-label="To" value={filters.to} onChange={(event) => setField("to", event.target.value)} /></FilterField>
          <FilterField icon="send">
            <Select className={signal.channel} value={filters.channel} onChange={(event) => setField("channel", event.target.value)} aria-label="Last-touch channel">
              <option value="">All channels</option>
              <option value="email">Email</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="linkedin">LinkedIn</option>
              <option value="Direct">Direct</option>
            </Select>
          </FilterField>
          <FilterField icon="board">
            <Select className={signal.channel} value={filters.stage} onChange={(event) => setField("stage", event.target.value as Stage | "")} aria-label="Stage">
              <option value="">All stages</option>
              {options.stages.map((item) => <option key={item} value={item}>{item}</option>)}
            </Select>
          </FilterField>
          <FilterField icon="coins">
            <Select className={signal.channel} value={filters.plan} onChange={(event) => setField("plan", event.target.value as Plan | "")} aria-label="Plan">
              <option value="">All plans</option>
              {options.plans.map((item) => <option key={item} value={item}>{item}</option>)}
            </Select>
          </FilterField>
          <FilterField icon="target">
            <Select className={signal.channel} value={filters.source} onChange={(event) => setField("source", event.target.value as Source | "")} aria-label="Source">
              <option value="">All sources</option>
              {options.sources.map((item) => <option key={item} value={item}>{item}</option>)}
            </Select>
          </FilterField>
          <FilterField icon="users">
            <Select className={signal.channel} value={filters.ownerId} onChange={(event) => setField("ownerId", event.target.value)} aria-label="Owner">
              <option value="">All owners</option>
              {options.unassigned ? <option value="none">Unassigned</option> : null}
              {options.owners.map((owner) => <option key={owner.id} value={owner.id}>{owner.name}</option>)}
            </Select>
          </FilterField>
          </div>
          <div className={signal.toolbarEnd}>
            {filtersOn ? <Button variant="ghost" className={signal.filterBtn} icon="x" onClick={clearFilters}>Clear</Button> : null}
            <Button variant="secondary" className={`${signal.filterBtn} ${signal.moreBtn}`} icon="filter" iconRight="chevronDown" aria-expanded={moreOpen} onClick={() => setMoreOpen((open) => !open)}>
              More{extraOn ? ` · ${extraOn}` : ""}
            </Button>
          </div>
        </div>
        {moreOpen ? (
          <div className={signal.moreRow} role="group" aria-label="More filters">
            <FilterField icon="globe">
              <Select className={signal.channel} value={filters.country} onChange={(event) => setField("country", event.target.value)} aria-label="Country">
                <option value="">All countries</option>
                {options.countries.map((item) => <option key={item} value={item}>{item}</option>)}
              </Select>
            </FilterField>
            <FilterField icon="briefcase">
              <Select className={signal.channel} value={filters.industry} onChange={(event) => setField("industry", event.target.value)} aria-label="Industry">
                <option value="">All industries</option>
                {options.industries.map((item) => <option key={item} value={item}>{item}</option>)}
              </Select>
            </FilterField>
          </div>
        ) : null}
      </div>

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

      <div className={signal.pair}>
        <section className={`card ${signal.panel}`} aria-labelledby="signal-funnel-title">
          <div className={signal.panelHead}>
            <div>
              <h2 id="signal-funnel-title">Funnel</h2>
            </div>
            <Link href="/growth/leads" className="text-link">Open leads</Link>
          </div>
          <BarList rows={funnelRows} label="Funnel" />
          <p className={signal.quiet}>Checkouts recovered by a follow-up: {recovered}</p>
        </section>

        <section className={`card ${signal.panel}`} aria-labelledby="signal-paid-title">
          <div className={signal.panelHead}>
            <div>
              <p className="kicker">Last touch before payment</p>
              <h2 id="signal-paid-title">{headline}</h2>
              <p className={signal.panelNote}>Each paid user sits in one channel, or Direct.</p>
            </div>
            <div className={signal.paidStat}>
              <b className="tabular"><CountUp value={upgraded} /></b>
              <span>paid</span>
            </div>
          </div>
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
          <p className={signal.quiet}>Apollo credits {state.caps.apolloUsed}/{state.caps.apolloCap} · Audit credits {state.caps.auditsUsed}/{state.caps.auditCap}</p>
        </section>
      </div>
    </div>
  );
}
