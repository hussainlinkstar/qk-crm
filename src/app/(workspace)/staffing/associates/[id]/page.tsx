"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import Button from "@/components/ui/Button";
import TagMultiSelect from "@/components/ui/TagMultiSelect";
import { EmptyState, SkeletonRows, useWorkspaceData } from "@/components/ui/bits";
import { useWorkspace } from "@/components/shell/WorkspaceContext";
import { crm } from "@/lib/crm-store";
import { formatRate } from "@/lib/tessiant-insights";
import { formatDate, formatDateTime, initials, timeAgo } from "@/lib/format";
import { associateCommittedCapacity } from "@/lib/assignments";
import {
  currentAssignmentLabel,
  engagementStatus,
  ensureTalentProfile,
  latestCv,
  roleLabel,
  specialisationsBeyondSkills,
} from "@/lib/talent-network";
import { shortlistLabel } from "@/lib/tessiant-matching";
import type { AvailabilityStatus, AssociateStatus, WorkingMode } from "@/lib/tessiant-types";
import styles from "../../staffing.module.css";
import talent from "../talent.module.css";

type Tab = "overview" | "documents" | "experience" | "assignments" | "recruitment" | "commercials" | "notes";

const TABS: { key: Tab; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "documents", label: "CV & Documents" },
  { key: "experience", label: "Experience" },
  { key: "assignments", label: "Assignments" },
  { key: "recruitment", label: "Recruitment activity" },
  { key: "commercials", label: "Commercials" },
  { key: "notes", label: "Notes & activity" },
];

const RATE_KEY = "tessiant-show-rates";

export default function AssociateDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { state } = useWorkspaceData();
  const { toast } = useWorkspace();
  const tessiant = state?.tessiant;
  const raw = tessiant?.associates.find((item) => item.id === id);
  const associate = raw ? ensureTalentProfile(raw) : null;

  const [tab, setTab] = useState<Tab>("overview");
  const [showRates, setShowRates] = useState(true);
  const [editing, setEditing] = useState(false);
  const [noteDraft, setNoteDraft] = useState("");
  const [cvName, setCvName] = useState("");
  const [draft, setDraft] = useState({
    summary: "",
    headline: "",
    availability: "available" as AvailabilityStatus,
    nextAvailableDate: "",
    status: "active" as AssociateStatus,
    workingMode: "hybrid" as WorkingMode,
    location: "",
    email: "",
    phone: "",
    skills: [] as string[],
    specialisations: [] as string[],
    sectors: [] as string[],
    notes: "",
  });

  useEffect(() => {
    try {
      const stored = window.sessionStorage.getItem(RATE_KEY);
      if (stored != null) setShowRates(stored === "1");
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (!associate) return;
    setDraft({
      summary: associate.summary ?? "",
      headline: associate.headline,
      availability: associate.availability,
      nextAvailableDate: associate.nextAvailableDate ?? "",
      status: associate.status,
      workingMode: associate.workingMode,
      location: associate.location,
      email: associate.email ?? "",
      phone: associate.phone ?? "",
      skills: [...associate.skills],
      specialisations: [...(associate.specialisations ?? [])],
      sectors: [...associate.sectors],
      notes: associate.notes,
    });
  }, [associate?.id]);

  const linked = useMemo(() => {
    if (!tessiant || !associate) return { candidates: [], placements: [], assignment: null, engagement: "unavailable" as const };
    return {
      candidates: tessiant.candidates.filter((c) => c.associateId === associate.id).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
      placements: tessiant.placements.filter((p) => p.associateId === associate.id).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
      assignment: state ? currentAssignmentLabel(state, associate) : null,
      engagement: state ? engagementStatus(state, associate) : "unavailable",
    };
  }, [state, tessiant, associate]);

  if (!state || !tessiant) {
    return (
      <div className={`page ${styles.density}`}>
        <SkeletonRows rows={5} height={80} />
      </div>
    );
  }

  if (!associate) {
    return (
      <div className={`page ${styles.density}`}>
        <EmptyState title="Associate not found" icon="users">
          <Link href="/staffing/associates">Back to talent network</Link>
        </EmptyState>
      </div>
    );
  }

  const cv = latestCv(associate);

  const saveProfile = () => {
    if (!draft.headline.trim() || !draft.summary.trim()) {
      toast("Headline and summary are required", "error");
      return;
    }
    const skills = draft.skills;
    const specialisations = specialisationsBeyondSkills(skills, draft.specialisations);
    crm.updateAssociate(associate.id, {
      headline: draft.headline.trim(),
      summary: draft.summary.trim(),
      availability: draft.availability,
      nextAvailableDate: draft.nextAvailableDate || null,
      status: draft.status,
      workingMode: draft.workingMode,
      sectors: draft.sectors,
      location: draft.location.trim(),
      email: draft.email.trim() || null,
      phone: draft.phone.trim() || null,
      skills,
      specialisations,
      notes: draft.notes.trim(),
      verifiedAt: draft.status === "active" ? associate.verifiedAt ?? new Date().toISOString() : associate.verifiedAt,
    });
    if (draft.availability !== associate.availability) {
      crm.addAssociateNote(associate.id, `Availability updated to ${draft.availability}${draft.nextAvailableDate ? ` · next ${draft.nextAvailableDate}` : ""}`, "availability");
    }
    setEditing(false);
    toast("Talent profile updated", "success");
  };

  const capacity = associateCommittedCapacity(state, associate.id);
  const freeCapacity = Math.max(0, 100 - capacity);
  const specialtyOnly = specialisationsBeyondSkills(associate.skills, associate.specialisations);
  const recentRecruitment = linked.candidates.slice(0, 3);

  return (
    <div className={`page ${styles.density}`}>
      <header className="page-head">
        <div>
          <p className="kicker">
            <Link href="/staffing/associates">Talent network</Link>
          </p>
          <div className={talent.person}>
            <span className="avatar">{initials(associate.name)}</span>
            <div>
              <h1>{associate.name}</h1>
              <p className="subtitle">{associate.headline}</p>
              <div className={talent.heroChips}>
                <span className="chip">{roleLabel(associate.roleType)}</span>
                <span className="chip">{associate.seniority}</span>
                <span className="chip chip-dot">{associate.availability}</span>
                <span className="chip tabular">{freeCapacity}% free</span>
                <span className="chip">{associate.verifiedAt ? "Verified" : "Unverified"}</span>
              </div>
            </div>
          </div>
        </div>
        <div className="page-actions">
          <Button
            variant="secondary"
            size="small"
            onClick={() => {
              const next = !showRates;
              setShowRates(next);
              try {
                window.sessionStorage.setItem(RATE_KEY, next ? "1" : "0");
              } catch {
                // ignore
              }
            }}
          >
            {showRates ? "Hide rates" : "Show rates"}
          </Button>
          {editing ? (
            <>
              <Button variant="ghost" onClick={() => setEditing(false)}>
                Cancel
              </Button>
              <Button icon="check" onClick={saveProfile}>
                Save profile
              </Button>
            </>
          ) : (
            <Button variant="secondary" icon="edit" onClick={() => setEditing(true)}>
              Edit profile
            </Button>
          )}
        </div>
      </header>

      <div className={styles.profileGrid}>
        <aside className={`card ${styles.sideCard}`}>
          <div className={`card-body ${talent.sideStack}`}>
            <div>
              <div className="muted">Capacity</div>
              <b className="tabular">
                {capacity}% committed · {freeCapacity}% free
              </b>
              <div className="muted">{linked.engagement}</div>
            </div>
            <div>
              <div className="muted">Current assignment</div>
              {linked.assignment ? (
                <>
                  <b>
                    <Link href={`/staffing/placements/${linked.assignment.placementId}`}>{linked.assignment.role}</Link>
                  </b>
                  <div className="muted">{linked.assignment.client}</div>
                </>
              ) : (
                <b>Bench</b>
              )}
            </div>
            <div>
              <div className="muted">CV status</div>
              <b>{cv ? `${cv.name} · v${cv.version}` : "No CV"}</b>
              <div className="muted">{cv?.verifiedAt ? `Verified ${formatDate(cv.verifiedAt)}` : "Needs review"}</div>
            </div>
            <div>
              <div className="muted">Recent recruitment</div>
              {recentRecruitment.length === 0 ? (
                <b>None</b>
              ) : (
                recentRecruitment.map((candidate) => {
                  const req = tessiant.requirements.find((item) => item.id === candidate.requirementId);
                  return (
                    <div key={candidate.id} className="muted">
                      <Link href={`/staffing/requirements/${candidate.requirementId}`}>{req?.title ?? "Requirement"}</Link>
                      {" · "}
                      {shortlistLabel(candidate.shortlistStatus)}
                    </div>
                  );
                })
              )}
            </div>
            <div>
              <div className="muted">Location</div>
              <b>
                {associate.location} · {associate.workingMode}
              </b>
            </div>
            <div>
              <div className="muted">Day rate</div>
              <b className="tabular">{showRates ? formatRate(associate.rate) : "Restricted"}</b>
            </div>
            <div>
              <div className="muted">Owner</div>
              <b>{state.members.find((member) => member.id === associate.ownerId)?.name ?? "Unassigned"}</b>
            </div>
          </div>
        </aside>

        <div>
          <div className="segmented" role="tablist" aria-label="Talent profile sections" style={{ marginBottom: 14 }}>
            {TABS.map((item) => (
              <button
                key={item.key}
                type="button"
                aria-pressed={tab === item.key}
                onClick={() => setTab(item.key)}
              >
                {item.label}
              </button>
            ))}
          </div>

          {tab === "overview" && (
            <section className="card tab-panel">
              <div className="card-head">
                <h2>Professional overview</h2>
              </div>
              <div className="card-body">
                {editing ? (
                  <div className={styles.formSections}>
                    <section>
                      <h3 className={styles.formSectionTitle}>Basic information</h3>
                      <div className={styles.formGrid}>
                        <div className={`${styles.field} ${styles.full}`}>
                          <label htmlFor="headline">Role / title</label>
                          <input id="headline" className="input" value={draft.headline} onChange={(e) => setDraft({ ...draft, headline: e.target.value })} />
                        </div>
                        <div className={styles.field}>
                          <label htmlFor="email">Contact email</label>
                          <input id="email" className="input" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} />
                        </div>
                        <div className={styles.field}>
                          <label htmlFor="phone">Phone</label>
                          <input id="phone" className="input" value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} />
                        </div>
                        <div className={styles.field}>
                          <label htmlFor="status">Profile status</label>
                          <select id="status" className="input" value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value as AssociateStatus })}>
                            <option value="active">Active</option>
                            <option value="unverified">Unverified</option>
                            <option value="inactive">Inactive</option>
                          </select>
                        </div>
                      </div>
                    </section>
                    <section>
                      <h3 className={styles.formSectionTitle}>Skills & experience</h3>
                      <div className={styles.formGrid}>
                        <div className={`${styles.field} ${styles.full}`}>
                          <label htmlFor="summary">Professional summary</label>
                          <textarea id="summary" className="input" rows={5} value={draft.summary} onChange={(e) => setDraft({ ...draft, summary: e.target.value })} />
                        </div>
                        <div className={`${styles.field} ${styles.full}`}>
                          <label>Skills</label>
                          <TagMultiSelect
                            value={draft.skills}
                            options={[...new Set(tessiant.associates.flatMap((item) => item.skills))].sort()}
                            onChange={(skills) => setDraft({ ...draft, skills })}
                            aria-label="Skills"
                          />
                        </div>
                        <div className={`${styles.field} ${styles.full}`}>
                          <label>Specialisations</label>
                          <TagMultiSelect
                            value={draft.specialisations}
                            options={[...new Set(tessiant.associates.flatMap((item) => item.skills))].sort()}
                            onChange={(specialisations) => setDraft({ ...draft, specialisations })}
                            aria-label="Specialisations"
                          />
                        </div>
                        <div className={`${styles.field} ${styles.full}`}>
                          <label>Sectors</label>
                          <TagMultiSelect
                            value={draft.sectors}
                            options={[...new Set(tessiant.associates.flatMap((item) => item.sectors))].sort()}
                            onChange={(sectors) => setDraft({ ...draft, sectors })}
                            aria-label="Sectors"
                          />
                        </div>
                      </div>
                    </section>
                    <section>
                      <h3 className={styles.formSectionTitle}>Availability</h3>
                      <div className={styles.formGrid}>
                        <div className={styles.field}>
                          <label htmlFor="availability">Status</label>
                          <select id="availability" className="input" value={draft.availability} onChange={(e) => setDraft({ ...draft, availability: e.target.value as AvailabilityStatus })}>
                            <option value="available">Available</option>
                            <option value="limited">Limited</option>
                            <option value="unavailable">Unavailable</option>
                            <option value="unknown">Unknown</option>
                          </select>
                        </div>
                        <div className={styles.field}>
                          <label htmlFor="nextAvailableDate">Next available</label>
                          <input id="nextAvailableDate" type="date" className="input" value={draft.nextAvailableDate} onChange={(e) => setDraft({ ...draft, nextAvailableDate: e.target.value })} />
                        </div>
                        <div className={styles.field}>
                          <label htmlFor="workingMode">Working preference</label>
                          <select id="workingMode" className="input" value={draft.workingMode} onChange={(e) => setDraft({ ...draft, workingMode: e.target.value as WorkingMode })}>
                            <option value="remote">Remote</option>
                            <option value="hybrid">Hybrid</option>
                            <option value="onsite">Onsite</option>
                          </select>
                        </div>
                        <div className={styles.field}>
                          <label htmlFor="location">Location</label>
                          <input id="location" className="input" value={draft.location} onChange={(e) => setDraft({ ...draft, location: e.target.value })} />
                        </div>
                      </div>
                    </section>
                  </div>
                ) : (
                  <>
                    <p>{associate.summary}</p>
                    <h3 style={{ marginTop: 16, fontSize: 14 }}>Skills</h3>
                    <div className={styles.metaRow}>
                      {associate.skills.map((skill) => (
                        <span key={skill} className="chip">
                          {skill}
                        </span>
                      ))}
                    </div>
                    {specialtyOnly.length > 0 && (
                      <>
                        <h3 style={{ marginTop: 16, fontSize: 14 }}>Specialisations</h3>
                        <div className={styles.metaRow}>
                          {specialtyOnly.map((item) => (
                            <span key={item} className="chip chip-ai">
                              {item}
                            </span>
                          ))}
                        </div>
                      </>
                    )}
                    <h3 style={{ marginTop: 16, fontSize: 14 }}>Industries</h3>
                    <div className={styles.metaRow}>
                      {associate.sectors.map((item) => (
                        <span key={item} className="chip">
                          {item}
                        </span>
                      ))}
                    </div>
                    <p className="muted" style={{ marginTop: 14 }}>
                      {associate.email ?? "No email"} · {associate.phone ?? "No phone"} · Languages: {associate.languages.join(", ") || "—"}
                    </p>
                  </>
                )}
              </div>
            </section>
          )}

          {tab === "documents" && (
            <section className="card">
              <div className="card-head">
                <h2>CV & documents</h2>
              </div>
              <div className="card-body">
                {(associate.documents ?? []).length === 0 ? (
                  <EmptyState title="No documents" icon="file" />
                ) : (
                  (associate.documents ?? []).map((doc) => {
                    const latest = cv && doc.id === cv.id;
                    return (
                      <div key={doc.id} className={talent.docRow}>
                        <div>
                          <b>
                            {doc.name} {latest ? "· current" : ""}
                          </b>
                          <div className="muted">
                            {doc.kind} · v{doc.version} · uploaded {formatDate(doc.uploadedAt)} · {doc.verifiedAt ? `verified ${formatDate(doc.verifiedAt)}` : "unverified"}
                          </div>
                          <code>{doc.ref}</code>
                        </div>
                        <Button
                          size="small"
                          variant="secondary"
                          onClick={() => toast(`Preview unavailable for ${doc.name}`, "info")}
                        >
                          Preview
                        </Button>
                      </div>
                    );
                  })
                )}
                <div className={styles.actions} style={{ marginTop: 12 }}>
                  <input className="input" style={{ maxWidth: 280 }} placeholder="New CV label" value={cvName} onChange={(e) => setCvName(e.target.value)} aria-label="New CV name" />
                  <Button
                    size="small"
                    icon="plus"
                    onClick={() => {
                      crm.replaceAssociateCv(associate.id, cvName || `${associate.name} CV`);
                      setCvName("");
                      toast("CV version recorded", "success");
                    }}
                  >
                    Upload / replace CV
                  </Button>
                </div>
              </div>
            </section>
          )}

          {tab === "experience" && (
            <section className="card">
              <div className="card-head">
                <h2>Experience</h2>
              </div>
              <div className="card-body">
                {(associate.experience ?? []).length === 0 ? (
                  <EmptyState title="No experience recorded" />
                ) : (
                  <ul className={styles.timeline}>
                    {(associate.experience ?? []).map((item) => (
                      <li key={item.id}>
                        <b>{item.title}</b>
                        <div className="muted">
                          {item.organisation} · {item.sector} · {item.startDate} → {item.endDate ?? "present"}
                        </div>
                        <p>{item.summary}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>
          )}

          {tab === "assignments" && (
            <section className="card">
              <div className="card-head">
                <h2>Assignments</h2>
              </div>
              <div className="card-body">
                {linked.placements.length === 0 ? (
                  <EmptyState title="No assignments yet" icon="building" />
                ) : (
                  <div className="table-wrap">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Client / role</th>
                          <th>Dates</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {linked.placements.map((placement) => {
                          const req = tessiant.requirements.find((item) => item.id === placement.requirementId);
                          const account = req ? tessiant.accounts.find((item) => item.id === req.accountId) : undefined;
                          return (
                            <tr key={placement.id}>
                              <td>
                                <Link href={`/staffing/requirements/${placement.requirementId}`} className={styles.rowLink}>
                                  {req?.title ?? placement.requirementId}
                                </Link>
                                <div className="muted">{account?.name ?? "Client"}</div>
                              </td>
                              <td className="tabular nowrap">
                                {placement.terms.startDate ? formatDate(placement.terms.startDate) : "—"} →{" "}
                                {placement.terms.endDate ? formatDate(placement.terms.endDate) : "open"}
                              </td>
                              <td className="nowrap">
                                <span className="chip">{placement.status}</span>
                                <div className="muted">{placement.outcome ?? "—"}</div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </section>
          )}

          {tab === "recruitment" && (
            <section className="card">
              <div className="card-head">
                <h2>Recruitment activity</h2>
              </div>
              <div className="card-body">
                {linked.candidates.length === 0 ? (
                  <EmptyState title="No recruitment activity" icon="flag" />
                ) : (
                  <ul className={styles.timeline}>
                    {linked.candidates.map((candidate) => {
                      const req = tessiant.requirements.find((item) => item.id === candidate.requirementId);
                      return (
                        <li key={candidate.id}>
                          <Link href={`/staffing/requirements/${candidate.requirementId}`} className={styles.rowLink}>
                            {req?.title ?? candidate.requirementId}
                          </Link>
                          <div className="muted">
                            {shortlistLabel(candidate.shortlistStatus)} · score {candidate.matchScore}
                            {candidate.interview.heldAt ? ` · interview ${candidate.interview.outcome}` : ""}
                            {candidate.quotedClientRate ? ` · quote ${formatRate(candidate.quotedClientRate)}` : ""}
                          </div>
                          {candidate.interview.summary && <p>{candidate.interview.summary}</p>}
                          {candidate.matchGaps.length > 0 && <div className="muted">Gaps: {candidate.matchGaps.join("; ")}</div>}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </section>
          )}

          {tab === "commercials" && (
            <section className="card">
              <div className="card-head">
                <h2>Commercials</h2>
              </div>
              <div className="card-body">
                <div className={talent.rateGate}>
                  <span>{showRates ? "Rates visible for this session" : "Rates hidden"}</span>
                  <Button size="small" variant="secondary" onClick={() => setShowRates((value) => !value)}>
                    {showRates ? "Hide" : "Reveal"}
                  </Button>
                </div>
                {showRates ? (
                  <>
                    <p style={{ marginTop: 12 }}>
                      <b>Cost / indicative day rate:</b> {formatRate(associate.rate)}
                    </p>
                    <p>
                      <b>Agreed client rate:</b> {formatRate(associate.agreedRate ?? null)}
                    </p>
                    <p className="muted">{associate.contractNotes}</p>
                  </>
                ) : (
                  <EmptyState title="Commercial fields hidden" icon="lock">
                    Reveal rates when your role permits.
                  </EmptyState>
                )}
              </div>
            </section>
          )}

          {tab === "notes" && (
            <section className="card">
              <div className="card-head">
                <h2>Notes & activity</h2>
              </div>
              <div className="card-body">
                <div className={styles.actions}>
                  <textarea className="input" rows={3} style={{ flex: 1, minWidth: 220 }} value={noteDraft} onChange={(e) => setNoteDraft(e.target.value)} placeholder="Add internal note or follow-up…" aria-label="New associate note" />
                  <Button
                    icon="plus"
                    onClick={() => {
                      if (noteDraft.trim().length < 3) {
                        toast("Enter a short note", "error");
                        return;
                      }
                      crm.addAssociateNote(associate.id, noteDraft.trim(), /availability/i.test(noteDraft) ? "availability" : "note");
                      setNoteDraft("");
                      toast("Note added", "success");
                    }}
                  >
                    Add note
                  </Button>
                </div>
                <ul className={styles.timeline} style={{ marginTop: 16 }}>
                  {(associate.activityNotes ?? []).map((note) => (
                    <li key={note.id}>
                      <b>{note.kind}</b>
                      <div className="muted">
                        {timeAgo(note.createdAt)} · {formatDateTime(note.createdAt)} · {state.members.find((member) => member.id === note.authorId)?.name ?? note.authorId}
                      </div>
                      <p>{note.body}</p>
                    </li>
                  ))}
                </ul>
                {editing && (
                  <div className={styles.field} style={{ marginTop: 12 }}>
                    <label htmlFor="notes">Profile notes</label>
                    <textarea id="notes" className="input" rows={3} value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} />
                  </div>
                )}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
