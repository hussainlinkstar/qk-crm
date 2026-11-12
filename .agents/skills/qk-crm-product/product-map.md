# Product map

Snapshot of the running app. Re-read the cited files before editing. Package manager is pnpm. Scripts: `pnpm dev`, `pnpm lint`, `pnpm build`.

## Runtime

| Item | Value |
|---|---|
| Framework | Next.js 16.4.3, React 19, App Router, `src/` |
| Config | `next.config.ts` enables `cacheComponents` and `partialPrefetching` |
| Alias | `@/*` → `src/*` |
| CRM storage | `localStorage` key `qiko-core-crm` |
| Session | `qiko-core-session` in `localStorage` if remember, else `sessionStorage` |
| Signed-in user | Always `userId: "me"`. Name is derived from the email local-part unless the seed member email matches |
| Gate | `(workspace)/layout.tsx` → `AppShell`. No session redirects to `/login?next=` |
| Seed | `createDemoState` in `src/data/demo-seed.ts`. Staffing slice from `createTessiantSlice` in `src/data/tessiant-seed.ts` |
| Version | `DATA_VERSION` in `demo-seed.ts` (16 at last skill write). Mismatch discards stored CRM state |

`CrmState` holds sales records at the root and staffing/Pulse under `tessiant`. `dataMode` is `"demo"`.

## Routes

Auth and shell:

| Route | Role |
|---|---|
| `/login` | Any email signs in. `LoginView.tsx` calls `signIn` |
| `/` | Home. Greeting, Ask Qiko, Tessiant priorities, open tasks, recent activity |
| `/tasks` | My Tasks. Cross-workspace action list |
| `/settings` | Profile, team members, connector status (all demo/future), reset demo data |

Sales (`src/app/(workspace)/sales/`, layout sets `data-product="signal"`):

| Route | Nav label | Role |
|---|---|---|
| `/sales` | — | Sales overview (not a nav child; `/sales/leads` is the Sales landing child) |
| `/sales/leads` | Leads | Searchable lead list. Add via shell `openAddLead` |
| `/sales/leads/[id]` | — | Lead profile, timeline, notes, messages, conversion |
| `/sales/pipeline` | Opportunities | Stage pipeline. Amounts are pipeline, not revenue |
| `/sales/accounts` | Accounts | `ClientAccount` directory |
| `/sales/accounts/[id]` | — | Client 360: contacts, opportunities, requirements, assignments |
| `/sales/contacts` | Contacts | Stakeholders on accounts |
| `/sales/actions` | Activities | Calls, meetings, email, notes, follow-ups |

Staffing (`src/app/(workspace)/staffing/`):

| Route | Nav label | Role |
|---|---|---|
| `/staffing` | Staffing Overview | KPIs, open requirements, command centre |
| `/staffing/associates` | Talent Network | Associate directory, filters |
| `/staffing/associates/[id]` | — | Talent profile, documents, availability, notes |
| `/staffing/requirements` | Client Requirements | Requisition list / board, create |
| `/staffing/requirements/[id]` | — | Stage, matches, shortlist, commercials, timeline |
| `/staffing/placements` | Assignments | Deployment desk. Query e.g. `?view=active` |
| `/staffing/placements/[id]` | — | One assignment |
| `/staffing/clients` | — | Older clients view of the same accounts. Primary account UI is `/sales/accounts`. Do not fork the data |

Pulse (`src/components/pulse/PulseSubnav.tsx`, sets `data-product="pulse"`):

| Route | Label |
|---|---|
| `/pulse` | Cockpit |
| `/pulse/knowledge` | Knowledge (4 blocks) |
| `/pulse/knowledge/[id]` | One block: `network`, `augmentation`, `commercial`, `capability` |
| `/pulse/insights` | Generated insights |
| `/pulse/actions` | To-dos created from accepted insights |
| `/pulse/value` | Realised / pipeline / estimate, anti-double-count |
| `/pulse/connections` | Connector status. Not live integrations |

Nav source of truth: `NAV` plus the Intelligence and Account blocks in `src/components/shell/AppShell.tsx`. Sales and Staffing items show attention counts (open sales work, open unfilled requirements). Pulse is a top-level Intelligence link, not a child of Sales.

## Entities

Sales (`src/lib/types.ts`):

| Type | Lives on | Notes |
|---|---|---|
| `Lead` | `state.leads` | Status `New \| Working \| Qualified \| Unqualified \| Converted`. Legacy `Contacted/Won/Lost` normalized in `sales-crm.ts` |
| `Contact` | `state.contacts` | Belongs to `accountId` |
| `Opportunity` | `state.opportunities` | Belongs to `accountId`. See money rules |
| `ActivityEvent` | `state.events` | Timeline. `activityType` for sales interactions |
| `Note` | `state.notes` | May also point at account, opportunity, contact |
| `ConversationMessage` | `state.messages` | Email/WhatsApp **log only**. `sendMessage` stores a row; it does not deliver |
| `Task` | `state.tasks` | `origin`: `manual \| suggestion \| copilot`. Optional lead/account/opportunity/contact ids |
| `Suggestion` | derived | Rules in `insights.ts`: `signal_review`, `scan_review`, `engagement`, `enquiry_contact`, `stale` |
| `Member` | `state.members` | Team. Owner ids point here. `"me"` is the session user |
| `Scan` | `state.scans` | Legacy Qiko Signal audit rows still on the lead |

Staffing (`src/lib/tessiant-types.ts`, all under `state.tessiant`):

| Type | Collection | Notes |
|---|---|---|
| `Associate` | `associates` | Talent profile. `Assignment` capacity updates availability; it does not blanket-lock |
| `ClientAccount` | `accounts` | Shared with Sales |
| `ClientRequirement` | `requirements` | Requisition. `stage` + `outcome` + optional `priority` |
| `RequirementCandidate` | `candidates` | One associate on one requirement. Holds match explanation and shortlist status |
| `Placement` | `placements` | `export type Assignment = Placement`. Commercial `status` and ops `assignmentStatus` are both on this row |
| `DomainEvent` | `domainEvents` | CRM → Pulse evidence. `source: "tessiant-crm"`, `schemaVersion: 1` |
| `TessiantPulseState` | `pulse` | Reviews, outcomes, `attributedSourceKeys` |
| `NetworkStats` | `networkStats` | Headline network size. Not the sample table row count |

## Status vocabularies

Do not invent parallel labels. Map in the lib that already normalizes them.

- Lead: `LEAD_STATUSES` in `types.ts`. Open = not `Converted` or `Unqualified` (`isOpenLead`).
- Opportunity stage: Qualification → Discovery → Proposal → Negotiation → Closed Won / Closed Lost. Default probability in `stageProbability`.
- Requirement stage (stored): `New Requirement`, `Sourcing`, `Validation`, `Interview`, `Commercials`, `Placed`.
- Ops board labels (derived): `OPS_PIPELINE_STAGES` via `mapRequirementToOpsStage`. Moving a board card calls `applyOpsBoardMove` in `requisition.ts`. Do not store the ops label as a second stage field.
- Requirement outcome: `active`, `on_hold`, `lost`, `cancelled`, `archived`.
- Shortlist: `SHORTLIST_STATUSES`. Legacy `validating/quoted/selected/withdrawn` fold in `shortlistLabel`.
- Placement commercial status: `draft`, `agreed`, `confirmed`, `closed`.
- Assignment ops status: `upcoming`, `active`, `extended`, `completed`, `cancelled`.
- Task: `pending`, `in_progress`, `completed`, `dismissed`.

## Store API

`export const crm` in `src/lib/crm-store.ts`. Pages call these; they emit and persist.

Session: `signIn`, `signOut`, `useSession`. Profile: `updateProfile`. Team: `addMember`, `removeMember`. Reset: `resetDemoData`.

Sales: `addLead` (returns existing id on duplicate person), `updateLead`, `setLeadStatus`, `createContact`, `updateContact`, `createOpportunity`, `updateOpportunity`, `setOpportunityStage`, `convertLead`, `createRequirementFromOpportunity`, `addNote`, `deleteNote`, `sendMessage`, `logInteraction`.

Tasks: `createTask`, `updateTask`, `setTaskStatus`, `deleteTask`, `acceptSuggestion`, `dismissSuggestion`, `completeSuggestion`.

Staffing: `createAssociate`, `updateAssociate`, `addAssociateNote`, `replaceAssociateCv`, `createRequirement`, `updateRequirement`, `setRequirementStage`, `setRequirementOutcome`, `findMatches`, `shortlistAssociate`, `setCandidateStatus`, `logCandidateContact`, `rejectCandidate`, `recordExternalNetworkCandidate`, `recordExternalCandidate`, `overrideCandidateRank`, `completeCandidateValidation`, `completeInterview`, `sendQuote`, `agreeQuote`, `confirmPlacement`, `updatePlacement`, `extendAssignment`, `completeAssignment`, `cancelAssignment`, `addAssignmentNote`, `ensureAssignmentRenewalFollowUp`, `updateAccountOwners`, `recordClientFeedback`.

Pulse: `acceptPulseInsight`, `rejectPulseInsight`, `recordPulseOutcome`, `recordPulseValue`.

Shell helpers (`useWorkspace()`): `toast`, `askQiko`, `openTaskForm`, `openTask`, `openAddLead`. Must be under `AppShell`.

## Lib index

| File | Responsibility |
|---|---|
| `lib/crm-store.ts` | Persistence and every mutation |
| `lib/types.ts` | Sales contracts, `CrmState`, copilot answer shape |
| `lib/sales-crm.ts` | Lead normalization, stage probability, commercial buckets, `client360` |
| `lib/sales-growth.ts` | Growth insights and lead-source buckets |
| `lib/sales-relationship.ts` | Relationship strength across associate, account, contact, opportunity |
| `lib/commercial-intelligence.ts` | Engagement / re-engage signals |
| `lib/insights.ts` | Home/task priorities, suggestion rules, `buildWorkspace` |
| `lib/home-tessiant.ts` | Home priority and activity rows |
| `lib/copilot.ts` | Ask Qiko intent routing. Grounded answers only |
| `lib/tessiant-types.ts` | Staffing contracts |
| `lib/tessiant-matching.ts` | Explainable match score. Not an AI endpoint |
| `lib/tessiant-insights.ts` | Staffing KPIs, renewal, demand |
| `lib/requisition.ts` | Candidate actions, board columns, requirement timeline |
| `lib/requirement-recommendations.ts` | Top matches and client shortlist summary |
| `lib/assignments.ts` | Capacity, live assignments, enrichment |
| `lib/assignment-recommendations.ts` | Renewal and redeploy recommendations |
| `lib/talent-network.ts` | Profile enrichment for legacy associate rows |
| `lib/talent-network-intel.ts` | Directory attention cards |
| `lib/supply-demand.ts` | Supply vs demand snapshot |
| `lib/pulse-adapter.ts` | `createDomainEvent`, `getPulseSnapshot` |
| `lib/tessiant-pulse-types.ts` | Insight, review, outcome, value types |
| `lib/tessiant-pulse-rules.ts` | Rule config and `generateTessiantInsights` |
| `lib/tessiant-knowledge.ts` | Four knowledge-block definitions and live metrics |
| `lib/pulse-journey.ts` | Insight id embedded in task text; contextual chips |
| `lib/pulse-presentation.ts` | Evidence labels, Ask Pulse catalog |
| `lib/pulse-overview-charts.ts` | Cockpit chart series |
| `lib/network-intelligence.ts` | Network intelligence dashboard data |
| `lib/format.ts` | Dates, `uid`, greeting, plurals. Use these, do not reimplement |
| `lib/record-intelligence.ts` | Per-record insight chips |

## UI composition

- Pages are client components that read `useWorkspaceData()` and call `crm.*`.
- Cross-page UI (copilot, task form, task drawer, add lead, toasts, confirm sign-out) is owned by `AppShell`, not the page.
- Quick panels: `LeadQuickPanel`, `AccountQuickPanel`, `ContactQuickPanel`, `OpportunityQuickPanel`, `AssociateQuickPanel`, `RequirementQuickPanel`, `AssignmentQuickPanel`.
- Shared primitives: `src/components/ui/` (`Button`, `Icon`, `Overlay`, `Select`, `TagMultiSelect`, `EntityCard`, `bits`).
- Feature CSS is a CSS module next to the feature. Global tokens live in `src/app/globals.css`.

## Explicitly absent

No Salesforce, SharePoint, or LinkedIn sync. No outbound email or WhatsApp delivery. No CV file storage (`demo://` refs and `replaceAssociateCv` are local metadata). No ML training on Pulse feedback. Marketing and Finance Ops workspaces from the old PRD are not built. A separate investor Pulse product exists outside this repo; do not import it. This Pulse is the Tessiant tenant `tessiant-demo` on this CRM's data.
