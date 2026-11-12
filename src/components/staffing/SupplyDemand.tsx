"use client";

import { useMemo, useState } from "react";
import Button from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Overlay";
import { useWorkspace } from "@/components/shell/WorkspaceContext";
import { addDays } from "@/lib/format";
import { talentSupplyVsDemand, type SectorBalance } from "@/lib/supply-demand";
import type { CrmState } from "@/lib/types";
import styles from "@/app/(workspace)/staffing/staffing.module.css";

export default function SupplyDemand({ state }: { state: CrmState }) {
  const { openTaskForm, toast } = useWorkspace();
  const rows = useMemo(() => talentSupplyVsDemand(state).slice(0, 6), [state]);
  const [openSector, setOpenSector] = useState<string | null>(null);
  const selected = rows.find((row) => row.sector === openSector) ?? null;
  const largest = rows.find((row) => row.gapHeadcount > 0) ?? null;
  if (rows.length === 0) return null;

  const saveBrief = (row: SectorBalance) => {
    openTaskForm({
      title: `Sourcing brief · ${row.sector}`,
      onCreated: () => toast("Sourcing brief saved as a task"),
      initial: {
        title: `Sourcing brief · ${row.sector}`,
        description: [
          `Sector: ${row.sector}`,
          `Seniority: ${row.seniority}`,
          `Skills: ${row.skills.join(", ") || "See open requirements"}`,
          `Open headcount ${row.demandHeadcount} across ${row.demandRequirements} requirements.`,
          `Verified available in this sector: ${row.verifiedAvailable} of ${row.associatesInSector} active associates.`,
          "No external search connector is attached.",
        ].join("\n"),
        priority: "high",
        due: addDays(5),
        ownerId: "me",
        leadId: null,
      },
    });
  };

  const preparedSearch = (row: SectorBalance) => {
    const query = [row.sector, row.seniority, ...row.skills.slice(0, 3), "contract"].filter(Boolean).join(" ");
    window.open(`https://www.google.com/search?q=${encodeURIComponent(query)}`, "_blank", "noopener,noreferrer");
  };

  return (
    <section className={styles.supply} aria-label="Talent supply versus client demand">
      <div className={styles.supplyHead}>
        <div>
          <p className={styles.supplyKicker}>Qiko</p>
          <h2>Talent supply vs client demand</h2>
          <p>
            The track is open headcount. The fill is indicative sector supply from verified available associates.
            {largest ? ` Largest gap: ${largest.sector}.` : ""}
          </p>
        </div>
      </div>
      <ul className={styles.supplyList}>
        {rows.map((row) => {
          const hot = largest?.sector === row.sector && row.gapHeadcount > 0;
          const fill = Math.min(100, Math.max(0, row.coveragePct));
          return (
            <li key={row.sector}>
              <button type="button" className={styles.supplyRow} data-hot={hot ? "true" : undefined} onClick={() => setOpenSector(row.sector)}>
                <span className={styles.supplyTop}>
                  <span className={styles.supplyName}>{row.sector}</span>
                  <span className={styles.supplyMeta} data-gap={row.gapHeadcount > 0 ? "true" : undefined}>
                    {row.gapHeadcount > 0 ? `Gap ${row.gapHeadcount}` : "Indicative capacity"}
                  </span>
                </span>
                <span className={styles.meter} aria-hidden="true">
                  <span className={styles.meterFill} style={{ width: `${fill}%` }} />
                </span>
                <span className={styles.supplyCaption}>
                  {row.verifiedAvailable} verified available · {row.demandHeadcount} open headcount · {row.coveragePct}%
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {selected ? (
        <Drawer kicker="Qiko" title={selected.sector} onClose={() => setOpenSector(null)} width={440}>
          <div className={styles.supplyDrawer}>
            <div className={styles.supplyStats}>
              <div>
                <span>Open requirements</span>
                <b className="tabular">{selected.demandRequirements}</b>
              </div>
              <div>
                <span>Headcount</span>
                <b className="tabular">{selected.demandHeadcount}</b>
              </div>
              <div>
                <span>In this sector</span>
                <b className="tabular">{selected.associatesInSector}</b>
              </div>
              <div>
                <span>Verified available</span>
                <b className="tabular">{selected.verifiedAvailable}</b>
              </div>
            </div>
            <div className={styles.supplyCoverage}>
              <span className={styles.meter} aria-hidden="true">
                <span className={styles.meterFill} style={{ width: `${Math.min(100, Math.max(0, selected.coveragePct))}%` }} />
              </span>
              <p>
                {selected.verifiedAvailable} verified available associates against {selected.demandHeadcount} open headcount ({selected.coveragePct}%
                indicative sector supply). Gap {Math.max(selected.gapHeadcount, 0)}.
              </p>
            </div>
            <dl className={styles.supplyFacts}>
              <div>
                <dt>Seniority on these requirements</dt>
                <dd>{selected.seniority}</dd>
              </div>
              <div>
                <dt>Skills named</dt>
                <dd>{selected.skills.length ? selected.skills.join(", ") : "None recorded"}</dd>
              </div>
            </dl>
            <div className={styles.supplyActions}>
              <Button onClick={() => saveBrief(selected)}>Build sourcing shortlist</Button>
              <Button variant="secondary" onClick={() => preparedSearch(selected)}>
                Open prepared search
              </Button>
            </div>
            <p className={styles.supplyNote}>
              Sector supply is not a confirmed requirement match; skills, seniority, rate, working mode and dated availability still need review.
              Prepared search is a web query. LinkedIn is not connected.
            </p>
          </div>
        </Drawer>
      ) : null}
    </section>
  );
}
