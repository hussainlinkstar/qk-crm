"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import Button from "@/components/ui/Button";
import Icon from "@/components/ui/Icon";
import IconTile from "@/components/ui/IconTile";
import { signalVisual } from "@/components/ui/signal-icons";
import { Drawer } from "@/components/ui/Overlay";
import { useWorkspace } from "@/components/shell/WorkspaceContext";
import { crm } from "@/lib/crm-store";
import { addDays, todayKey } from "@/lib/format";
import { opportunityBrief } from "@/lib/record-intelligence";
import { showcaseSignals } from "@/lib/showcase-signals";
import {
  consultingFollowOnDraft,
  leadSourceSummary,
  salesGrowthInsights,
  type GrowthInsight,
} from "@/lib/sales-growth";
import type { CrmState, Opportunity } from "@/lib/types";
import FeedbackThumbs from "@/components/ui/FeedbackThumbs";
import styles from "@/app/(workspace)/sales/sales.module.css";

const KIND_LABEL: Record<GrowthInsight["kind"], string> = {
  single_owner: "Relationship coverage",
  staffing_no_consulting: "Service expansion",
  network_connection: "Network connection",
};

const MAX_DEAL_INSIGHTS = 3;
/** Rail rows shown before "View all": enough to scan, not a wall. */
const INITIAL_CARDS = 4;

interface Signal {
  id: string;
  kind: string;
  title: string;
  why: string;
  evidence: string;
  action: string;
  /** 1–3, drives the impact meter and the ranking. */
  impact: 1 | 2 | 3;
  run: () => void;
  status?: string;
  /** Showcase signal built on seeded second-degree or market figures; shown with a demo tag. */
  demo?: boolean;
}

function dealSignal(why: string) {
  if (why.startsWith("Coverage")) return "Coverage";
  if (why.startsWith("Stalled")) return "Stalled";
  if (why.startsWith("Closing")) return "Closing";
  if (why.startsWith("Advisory")) return "Advisory";
  return "Deal";
}

function dealInsightScore(why: string, missing: string) {
  return (
    (why.startsWith("Coverage") ? 4 : 0) +
    (why.startsWith("Stalled") ? 3 : 0) +
    (why.startsWith("Closing") ? 2 : 0) +
    (missing !== "Nothing blocking" ? 1 : 0)
  );
}

function isDealSignal(why: string, missing: string) {
  return (
    why.startsWith("Coverage") ||
    why.startsWith("Stalled") ||
    why.startsWith("Closing") ||
    why.startsWith("Advisory") ||
    missing !== "Nothing blocking"
  );
}

function openDealInsights(state: CrmState) {
  const open = (state.opportunities ?? []).filter(
    (item) => item.stage !== "Closed Won" && item.stage !== "Closed Lost",
  );
  return open
    .map((opportunity) => {
      const brief = opportunityBrief(state, opportunity);
      return { opportunity, brief, score: dealInsightScore(brief.why, brief.missing) };
    })
    .filter((item) => isDealSignal(item.brief.why, item.brief.missing))
    .sort(
      (a, b) =>
        b.score - a.score || a.opportunity.expectedCloseDate.localeCompare(b.opportunity.expectedCloseDate),
    )
    .slice(0, MAX_DEAL_INSIGHTS);
}

export default function GrowthOpportunities({
  state,
  onOpenOpportunity,
}: {
  state: CrmState;
  onOpenOpportunity?: (opportunity: Opportunity) => void;
}) {
  const router = useRouter();
  const { toast, openTaskForm } = useWorkspace();
  const today = todayKey();
  const insights = useMemo(() => salesGrowthInsights(state, today), [state, today]);
  const dealInsights = useMemo(() => openDealInsights(state), [state]);
  const sources = useMemo(() => leadSourceSummary(state), [state]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [acted, setActed] = useState<Record<string, string>>({});
  const [expanded, setExpanded] = useState(false);
  const [spotId, setSpotId] = useState<string | null>(null);
  const selected = insights.find((item) => item.id === openId) ?? null;

  // One ranked list of everything Qiko has to say, deals first. The spotlight shows one; the rail lists the rest.
  const signals = useMemo<Signal[]>(() => {
    const deals: Signal[] = dealInsights.map(({ opportunity, brief, score }) => ({
      id: `deal-${opportunity.id}`,
      kind: dealSignal(brief.why),
      title: opportunity.name,
      why: brief.why,
      evidence: `${state.tessiant?.accounts.find((item) => item.id === opportunity.accountId)?.name ?? "Account"}${
        brief.missing !== "Nothing blocking" ? ` · ${brief.missing}` : " · nothing blocking"
      }`,
      action: brief.next,
      impact: score >= 4 ? 3 : score >= 2 ? 2 : 1,
      run: () => onOpenOpportunity?.(opportunity),
    }));
    const growth: Signal[] = insights.map((insight) => ({
      id: insight.id,
      kind: KIND_LABEL[insight.kind],
      title: insight.detected,
      why: insight.risk,
      evidence: insight.evidence,
      action: insight.actionLabel,
      impact: insight.kind === "single_owner" ? 3 : 2,
      run: () => setOpenId(insight.id),
      status: acted[insight.id],
    }));
    // Keep the rail varied: at most two network-reach rows, the rest are hiring and rate signals.
    const allShowcase = showcaseSignals(state);
    const keptReach = new Set(
      allShowcase
        .filter((signal) => signal.kind === "Network reach")
        .slice(0, 2)
        .map((signal) => signal.id),
    );
    const showcase: Signal[] = allShowcase
      .filter((signal) => signal.kind !== "Network reach" || keptReach.has(signal.id))
      .map((signal) => ({
      id: signal.id,
      kind: signal.kind,
      title: signal.title,
      why: signal.detail,
      evidence: signal.evidence,
      action: signal.action,
      impact: signal.impact,
      demo: true,
      run: () => {
        if (signal.kind === "Network reach" && signal.requirementId) {
          openTaskForm({
            title: "Request introductions",
            evidence: [{ label: signal.evidence, source: "Qiko network index", kind: "inference" }],
            initial: {
              title: `Request second-degree introductions · ${signal.title.replace(/^.*could fill /, "")}`,
              description: `[requirement:${signal.requirementId}] ${signal.detail}`,
              priority: "high",
              due: addDays(2),
              ownerId: "me",
              leadId: null,
              accountId: signal.accountId ?? null,
            },
          });
          return;
        }
        if (signal.kind === "Rate benchmark" && signal.opportunityId) {
          const opportunity = (state.opportunities ?? []).find((item) => item.id === signal.opportunityId);
          if (opportunity) onOpenOpportunity?.(opportunity);
          return;
        }
        router.push(signal.href);
      },
    }));
    // Deals and recorded relationship risks lead; estimated network signals support, never headline.
    const tier = (signal: Signal) => (signal.id.startsWith("deal-") ? 0 : signal.demo ? 2 : 1);
    return [...deals, ...growth, ...showcase].sort((a, b) => tier(a) - tier(b) || b.impact - a.impact);
  }, [dealInsights, insights, acted, onOpenOpportunity, state, openTaskForm, router]);

  const spotlight = signals.find((item) => item.id === spotId) ?? signals[0] ?? null;
  const rail = signals.filter((item) => item.id !== spotlight?.id);
  const railVisible = expanded ? rail : rail.slice(0, INITIAL_CARDS);
  const hiddenCards = rail.length - railVisible.length;

  const followUp = (insight: GrowthInsight) => {
    openTaskForm({
      title: "Assign follow-up",
      evidence: [{ label: insight.evidence, source: "Tessiant relationships", kind: "fact" }],
      initial: {
        title:
          insight.kind === "single_owner"
            ? `Second relationship owner · ${insight.accountName}`
            : `Follow up · ${insight.accountName}`,
        description: `[account:${insight.accountId}] ${insight.detected} ${insight.risk}`,
        priority: "medium",
        due: addDays(5),
        ownerId: "me",
        leadId: insight.leadId,
        accountId: insight.accountId,
        opportunityId: insight.opportunityId,
      },
      onCreated: () => setActed((current) => ({ ...current, [insight.id]: "Follow-up tasked" })),
    });
  };

  const createOpportunity = (insight: GrowthInsight) => {
    const draft = consultingFollowOnDraft(state, insight.accountId);
    if (!draft) {
      toast("Account missing", "error");
      return;
    }
    const id = crm.createOpportunity(draft);
    toast("Consultancy opportunity created — pipeline only, not realised revenue", "success");
    setActed((current) => ({ ...current, [insight.id]: "Opportunity created" }));
    setOpenId(null);
    router.push(`/sales/pipeline?opportunity=${id}`);
  };


  if (insights.length === 0 && dealInsights.length === 0 && sources.every((item) => item.count === 0)) return null;

  return (
    <>
      {spotlight ? (
        <section className={styles.growthSection} aria-label="Insights">
          <div className={styles.growthHead}>
            <div className={styles.growthHeadCopy}>
              <IconTile name="sparkles" tone="qiko" size="lg" />
              <div>
                <p className="kicker kicker-qiko">Qiko</p>
                <h2>What deserves attention</h2>
                <p className={styles.sourceSub}>
                  {signals.length} signals on open deals and recorded relationships, ranked by impact. Pick one to see why and act.
                </p>
              </div>
            </div>
          </div>

          <div className={styles.spotlight} data-tour="signals">
            <article key={spotlight.id} className={styles.spotHero}>
              <div className={styles.spotHeroTop}>
                <span className={styles.growthCardTop}>
                  <IconTile name={signalVisual(spotlight.kind).icon} tone={signalVisual(spotlight.kind).tone} size="md" />
                  <span className={styles.growthKind}>{spotlight.kind}</span>
                  {spotlight.demo ? <span className={styles.demoTag}>estimate</span> : null}
                </span>
                <span className={styles.spotImpact} aria-label={`Impact ${spotlight.impact} of 3`}>
                  <span>Impact</span>
                  <i data-on={spotlight.impact >= 1} />
                  <i data-on={spotlight.impact >= 2} />
                  <i data-on={spotlight.impact >= 3} />
                </span>
              </div>
              <h3>{spotlight.title}</h3>
              <p className={styles.spotWhy}>{spotlight.why}</p>
              <p className={styles.spotEvidence}>
                <Icon name="check" size={12} strokeWidth={2.6} />
                {spotlight.evidence}
              </p>
              <div className={styles.spotActions}>
                <Button variant="qiko" iconRight="arrowRight" onClick={spotlight.run}>
                  {spotlight.action}
                </Button>
                {spotlight.status ? <span className={styles.growthStatus}>{spotlight.status}</span> : null}
                <span className={styles.spotFeedback}>
                  <FeedbackThumbs feedbackKey={`signal:${spotlight.id}`} context="signal" />
                </span>
              </div>
            </article>

            <div className={styles.spotRail}>
              <div className={styles.spotRailHead}>
                <span>
                  {rail.length} more {rail.length === 1 ? "signal" : "signals"}
                </span>
                {rail.length > INITIAL_CARDS ? (
                  <button type="button" className={styles.viewAll} onClick={() => setExpanded((value) => !value)} aria-expanded={expanded}>
                    {expanded ? "Show fewer" : "View all"}
                    <Icon name={expanded ? "chevronLeft" : "chevronRight"} size={13} />
                  </button>
                ) : null}
              </div>
              {rail.length === 0 ? (
                <p className={styles.growthEmpty}>
                  <Icon name="checkCircle" size={14} /> That is the only open signal.
                </p>
              ) : (
                <ol className={styles.spotList} data-expanded={expanded ? "true" : undefined}>
                  {railVisible.map((item, index) => (
                    <li key={item.id} style={{ animationDelay: `${index * 40}ms` }}>
                      <button type="button" className={styles.spotRow} onClick={() => setSpotId(item.id)}>
                        <span className={styles.spotMeter} data-level={item.impact} aria-hidden="true" />
                        <IconTile name={signalVisual(item.kind).icon} tone={signalVisual(item.kind).tone} size="sm" />
                        <span className={styles.spotRowCopy}>
                          <b>{item.title}</b>
                          <small>
                            {item.kind}
                            {item.demo ? " · estimate" : ""} · {item.action}
                          </small>
                        </span>
                        <Icon name="chevronRight" size={14} />
                      </button>
                    </li>
                  ))}
                </ol>
              )}
              {!expanded && hiddenCards > 0 ? (
                <p className={styles.growthMore}>
                  {hiddenCards} more folded away.
                </p>
              ) : null}
            </div>
          </div>
          {selected ? (
            <GrowthDrawer
              insight={selected}
              state={state}
              status={acted[selected.id]}
              onClose={() => setOpenId(null)}
              onFollowUp={() => followUp(selected)}
              onOpportunity={() => createOpportunity(selected)}
            />
          ) : null}
        </section>
      ) : null}

      <section className={styles.sourceSection} aria-label="Lead sources">
        <div className={styles.growthHead}>
          <div>
            <h2>Lead sources</h2>
            <p className={styles.sourceSub}>Recorded origin, kept when a lead converts.</p>
          </div>
          <Link href="/sales/leads" className="text-link">
            Leads
          </Link>
        </div>
        <div className={styles.sourceStrip}>
          {sources.map((bucket) => (
            <Link key={bucket.id} href={bucket.href} className={styles.sourceCell}>
              <span>{bucket.label}</span>
              <b className="tabular">{bucket.count}</b>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}

function GrowthDrawer({
  insight,
  state,
  status,
  onClose,
  onFollowUp,
  onOpportunity,
}: {
  insight: GrowthInsight;
  state: CrmState;
  status?: string;
  onClose: () => void;
  onFollowUp: () => void;
  onOpportunity: () => void;
}) {
  const associate = insight.associateId ? state.tessiant?.associates.find((item) => item.id === insight.associateId) : null;
  const opportunity = insight.opportunityId ? state.opportunities.find((item) => item.id === insight.opportunityId) : null;
  const showMap = insight.kind === "network_connection" && Boolean(associate);
  const nextStep =
    insight.kind === "single_owner"
      ? "Add a second senior relationship owner to reduce account dependency."
      : insight.kind === "staffing_no_consulting"
        ? "Review the recorded delivery context before qualifying a consulting follow-on."
        : "Use the recorded assignment as context for a careful client follow-up.";

  return (
    <Drawer
      kicker="Qiko"
      title={insight.accountName}
      onClose={onClose}
      width={480}
      footer={
        <div className={styles.insightFooter}>
          {insight.actions.includes("review") ? (
            <Link href={insight.accountHref} className={styles.insightSecondary}>
              Review account
            </Link>
          ) : null}
          {insight.actions.includes("followup") ? <Button onClick={onFollowUp}>Assign follow-up</Button> : null}
          {insight.actions.includes("opportunity") ? (
            <Button variant="secondary" onClick={onOpportunity}>
              Create opportunity
            </Button>
          ) : null}
        </div>
      }
    >
      <div className={styles.insightDrawer}>
        <section className={styles.insightHero}>
          <div className={styles.insightKindRow}>
            <span className={styles.insightKindBadge}>{KIND_LABEL[insight.kind]}</span>
            <span className={styles.insightSignal}>Recorded signal</span>
          </div>
          <h3>{insight.detected}</h3>
          <p>{insight.risk}</p>
        </section>

        <section className={styles.insightEvidence}>
          <span>Recorded evidence</span>
          <p>{insight.evidence}</p>
        </section>

        {showMap && associate ? (
          <section className={styles.path} aria-label="Documented connections">
            <h3>Documented connection</h3>
            <ol>
              <li>
                <Link href={`/staffing/associates/${associate.id}`}>
                  <b>{associate.name}</b>
                  <span>Associate</span>
                </Link>
              </li>
              <li>
                <Link href={insight.accountHref}>
                  <b>{insight.accountName}</b>
                  <span>Account</span>
                </Link>
              </li>
              {opportunity ? (
                <li>
                  <Link href={`/sales/pipeline?opportunity=${opportunity.id}`}>
                    <b>{opportunity.name}</b>
                    <span>Opportunity</span>
                  </Link>
                </li>
              ) : null}
            </ol>
            {insight.assignmentId ? (
              <Link href={`/staffing/placements/${insight.assignmentId}`} className={styles.pathLink}>
                Open recorded assignment
              </Link>
            ) : null}
          </section>
        ) : (
          <div className={styles.recordList}>
            <Link href={insight.accountHref}>
              <b>{insight.accountName}</b>
              <small>Account</small>
            </Link>
            {opportunity ? (
              <Link href={`/sales/pipeline?opportunity=${opportunity.id}`}>
                <b>{opportunity.name}</b>
                <small>Opportunity</small>
              </Link>
            ) : null}
          </div>
        )}

        <section className={styles.insightNextStep}>
          <span>Recommended next step</span>
          <h3>{insight.actionLabel}</h3>
          <p>{nextStep}</p>
        </section>

        {status ? <p className={styles.growthStatus}>{status}</p> : null}
      </div>
    </Drawer>
  );
}
