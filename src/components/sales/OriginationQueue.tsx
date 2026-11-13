"use client";

import { useEffect, useMemo, useState } from "react";
import { crm } from "@/lib/crm-store";
import { originationQueue, type OriginationItem, type OriginationKind } from "@/lib/origination";
import { isOpen } from "@/lib/insights";
import Button from "@/components/ui/Button";
import Icon from "@/components/ui/Icon";
import IconTile, { type IconTone } from "@/components/ui/IconTile";
import type { IconName } from "@/components/ui/Icon";
import { useNow, useWorkspaceData } from "@/components/ui/bits";
import { useWorkspace } from "@/components/shell/WorkspaceContext";
import FeedbackThumbs from "@/components/ui/FeedbackThumbs";
import styles from "./OriginationQueue.module.css";

const KIND: Record<OriginationKind, { icon: IconName; tone: IconTone; label: string }> = {
  renewal: { icon: "clock", tone: "warning", label: "Engagement ending" },
  expansion: { icon: "rocket", tone: "brand", label: "Unbought interest" },
  "follow-on": { icon: "trendUp", tone: "success", label: "Won, nothing behind it" },
  introduction: { icon: "handshake", tone: "qiko", label: "SIA introduction" },
  dormant: { icon: "users", tone: "muted", label: "Gone quiet" },
};

const INITIAL = 4;

/**
 * Lead origination queue: Qiko's list of where the next leads come from, each with the record
 * evidence behind it and a one-click way to turn it into a lead or a task.
 */
export default function OriginationQueue({ onOpenLead }: { onOpenLead?: (leadId: string) => void }) {
  const { state } = useWorkspaceData();
  const now = useNow();
  const { toast, openTaskForm, askQiko } = useWorkspace();
  const [filter, setFilter] = useState<OriginationKind | null>(null);
  const [expanded, setExpanded] = useState(false);
  // Closed by default; opening it is remembered per browser. Restored after hydration so server and client agree.
  const [collapsed, setCollapsed] = useState(true);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        if (window.localStorage.getItem("qiko-origination-collapsed") === "0") setCollapsed(false);
      } catch {
        /* storage unavailable */
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  const toggleCollapsed = () => {
    setCollapsed((value) => {
      try {
        window.localStorage.setItem("qiko-origination-collapsed", value ? "0" : "1");
      } catch {
        /* storage unavailable */
      }
      return !value;
    });
  };
  const items = useMemo(() => (state ? originationQueue(state, now) : []), [state, now]);
  if (!state) return null;

  const counts = items.reduce<Record<string, number>>((acc, item) => ({ ...acc, [item.kind]: (acc[item.kind] ?? 0) + 1 }), {});
  const filtered = filter ? items.filter((item) => item.kind === filter) : items;
  const visible = expanded ? filtered : filtered.slice(0, INITIAL);
  const raised = (item: OriginationItem) => (item.task ? state.tasks.some((task) => task.title === item.task!.title && isOpen(task)) : false);

  const addLead = (item: OriginationItem) => {
    if (!item.lead || !item.contact || !item.accountId) return;
    const account = state.tessiant?.accounts.find((entry) => entry.id === item.accountId);
    const result = crm.addLead(
      {
        name: item.contact.name,
        email: item.contact.email,
        phone: item.contact.phone,
        company: item.accountName,
        role: item.contact.role,
        source: item.lead.source,
        status: "New",
        ownerId: account?.primaryOwnerId ?? "me",
        accountId: item.accountId,
        sector: account?.sector ?? null,
        serviceInterest: item.lead.serviceInterest,
      },
      `Originated by Qiko: ${item.why} Evidence: ${item.evidence}.`,
    );
    if (result.ok) {
      toast(`Lead added for ${item.contact.name}`);
      onOpenLead?.(result.id);
    } else {
      toast(`${item.contact.name} is already a lead`, "info");
      onOpenLead?.(result.existingId);
    }
  };

  const raiseTask = (item: OriginationItem) => {
    if (!item.task) return;
    openTaskForm({
      title: "Origination",
      origin: "suggestion",
      initial: { title: item.task.title, description: item.task.description, priority: item.impact === 3 ? "high" : "medium", due: null, ownerId: "me", leadId: null, accountId: item.accountId },
      evidence: [{ label: item.evidence, source: "Qiko origination", kind: item.evidenceKind }],
    });
  };

  return (
    <section className={`card ${styles.queue}`} aria-labelledby="origination-title" data-collapsed={collapsed || undefined}>
      <div className={styles.head}>
        <button type="button" className={styles.headCopy} onClick={toggleCollapsed} aria-expanded={!collapsed} aria-controls="origination-body">
          <IconTile name="compass" tone="qiko" size="lg" />
          <div>
            <p className="kicker kicker-qiko">Qiko · Origination queue</p>
            <h2 id="origination-title">
              The next leads, before anyone asks
              <span className={styles.count}>{items.length}</span>
              <Icon name="chevronDown" size={16} className={styles.chevron} />
            </h2>
            <p className={styles.sub}>{collapsed ? "Collapsed. Open to see where the next leads come from." : "Built from engagements ending, interests not yet bought, quiet stakeholders and SIA reach. Nothing here is a lead until you say so."}</p>
          </div>
        </button>
        {collapsed ? null : (
        <div className={styles.filters} role="group" aria-label="Filter by source">
          {(Object.keys(KIND) as OriginationKind[])
            .filter((kind) => counts[kind])
            .map((kind) => (
              <button key={kind} type="button" className={styles.filter} aria-pressed={filter === kind} onClick={() => setFilter((current) => (current === kind ? null : kind))}>
                <Icon name={KIND[kind].icon} size={12} />
                {KIND[kind].label}
                <span className="tabular">{counts[kind]}</span>
              </button>
            ))}
        </div>
        )}
      </div>

      {collapsed ? null : filtered.length === 0 ? (
        <p className={styles.empty}>
          <Icon name="checkCircle" size={14} /> Nothing waiting. Every account with a signal already has a lead or a deal open.
        </p>
      ) : (
        <ol className={styles.list} id="origination-body">
          {visible.map((item, index) => {
            const done = raised(item);
            return (
              <li key={item.id} className={styles.row} style={{ animationDelay: `${index * 40}ms` }}>
                <span className={styles.meter} data-level={item.impact} aria-label={`Impact ${item.impact} of 3`} />
                <IconTile name={KIND[item.kind].icon} tone={KIND[item.kind].tone} size="md" />
                <div className={styles.copy}>
                  <span className={styles.kind}>{KIND[item.kind].label}</span>
                  <b>{item.title}</b>
                  <p>{item.why}</p>
                  <span className={styles.evidence} data-kind={item.evidenceKind}>
                    <Icon name={item.evidenceKind === "fact" ? "check" : "sparkles"} size={11} strokeWidth={2.6} />
                    {item.evidence}
                  </span>
                </div>
                <div className={styles.actions}>
                  {item.lead && item.contact ? (
                    <Button size="small" variant="qiko" icon="userPlus" onClick={() => addLead(item)}>
                      Add {item.contact.name.split(" ")[0]} as lead
                    </Button>
                  ) : item.task ? (
                    done ? (
                      <span className={styles.raised}>
                        <Icon name="checkCircle" size={13} /> Task raised
                      </span>
                    ) : (
                      <Button size="small" variant="qiko" icon="tasks" onClick={() => raiseTask(item)}>
                        {item.kind === "introduction" ? "Ask for intro" : "Create task"}
                      </Button>
                    )
                  ) : null}
                  <button type="button" className="link-button" onClick={() => askQiko(`What do we know about ${item.accountName ?? item.title}?`)}>
                    Ask Qiko
                  </button>
                  <FeedbackThumbs feedbackKey={`origination:${item.id}`} context="signal" compact />
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {!collapsed && filtered.length > INITIAL ? (
        <button type="button" className={styles.more} onClick={() => setExpanded((value) => !value)} aria-expanded={expanded}>
          {expanded ? "Show fewer" : `View all ${filtered.length}`}
          <Icon name={expanded ? "chevronLeft" : "chevronRight"} size={13} />
        </button>
      ) : null}
    </section>
  );
}
