"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { CrmState } from "@/lib/types";
import { confirmLinkFor, confirmQueue, defaultNextAvailable, recordAvailabilityConfirmation } from "@/lib/availability-confidence";
import { avatarStyle, formatDate, initials } from "@/lib/format";
import Button from "@/components/ui/Button";
import Icon from "@/components/ui/Icon";
import IconTile from "@/components/ui/IconTile";
import { useWorkspace } from "@/components/shell/WorkspaceContext";
import styles from "./ConfirmQueue.module.css";

/**
 * Confirm queue: the associates whose availability Qiko trusts least, ranked by how much an open
 * brief needs them. Confirm in one click from the team, or send the one-tap link the associate
 * answers themselves.
 */
export default function ConfirmQueue({ state }: { state: CrmState }) {
  const { toast } = useWorkspace();
  const items = useMemo(() => confirmQueue(state), [state]);
  const [dateFor, setDateFor] = useState<string | null>(null);
  const [date, setDate] = useState(defaultNextAvailable());
  // Closed by default; opening it is remembered per browser. Restored after hydration so server and client agree.
  const [collapsed, setCollapsed] = useState(true);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        if (window.localStorage.getItem("qiko-confirm-collapsed") === "0") setCollapsed(false);
      } catch {
        /* storage unavailable */
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  const toggleCollapsed = () => {
    setCollapsed((value) => {
      try {
        window.localStorage.setItem("qiko-confirm-collapsed", value ? "0" : "1");
      } catch {
        /* storage unavailable */
      }
      return !value;
    });
  };
  if (items.length === 0) return null;

  const copyLink = async (associateId: string, name: string) => {
    const url = `${window.location.origin}${confirmLinkFor(associateId)}`;
    try {
      await navigator.clipboard.writeText(url);
      toast(`Confirm link for ${name} copied. One tap and the record updates.`);
    } catch {
      toast(`Confirm link: ${url}`, "info");
    }
  };

  return (
    <section className={`card ${styles.card}`} aria-labelledby="confirm-title" data-collapsed={collapsed || undefined}>
      <div className={styles.head}>
        <button type="button" className={styles.headCopy} onClick={toggleCollapsed} aria-expanded={!collapsed} aria-controls="confirm-body">
          <IconTile name="userCheck" tone="qiko" size="md" />
          <div>
            <p className="kicker kicker-qiko">Qiko · Confirm queue</p>
            <h2 id="confirm-title">
              Availability Qiko would not bet on yet
              <Icon name="chevronDown" size={16} className={styles.chevron} />
            </h2>
            <p className={styles.sub}>{collapsed ? "Collapsed. Open to confirm availability or send the one-tap link." : "Ranked by how little the record has been confirmed and how much an open brief needs the person. Confirm here, or send the one-tap link."}</p>
          </div>
        </button>
        <span className={styles.count}>
          <b className="tabular">{items.length}</b> to confirm
        </span>
      </div>
      {collapsed ? null : (
      <ol className={styles.list} id="confirm-body">
        {items.map((item) => (
          <li key={item.associate.id} className={styles.row}>
            <Link href={`/staffing/associates/${item.associate.id}`} className={styles.who}>
              <span className="avatar" style={avatarStyle(item.associate.name)}>
                {initials(item.associate.name)}
              </span>
              <span>
                <b>{item.associate.name}</b>
                <small>{item.associate.headline}</small>
              </span>
            </Link>
            <div className={styles.confidence} data-band={item.confidence.band}>
              <span className={styles.meter} aria-hidden="true">
                <i style={{ width: `${item.confidence.score}%` }} />
              </span>
              <span className={styles.confidenceLabel}>
                <b className="tabular">{item.confidence.score}</b> {item.confidence.label}
              </span>
              <small>{item.confidence.reasons[0]?.text}</small>
            </div>
            <div className={styles.need}>
              <span className={`chip ${item.needed?.startsWith("Shortlisted") ? "chip-ai" : ""}`}>{item.associate.availability}</span>
              {item.needed ? (
                item.requirementId ? (
                  <Link href={`/staffing/requirements/${item.requirementId}`} className={styles.needLink}>
                    {item.needed}
                  </Link>
                ) : (
                  <small>{item.needed}</small>
                )
              ) : (
                <small>No open brief needs them yet</small>
              )}
            </div>
            <div className={styles.actions}>
              {dateFor === item.associate.id ? (
                <span className={styles.dateRow}>
                  <input type="date" className="input" value={date} onChange={(event) => setDate(event.target.value)} aria-label="Next available date" />
                  <Button
                    size="small"
                    variant="qiko"
                    onClick={() => {
                      recordAvailabilityConfirmation(item.associate.id, "limited", date, "team");
                      setDateFor(null);
                      toast(`${item.associate.name} confirmed: next available ${formatDate(date)}`);
                    }}
                  >
                    Save
                  </Button>
                  <button type="button" className="link-button" onClick={() => setDateFor(null)}>
                    Cancel
                  </button>
                </span>
              ) : (
                <>
                  <Button
                    size="small"
                    variant="qiko"
                    icon="check"
                    onClick={() => {
                      recordAvailabilityConfirmation(item.associate.id, "available", null, "team");
                      toast(`${item.associate.name} confirmed available`);
                    }}
                  >
                    Available
                  </Button>
                  <Button size="small" variant="secondary" icon="calendar" onClick={() => setDateFor(item.associate.id)}>
                    From a date
                  </Button>
                  <button type="button" className={styles.linkBtn} onClick={() => copyLink(item.associate.id, item.associate.name)} title="Copy the one-tap confirm link">
                    <Icon name="link" size={13} /> Copy link
                  </button>
                  <Link href={confirmLinkFor(item.associate.id)} target="_blank" rel="noopener" className={styles.linkBtn} title="Open what the associate sees">
                    <Icon name="external" size={13} />
                  </Link>
                </>
              )}
            </div>
          </li>
        ))}
      </ol>
      )}
    </section>
  );
}
