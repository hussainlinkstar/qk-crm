"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { CrmState } from "@/lib/types";
import { benchTimeline, HORIZONS, type Horizon, type TimelineRow } from "@/lib/bench-timeline";
import { avatarStyle, formatDate, initials } from "@/lib/format";
import Icon from "@/components/ui/Icon";
import IconTile from "@/components/ui/IconTile";
import CountUp from "@/components/ui/CountUp";
import { useWorkspace } from "@/components/shell/WorkspaceContext";
import styles from "./BenchTimeline.module.css";

/**
 * 30/60/90-day bench and demand timeline. Each cell pairs projected bench (associates free by
 * then) against requirement headcount starting by then; a red cell is a gap Qiko expects before it
 * happens. Click a cell to see exactly who and which briefs are behind the number.
 */
export default function BenchTimeline({ state }: { state: CrmState }) {
  const { askQiko } = useWorkspace();
  const [by, setBy] = useState<"skill" | "sector">("skill");
  const [picked, setPicked] = useState<{ key: string; horizon: Horizon } | null>(null);
  const timeline = useMemo(() => benchTimeline(state, by), [state, by]);
  if (timeline.rows.length === 0) return null;
  const max = Math.max(1, ...timeline.rows.flatMap((row) => HORIZONS.map((horizon) => Math.max(row.cells[horizon].supply, row.cells[horizon].demand))));
  const pickedRow = picked ? timeline.rows.find((row) => row.key === picked.key) ?? null : null;
  const pickedCell = pickedRow && picked ? pickedRow.cells[picked.horizon] : null;
  const firstGap = timeline.rows.find((row) => row.worstGap > 0);
  const firstGapHorizon = firstGap ? HORIZONS.find((horizon) => firstGap.cells[horizon].gap > 0) ?? 90 : null;

  return (
    <section className={`card ${styles.card}`} aria-labelledby="bench-title" data-tour="bench" id="bench">
      <div className={styles.head}>
        <div className={styles.headCopy}>
          <IconTile name="calendar" tone="qiko" size="md" />
          <div>
            <p className="kicker kicker-qiko">Qiko · Bench vs demand</p>
            <h2 id="bench-title">Who frees up, what starts: the next 90 days</h2>
            <p className={styles.sub}>
              Projected from recorded availability dates, assignment end dates and requirement start dates.
              {firstGap && firstGapHorizon ? (
                <>
                  {" "}
                  First gap: <b>{firstGap.label}</b> inside {firstGapHorizon} days.
                </>
              ) : (
                " No gap inside 90 days on current dates."
              )}
            </p>
          </div>
        </div>
        <div className="segmented" role="group" aria-label="Group by">
          <button type="button" aria-pressed={by === "skill"} onClick={() => { setBy("skill"); setPicked(null); }}>
            By skill
          </button>
          <button type="button" aria-pressed={by === "sector"} onClick={() => { setBy("sector"); setPicked(null); }}>
            By sector
          </button>
        </div>
      </div>

      <div className={styles.body}>
        <div className={styles.grid} role="table" aria-label="Bench and demand by horizon">
          <div className={styles.gridHead} role="row">
            <span role="columnheader">{by === "skill" ? "Skill" : "Sector"}</span>
            {HORIZONS.map((horizon) => (
              <span key={horizon} role="columnheader">
                <b>{horizon} days</b>
                <small>
                  <i data-tone="supply" /> {timeline.totals[horizon].supply} bench · <i data-tone="demand" /> {timeline.totals[horizon].demand} needed
                </small>
              </span>
            ))}
          </div>
          {timeline.rows.map((row) => (
            <div key={row.key} className={styles.row} role="row">
              <span className={styles.rowLabel} role="rowheader">
                {row.label}
                {row.worstGap > 0 ? <span className={styles.gapTag}>gap {row.worstGap}</span> : null}
              </span>
              {HORIZONS.map((horizon) => (
                <Cell key={horizon} row={row} horizon={horizon} max={max} active={picked?.key === row.key && picked.horizon === horizon} onPick={() => setPicked((current) => (current?.key === row.key && current.horizon === horizon ? null : { key: row.key, horizon }))} />
              ))}
            </div>
          ))}
        </div>

        <aside className={styles.rail}>
          {pickedRow && pickedCell && picked ? (
            <div className={styles.detail} key={`${picked.key}-${picked.horizon}`}>
              <div className={styles.detailHead}>
                <b>{pickedRow.label}</b>
                <span>within {picked.horizon} days</span>
              </div>
              <p className={styles.detailLine} data-gap={pickedCell.gap > 0 ? "true" : undefined}>
                {pickedCell.gap > 0 ? `${pickedCell.gap} short` : pickedCell.gap < 0 ? `${-pickedCell.gap} spare` : "Exactly covered"} · {pickedCell.supply} on the bench ({pickedCell.freeingUp} freeing up) against {pickedCell.demand} needed
              </p>
              <h4 className="kicker">Briefs starting</h4>
              {pickedCell.requirements.length === 0 ? (
                <p className={styles.quiet}>Nothing starting in this window.</p>
              ) : (
                <ul className={styles.mini}>
                  {pickedCell.requirements.map((req) => (
                    <li key={req.id}>
                      <Link href={`/staffing/requirements/${req.id}`}>{req.title}</Link>
                      <small>starts {formatDate(req.startDate)}</small>
                    </li>
                  ))}
                </ul>
              )}
              <h4 className="kicker">On the bench by then</h4>
              {pickedCell.associates.length === 0 ? (
                <p className={styles.quiet}>Nobody with this {by} is free in the window.</p>
              ) : (
                <ul className={styles.people}>
                  {pickedCell.associates.slice(0, 6).map((associate) => (
                    <li key={associate.id}>
                      <Link href={`/staffing/associates/${associate.id}`} title={associate.name}>
                        <span className="avatar avatar-sm" style={avatarStyle(associate.name)}>
                          {initials(associate.name)}
                        </span>
                      </Link>
                    </li>
                  ))}
                  {pickedCell.associates.length > 6 ? <li className={styles.moreCount}>+{pickedCell.associates.length - 6}</li> : null}
                </ul>
              )}
              {pickedCell.gap > 0 ? (
                <button type="button" className="link-button" onClick={() => askQiko(`We are ${pickedCell.gap} short on ${pickedRow.label} within ${picked.horizon} days. Who could we source or introduce?`)}>
                  Ask Qiko how to close it <Icon name="arrowRight" size={12} />
                </button>
              ) : null}
            </div>
          ) : (
            <div className={styles.freeing}>
              <div className={styles.detailHead}>
                <b>Freeing up next</b>
                <span>
                  <CountUp value={timeline.freeing.length} /> in 90 days
                </span>
              </div>
              {timeline.freeing.length === 0 ? (
                <p className={styles.quiet}>No assignment ends inside 90 days.</p>
              ) : (
                <ul className={styles.mini}>
                  {timeline.freeing.slice(0, 6).map((item) => (
                    <li key={item.associate.id}>
                      <Link href={`/staffing/associates/${item.associate.id}`}>{item.associate.name}</Link>
                      <small>
                        {formatDate(item.date)}
                        {item.accountName ? ` · from ${item.accountName}` : ""}
                      </small>
                    </li>
                  ))}
                </ul>
              )}
              <p className={styles.hint}>
                <Icon name="sparkles" size={12} /> Click any cell to see who and which briefs sit behind it.
              </p>
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}

function Cell({ row, horizon, max, active, onPick }: { row: TimelineRow; horizon: Horizon; max: number; active: boolean; onPick: () => void }) {
  const cell = row.cells[horizon];
  const tone = cell.demand === 0 ? "idle" : cell.gap > 0 ? "gap" : cell.gap === 0 ? "tight" : "ok";
  return (
    <button type="button" className={styles.cell} data-tone={tone} data-active={active || undefined} onClick={onPick} aria-label={`${row.label}, ${horizon} days: ${cell.supply} on the bench, ${cell.demand} needed`}>
      <span className={styles.bars} aria-hidden="true">
        <i data-tone="supply" style={{ height: `${(cell.supply / max) * 100}%` }}>
          {cell.freeingUp > 0 ? <em style={{ height: `${(cell.freeingUp / Math.max(cell.supply, 1)) * 100}%` }} /> : null}
        </i>
        <i data-tone="demand" style={{ height: `${(cell.demand / max) * 100}%` }} />
      </span>
      <span className={`tabular ${styles.cellNums}`}>
        <b>{cell.supply}</b>
        <small>/</small>
        <b>{cell.demand}</b>
      </span>
      <span className={styles.cellNote}>{tone === "gap" ? `${cell.gap} short` : tone === "ok" ? `${-cell.gap} spare` : tone === "tight" ? "tight" : "no demand"}</span>
    </button>
  );
}
