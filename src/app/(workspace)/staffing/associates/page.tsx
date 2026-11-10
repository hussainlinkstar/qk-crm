"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Button from "@/components/ui/Button";
import Icon from "@/components/ui/Icon";
import AddAssociateModal from "@/components/staffing/AddAssociateModal";
import AssociateQuickPanel from "@/components/staffing/AssociateQuickPanel";
import { EmptyState, SkeletonRows, useWorkspaceData } from "@/components/ui/bits";
import { initials } from "@/lib/format";
import {
  TALENT_PAGE_SIZE,
  TALENT_SAVED_VIEWS,
  currentAssignmentLabel,
  filterTalentNetwork,
  paginateTalent,
  roleLabel,
  type TalentSavedView,
} from "@/lib/talent-network";
import type { AssociateRoleType, AvailabilityStatus, SeniorityLevel } from "@/lib/tessiant-types";
import styles from "../staffing.module.css";
import talent from "./talent.module.css";

export default function AssociatesPage() {
  const router = useRouter();
  const params = useSearchParams();
  const { state } = useWorkspaceData();
  const tessiant = state?.tessiant;

  const [q, setQ] = useState(params.get("q") ?? "");
  const [view, setView] = useState<TalentSavedView>((params.get("view") as TalentSavedView) || "all");
  const [skill, setSkill] = useState(params.get("skill") ?? "");
  const [sector, setSector] = useState(params.get("sector") ?? "");
  const [roleType, setRoleType] = useState<AssociateRoleType | "">((params.get("type") as AssociateRoleType | null) ?? "");
  const [seniority, setSeniority] = useState<SeniorityLevel | "">((params.get("seniority") as SeniorityLevel | null) ?? "");
  const [availability, setAvailability] = useState<AvailabilityStatus | "">(
    (params.get("availability") as AvailabilityStatus | null) ?? "",
  );
  const [page, setPage] = useState(Number(params.get("page") || 1));
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [quickId, setQuickId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(params.get("new") === "1");

  useEffect(() => {
    if (params.get("verified") === "1") setView("available_now");
    if (params.get("new") === "1") setAddOpen(true);
  }, [params]);

  const skills = useMemo(() => {
    if (!tessiant) return [];
    return [...new Set(tessiant.associates.flatMap((item) => item.skills))].sort();
  }, [tessiant]);
  const sectors = useMemo(() => {
    if (!tessiant) return [];
    return [...new Set(tessiant.associates.flatMap((item) => item.sectors))].sort();
  }, [tessiant]);

  const filtered = useMemo(() => {
    if (!state) return [];
    return filterTalentNetwork(state, {
      q,
      skill,
      sector,
      seniority,
      roleType,
      location: "",
      availability,
      engagement: "",
      view,
    });
  }, [state, q, skill, sector, seniority, roleType, availability, view]);

  const paged = useMemo(() => paginateTalent(filtered, page, TALENT_PAGE_SIZE), [filtered, page]);
  const advancedFilterCount = [skill, sector, roleType, seniority].filter(Boolean).length;
  const activeFilterCount = advancedFilterCount + (availability ? 1 : 0);

  useEffect(() => {
    setPage(1);
  }, [q, skill, sector, seniority, roleType, availability, view]);

  if (!state || !tessiant) {
    return (
      <div className={`page ${styles.density}`}>
        <SkeletonRows rows={6} height={48} />
      </div>
    );
  }

  const applyView = (next: TalentSavedView) => {
    setView(next);
    router.replace(next === "all" ? "/staffing/associates" : `/staffing/associates?view=${next}`);
  };

  return (
    <div className={`page ${styles.density}`}>
      <header className="page-head">
        <div>
          <h1>Talent Network</h1>
          <p className="subtitle">Search and shortlist associates.</p>
        </div>
        <div className="page-actions">
          <Button icon="plus" onClick={() => setAddOpen(true)}>
            Add associate
          </Button>
        </div>
      </header>

      <section className="card">
        <div className={`card-body ${talent.toolbarCard}`}>
          <div className={talent.views} role="tablist" aria-label="Saved talent views">
            {TALENT_SAVED_VIEWS.map((item) => (
              <button
                key={item.id}
                type="button"
                className={talent.viewChip}
                data-active={view === item.id}
                title={item.description}
                onClick={() => applyView(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div className={talent.toolbar}>
            <label className={`search-field ${talent.grow}`} style={{ marginBottom: 0 }}>
              <Icon name="search" size={15} />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search name, role, skills…"
                aria-label="Search talent network"
              />
            </label>
            <select
              className={`input ${talent.toolbarSelect}`}
              value={availability}
              onChange={(e) => setAvailability(e.target.value as AvailabilityStatus | "")}
              aria-label="Filter availability"
            >
              <option value="">All availability</option>
              <option value="available">Available</option>
              <option value="limited">Limited</option>
              <option value="unavailable">Unavailable</option>
              <option value="unknown">Unknown</option>
            </select>
            <Button variant="secondary" className={styles.controlMatch} onClick={() => setFiltersOpen((v) => !v)} aria-expanded={filtersOpen}>
              More filters{advancedFilterCount ? ` · ${advancedFilterCount}` : ""}
            </Button>
            {activeFilterCount > 0 && (
              <Button
                variant="ghost"
                className={styles.controlMatch}
                onClick={() => {
                  setSkill("");
                  setSector("");
                  setRoleType("");
                  setSeniority("");
                  setAvailability("");
                }}
              >
                Clear
              </Button>
            )}
          </div>
          {filtersOpen && (
            <div className={talent.filterGrid} role="group" aria-label="Advanced talent filters">
              <select className="input" value={skill} onChange={(e) => setSkill(e.target.value)} aria-label="Filter skill">
                <option value="">All skills</option>
                {skills.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
              <select className="input" value={sector} onChange={(e) => setSector(e.target.value)} aria-label="Filter sector">
                <option value="">All sectors</option>
                {sectors.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
              <select className="input" value={roleType} onChange={(e) => setRoleType(e.target.value as AssociateRoleType | "")} aria-label="Filter type">
                <option value="">All types</option>
                <option value="specialist">Specialist</option>
                <option value="consultant">Consultant</option>
                <option value="programme_manager">Programme manager</option>
                <option value="SIA">SIA</option>
                <option value="executive_advisor">Executive advisor</option>
              </select>
              <select className="input" value={seniority} onChange={(e) => setSeniority(e.target.value as SeniorityLevel | "")} aria-label="Filter seniority">
                <option value="">All seniority</option>
                <option value="mid">Mid</option>
                <option value="senior">Senior</option>
                <option value="principal">Principal</option>
                <option value="executive">Executive</option>
              </select>
            </div>
          )}
        </div>
      </section>

      <section className="card">
        <div className="card-head">
          <div>
            <h2>Directory</h2>
            <p className="card-sub tabular">
              {paged.total} matching · page {paged.page}/{paged.pageCount}
            </p>
          </div>
        </div>
        <div className="card-body">
          {paged.slice.length === 0 ? (
            <EmptyState title="No talent matches" icon="users">
              Clear filters or try another saved view.
            </EmptyState>
          ) : (
            <>
              <div className="table-wrap">
                <table className={`table ${talent.compactTable}`}>
                  <thead>
                    <tr>
                      <th>Name / role</th>
                      <th>Type / seniority</th>
                      <th>Skills</th>
                      <th>Sector</th>
                      <th>Availability</th>
                      <th>Current assignment</th>
                      <th>Quick action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paged.slice.map((associate) => {
                      const assignment = currentAssignmentLabel(state, associate);
                      const shownSkills = associate.skills.slice(0, 3);
                      return (
                        <tr key={associate.id} className={talent.clickRow} onClick={() => setQuickId(associate.id)}>
                          <td>
                            <div className={talent.person}>
                              <span className="avatar avatar-sm">{initials(associate.name)}</span>
                              <span className={talent.personMeta}>
                                <b>{associate.name}</b>
                                <div className="muted">{associate.headline || roleLabel(associate.roleType)}</div>
                              </span>
                            </div>
                          </td>
                          <td className="nowrap">
                            {roleLabel(associate.roleType)} · {associate.seniority}
                          </td>
                          <td className="nowrap">{shownSkills.join(", ") || "—"}</td>
                          <td className="nowrap">{associate.sectors[0] ?? "—"}</td>
                          <td className="nowrap">
                            <span className="chip chip-dot">{associate.availability}</span>
                          </td>
                          <td className="nowrap">
                            {assignment ? (
                              <Link
                                href={`/staffing/placements/${assignment.placementId}`}
                                className={styles.rowLink}
                                onClick={(event) => event.stopPropagation()}
                              >
                                {assignment.client}
                              </Link>
                            ) : (
                              <span className="muted">Bench</span>
                            )}
                          </td>
                          <td onClick={(event) => event.stopPropagation()}>
                            <div className={styles.rowActions}>
                              <Button size="small" variant="secondary" onClick={() => setQuickId(associate.id)}>
                                Quick view
                              </Button>
                              <Link href={`/staffing/associates/${associate.id}`}>
                                <Button size="small" variant="ghost">
                                  Profile
                                </Button>
                              </Link>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className={talent.pager}>
                <span className="muted tabular">
                  Showing {(paged.page - 1) * TALENT_PAGE_SIZE + 1}–{Math.min(paged.page * TALENT_PAGE_SIZE, paged.total)} of {paged.total}
                </span>
                <div className={talent.pagerControls}>
                  <Button size="small" variant="secondary" disabled={paged.page <= 1} onClick={() => setPage((v) => v - 1)}>
                    Previous
                  </Button>
                  <span className="tabular">
                    {paged.page} / {paged.pageCount}
                  </span>
                  <Button size="small" variant="secondary" disabled={paged.page >= paged.pageCount} onClick={() => setPage((v) => v + 1)}>
                    Next
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </section>

      {quickId && <AssociateQuickPanel associateId={quickId} onClose={() => setQuickId(null)} />}
      {addOpen && (
        <AddAssociateModal
          onClose={() => {
            setAddOpen(false);
            if (params.get("new") === "1") router.replace("/staffing/associates");
          }}
          onCreated={(id) => {
            setAddOpen(false);
            setQuickId(id);
            if (params.get("new") === "1") router.replace("/staffing/associates");
          }}
        />
      )}
    </div>
  );
}
