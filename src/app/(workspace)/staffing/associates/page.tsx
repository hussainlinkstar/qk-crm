"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Button from "@/components/ui/Button";
import AddAssociateModal from "@/components/staffing/AddAssociateModal";
import AssociateQuickPanel from "@/components/staffing/AssociateQuickPanel";
import { EmptyState, SkeletonRows, useWorkspaceData } from "@/components/ui/bits";
import { associateCommittedCapacity } from "@/lib/assignments";
import { formatRate } from "@/lib/tessiant-insights";
import { formatDate, initials } from "@/lib/format";
import {
  TALENT_PAGE_SIZE,
  TALENT_SAVED_VIEWS,
  currentAssignmentLabel,
  engagementStatus,
  filterTalentNetwork,
  latestCv,
  needsProfileUpdate,
  paginateTalent,
  roleLabel,
  type TalentSavedView,
} from "@/lib/talent-network";
import type { AssociateRoleType, AvailabilityStatus, SeniorityLevel, TalentEngagementStatus } from "@/lib/tessiant-types";
import styles from "../staffing.module.css";
import talent from "./talent.module.css";

const RATE_KEY = "tessiant-show-rates";

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
  const [location, setLocation] = useState(params.get("location") ?? "");
  const [availability, setAvailability] = useState<AvailabilityStatus | "">(
    (params.get("availability") as AvailabilityStatus | null) ?? "",
  );
  const [engagement, setEngagement] = useState<TalentEngagementStatus | "">((params.get("engagement") as TalentEngagementStatus | null) ?? "");
  const [page, setPage] = useState(Number(params.get("page") || 1));
  const [showRates, setShowRates] = useState(true);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [quickId, setQuickId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  useEffect(() => {
    try {
      const stored = window.sessionStorage.getItem(RATE_KEY);
      if (stored != null) setShowRates(stored === "1");
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (params.get("verified") === "1") setView("available_now");
  }, [params]);

  const skills = useMemo(() => {
    if (!tessiant) return [];
    return [...new Set(tessiant.associates.flatMap((item) => item.skills))].sort();
  }, [tessiant]);
  const sectors = useMemo(() => {
    if (!tessiant) return [];
    return [...new Set(tessiant.associates.flatMap((item) => item.sectors))].sort();
  }, [tessiant]);
  const locations = useMemo(() => {
    if (!tessiant) return [];
    return [...new Set(tessiant.associates.map((item) => item.location.split("·")[0]?.trim() || item.location))].sort();
  }, [tessiant]);

  const filtered = useMemo(() => {
    if (!state) return [];
    return filterTalentNetwork(state, {
      q,
      skill,
      sector,
      seniority,
      roleType,
      location,
      availability,
      engagement,
      view,
    });
  }, [state, q, skill, sector, seniority, roleType, location, availability, engagement, view]);

  const paged = useMemo(() => paginateTalent(filtered, page, TALENT_PAGE_SIZE), [filtered, page]);
  const activeFilterCount = [skill, sector, roleType, seniority, location, availability, engagement].filter(Boolean).length;

  useEffect(() => {
    setPage(1);
  }, [q, skill, sector, seniority, roleType, location, availability, engagement, view]);

  if (!state || !tessiant) {
    return (
      <div className="page">
        <SkeletonRows rows={6} height={48} />
      </div>
    );
  }

  const applyView = (next: TalentSavedView) => {
    setView(next);
    router.replace(next === "all" ? "/staffing/associates" : `/staffing/associates?view=${next}`);
  };

  const toggleRates = () => {
    const next = !showRates;
    setShowRates(next);
    try {
      window.sessionStorage.setItem(RATE_KEY, next ? "1" : "0");
    } catch {
      // ignore
    }
  };

  const clearFilters = () => {
    setSkill("");
    setSector("");
    setRoleType("");
    setSeniority("");
    setLocation("");
    setAvailability("");
    setEngagement("");
  };

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <p className="kicker">Staffing</p>
          <h1>Talent Network</h1>
          <p className="subtitle">Search, filter and shortlist associates by skills, capacity and availability.</p>
        </div>
        <div className="page-actions">
          <Button variant="secondary" onClick={toggleRates}>
            {showRates ? "Hide day rates" : "Show day rates"}
          </Button>
          <Button icon="plus" onClick={() => setAddOpen(true)}>
            Add associate
          </Button>
        </div>
      </header>

      <p className={talent.demoNote} role="note">
        Sample directory · {tessiant.networkStats.sampleSize} profiles · illustrative network{" "}
        {tessiant.networkStats.totalMembers}+ · details in Settings
      </p>

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
            <input
              className={`input ${talent.grow}`}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search name, role, skills…"
              aria-label="Search talent network"
            />
            <Button
              variant="secondary"
              className={styles.controlMatch}
              onClick={() => setFiltersOpen((value) => !value)}
              aria-expanded={filtersOpen}
            >
              Filters{activeFilterCount ? ` · ${activeFilterCount}` : ""}
            </Button>
            {activeFilterCount > 0 && (
              <Button variant="ghost" className={styles.controlMatch} onClick={clearFilters}>
                Clear
              </Button>
            )}
          </div>
          {filtersOpen && (
            <div className={talent.filterGrid} role="group" aria-label="Talent filters">
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
              <select className="input" value={location} onChange={(e) => setLocation(e.target.value)} aria-label="Filter location">
                <option value="">All locations</option>
                {locations.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
              <select className="input" value={availability} onChange={(e) => setAvailability(e.target.value as AvailabilityStatus | "")} aria-label="Filter availability">
                <option value="">All availability</option>
                <option value="available">Available</option>
                <option value="limited">Limited</option>
                <option value="unavailable">Unavailable</option>
                <option value="unknown">Unknown</option>
              </select>
              <select className="input" value={engagement} onChange={(e) => setEngagement(e.target.value as TalentEngagementStatus | "")} aria-label="Filter engagement">
                <option value="">All engagement</option>
                <option value="available">Available</option>
                <option value="deployed">Deployed</option>
                <option value="limited">Limited</option>
                <option value="unavailable">Unavailable</option>
                <option value="inactive">Inactive</option>
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
              <div className={styles.tableWrap}>
                <table className={`${styles.table} ${talent.compactTable}`}>
                  <thead>
                    <tr>
                      <th>Name / role</th>
                      <th>Type</th>
                      <th>Skills</th>
                      <th>Location</th>
                      <th>Capacity</th>
                      <th>Assignment</th>
                      <th>Rate</th>
                      <th>CV</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {paged.slice.map((associate) => {
                      const assignment = currentAssignmentLabel(state, associate);
                      const engagementLabel = engagementStatus(state, associate);
                      const capacity = associateCommittedCapacity(state, associate.id);
                      const free = Math.max(0, 100 - capacity);
                      const cv = latestCv(associate);
                      const stale = needsProfileUpdate(associate);
                      return (
                        <tr
                          key={associate.id}
                          className={talent.clickRow}
                          onClick={() => setQuickId(associate.id)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              setQuickId(associate.id);
                            }
                          }}
                          tabIndex={0}
                          aria-label={`Quick view ${associate.name}`}
                        >
                          <td>
                            <div className={talent.person}>
                              <span className="avatar avatar-sm">{initials(associate.name)}</span>
                              <span className={talent.personMeta}>
                                <button type="button" className={styles.rowLink} onClick={() => setQuickId(associate.id)}>
                                  {associate.name}
                                </button>
                                <div className="muted">{associate.headline}</div>
                              </span>
                            </div>
                          </td>
                          <td>
                            <b>{roleLabel(associate.roleType)}</b>
                            <div className="muted">{associate.seniority}</div>
                          </td>
                          <td>
                            <div className={styles.metaRow}>
                              {associate.skills.slice(0, 2).map((item) => (
                                <span key={item} className="chip">
                                  {item}
                                </span>
                              ))}
                            </div>
                            <div className="muted">{associate.sectors.slice(0, 2).join(" · ")}</div>
                          </td>
                          <td>
                            {associate.location}
                            <div className="muted">{associate.workingMode}</div>
                          </td>
                          <td>
                            <span className="chip chip-dot">{associate.availability}</span>
                            <div className="muted tabular">
                              {capacity}% committed · {free}% free
                            </div>
                            <div className="muted">{engagementLabel}</div>
                          </td>
                          <td>
                            {assignment ? (
                              <>
                                <b>{assignment.client}</b>
                                <div className="muted">{assignment.role}</div>
                              </>
                            ) : (
                              <span className="muted">Bench</span>
                            )}
                          </td>
                          <td className="tabular">{showRates ? formatRate(associate.rate) : "Restricted"}</td>
                          <td>
                            <span className="chip">{cv?.verifiedAt ? "CV ready" : "CV review"}</span>
                            <div className="muted">
                              {associate.verifiedAt ? "Verified" : "Unverified"}
                              {stale ? " · update due" : ""}
                            </div>
                            <div className="muted">{associate.profileUpdatedAt ? formatDate(associate.profileUpdatedAt) : "—"}</div>
                          </td>
                          <td onClick={(event) => event.stopPropagation()}>
                            <Link href={`/staffing/associates/${associate.id}`} className="muted">
                              Profile
                            </Link>
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
                  <Button size="small" variant="secondary" disabled={paged.page <= 1} onClick={() => setPage((value) => value - 1)}>
                    Previous
                  </Button>
                  <span className="tabular">
                    {paged.page} / {paged.pageCount}
                  </span>
                  <Button size="small" variant="secondary" disabled={paged.page >= paged.pageCount} onClick={() => setPage((value) => value + 1)}>
                    Next
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </section>

      {quickId && <AssociateQuickPanel associateId={quickId} onClose={() => setQuickId(null)} showRates={showRates} />}
      {addOpen && (
        <AddAssociateModal
          onClose={() => setAddOpen(false)}
          onCreated={(id) => {
            setAddOpen(false);
            setQuickId(id);
          }}
        />
      )}
    </div>
  );
}
