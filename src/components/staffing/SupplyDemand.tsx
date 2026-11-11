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
            Verified available associates in a sector, divided by open requirement headcount in that sector.
            {largest ? ` Largest gap: ${largest.sector}.` : ""}
          </p>
        </div>
      </div>
      <ul className={styles.supplyList}>
        {rows.map((row) => {
          const demandWidth = 100;
          const supplyWidth = Math.min(100, row.coveragePct);
          const hot = largest?.sector === row.sector && row.gapHeadcount > 0;
          return (
            <li key={row.sector}>
              <button type="button" className={styles.supplyRow} data-hot={hot ? "true" : undefined} onClick={() => setOpenSector(row.sector)}>
                <span className={styles.supplyName}>{row.sector}</span>
                <span className={styles.supplyBars} aria-hidden="true">
                  <i style={{ width: `${demandWidth}%` }} />
                  <i style={{ width: `${supplyWidth}%` }} />
                </span>
                <span className={styles.supplyMeta}>
                  {row.verifiedAvailable}/{row.demandHeadcount} · {row.coveragePct}%
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {selected ? (
        <Drawer kicker="Qiko" title={selected.sector} onClose={() => setOpenSector(null)} width={440}>
          <p>
            {selected.demandRequirements} open requirements · {selected.demandHeadcount} headcount. {selected.associatesInSector} active
            associates list this sector, {selected.verifiedAvailable} verified and available.
          </p>
          <p>
            Coverage is {selected.verifiedAvailable} ÷ {selected.demandHeadcount} open headcount ({selected.coveragePct}%). Gap{" "}
            {Math.max(selected.gapHeadcount, 0)} headcount.
          </p>
          <p>Typical seniority on these requirements: {selected.seniority}.</p>
          {selected.skills.length ? <p>Skills named on the requirements: {selected.skills.join(", ")}.</p> : null}
          <div className={styles.supplyActions}>
            <Button onClick={() => saveBrief(selected)}>Build sourcing shortlist</Button>
            <Button variant="secondary" onClick={() => preparedSearch(selected)}>
              Open prepared search
            </Button>
          </div>
          <p className={styles.supplyNote}>Prepared search is a web query. LinkedIn is not connected.</p>
        </Drawer>
      ) : null}
    </section>
  );
}
