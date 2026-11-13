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
| `/` | Home. Greeting + data lede, compact Ask Qiko, four outcome tiles (`homeOutcomes`), ranked "What matters now" (`buildTessiantHomePriorities`, limit 5), Pulse "best next move" (accept → task), my tasks, what changed this week |
| `/tasks` | My Tasks. Cross-workspace action list. Top-level nav item with open-task count |
| `/settings` | Profile, team members, automation rules (on/off, `#automations`), connector status (all demo/future), reset demo data |
| `/brief` | Morning brief outside the shell: same numbers, best move, priorities, proposals and changes as Home, printable, "Copy as text". `lib/morning-brief.ts` |
| `/confirm/[id]` | Associate-facing one-tap availability confirm page (no shell). Writes through `recordAvailabilityConfirmation` so the team's view updates at once |

Sales (`src/app/(workspace)/sales/`, layout sets `data-product="signal"`):

| Route | Nav label | Role |
|---|---|---|
| `/sales` | Overview | Sales overview: commercial position (separate money buckets), Qiko spotlight signals, journeys, next deals, pipeline by stage, pricing & margin intelligence (`PricingIntelligence`: margin per engagement, win rate by rate band, scarcity premium), follow-ups |
| `/sales/leads` | Leads | Lead-source strip, origination queue (`OriginationQueue`: ending engagements, unbought interests, quiet stakeholders, SIA introduction asks, won-with-nothing-behind; "Add as lead" / "Create task"), searchable lead list. Lead panel records "Introduced by" for network-sourced leads |
| `/sales/leads/[id]` | — | Lead profile, timeline, notes, messages, conversion |
| `/sales/pipeline` | Opportunities | Stage pipeline. Amounts are pipeline, not revenue. Proposal/Negotiation cards carry the pre-sales capacity check chip; the panel shows the full `CapacityCheck` (verified, bench by start, names, open requirement / run sweep) |
| `/sales/accounts` | Accounts | `ClientAccount` directory |
| `/sales/accounts/[id]` | — | Client 360: `RecordHeader` (`BrandMark`), "Qiko on this account" signals (founder-dependency score with trend and drivers, re-engage, expansion), relationship map (`RelationshipMap`, nodes for owners, stakeholders, associates, SIAs, deals, requirements, introduction paths), tabs for contacts, opportunities, staffing, activity |
| `/sales/contacts` | Contacts | Stakeholders on accounts |
| `/sales/actions` | Activities | Calls, meetings, email, notes, follow-ups |

Staffing (`src/app/(workspace)/staffing/`):

| Route | Nav label | Role |
|---|---|---|
| `/staffing` | Overview | KPIs, "Needs attention" findings, recommended actions, journeys, network mix, bench vs demand timeline (`BenchTimeline`, 30/60/90 by skill or sector, cell detail rail), supply vs demand, pipeline |
| `/staffing/associates` | Talent Network | Confirm queue (`ConfirmQueue`: lowest availability confidence ranked by brief need; confirm, date, copy one-tap link), network intelligence signals, verified supply by sector, directory (cards show `Portrait`), Add associate with the CV parser (`CvParser`, paste text → skills/sectors/seniority/rate/summary) |
| `/staffing/associates/[id]` | — | Talent profile (availability-confidence fact with "Confirm as recorded"), CV & docs, experience, assignments, Introductions tab (`IntroductionsPanel`: doors opened, requests waiting, showcase reach), recruitment, commercials, notes |
| `/staffing/requirements` | Requirements | KPI tiles, requirement intelligence signals (`staffing-intelligence.ts`), demand by sector chart, requisition list / board, create |
| `/staffing/requirements/[id]` | — | Journey, sourcing sweep (with before/after toggle), named introducers (`Introducers`: request intro → task tagged `[intro-request:associate:requirement]`), matches, shortlist, Interviews tab with `ScorecardComparison` + `InterviewScorecard` per candidate, Commercials tab with `PricingGuidance`, timeline |
| `/staffing/placements` | Assignments | KPI tiles, assignment intelligence signals (renewal due, ending soon, starting soon), deployed-by-client chart, recommended actions, deployment desk. Query e.g. `?view=active` |
| `/staffing/placements/[id]` | — | One assignment |
| `/staffing/offerings` | Offerings | Directory list (same row pattern as Accounts): each offering with pool (free now), accounts (bought), won, margin and a health flag. A row opens `OfferingQuickPanel` (drawer): "The decision" first (network share, bench gap, open briefs), then who can deliver it, who wants it, deals, margin. `lib/offerings.ts` (`offeringCatalogue`, `offeringDecision`) |
| `/staffing/clients` | — | Older clients view of the same accounts. Primary account UI is `/sales/accounts`. Do not fork the data |

Pulse (`src/components/pulse/PulseSubnav.tsx`, sets `data-product="pulse"`):

| Route | Label |
|---|---|
| `/pulse` | Cockpit: decisions tiles (high-intent, open, awaiting your OK, right-call rate), associate growth, roles, CRM activity, open signals by knowledge block, four-block knowledge map, live ticker, insight review |
| `/pulse/knowledge` | Knowledge (4 blocks) |
| `/pulse/knowledge/[id]` | One block: `network`, `augmentation`, `commercial`, `capability` |
| `/pulse/insights` | Generated insights |
| `/pulse/actions` | To-dos created from accepted insights |
| `/pulse/value` | Realised / pipeline / estimate, anti-double-count, plus Qiko's record strip (raised, acted on, outcomes, right-call rate from the feedback ledger; four verdicts seeded) |
| `/pulse/connections` | Connector status. Not live integrations |

Nav source of truth: `NAV` plus the Intelligence and Account blocks in `src/components/shell/AppShell.tsx`. Home and My Tasks are flat items; Sales and Staffing disclose their children only while active. My Tasks, Sales and Staffing show counts (my open tasks, open sales work, open unfilled requirements). Pulse is a top-level Intelligence link that opens in a new browser tab (its own product surface), not a child of Sales.

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
| `lib/staffing-intelligence.ts` | Requirement and assignment list-page signals, demand by sector |
| `lib/network-mix.ts` | Client-brief shares (SIA revenue share, retail share, Government experience), sector mix, pool vs offerings |
| `lib/deal-journey.ts` | Deal → requirement → placement chain from recorded links (`linkedOpportunityId`, `requirementId`). Rendered by `components/journey/DealJourney` (ribbon) and `JourneysInFlight` (overview list) |
| `lib/showcase-signals.ts` | Showcase layer (tagged demo): second-degree network reach for thin briefs, past-client hiring signals, rate benchmarks. Reads `networkStats.secondaryMembers` and `secondDegreeBySkill` from the seed; never names unrecorded people |
| `lib/sourcing-sweep.ts` | Sourcing sweep plan: recorded CV and first-degree counts from the matcher, demo second-degree and LinkedIn figures, manual-hours comparison. Rendered by `SourcingSweep` on open requirement pages; completion calls `crm.findMatches` |
| `lib/contact-intelligence.ts` | Contact signals and stakeholder coverage |
| `lib/activity-intelligence.ts` | Sales activity signals and logged-interaction mix |
| `lib/supply-demand.ts` | Supply vs demand snapshot |
| `lib/pulse-adapter.ts` | `createDomainEvent`, `getPulseSnapshot` |
| `lib/tessiant-pulse-types.ts` | Insight, review, outcome, value types |
| `lib/tessiant-pulse-rules.ts` | Rule config and `generateTessiantInsights`. Rules: coverage_gap, stalled_requirement, expiring_availability, offering_mismatch, relationship_concentration, possible_cross_sell, sia_contribution, plus (13 Nov) founder_dependency, proposal_without_brief, bench_gap, offering_gap, sia_dormant, each read from the CRM libs (`founder-dependency`, `bench-timeline`, `offerings`) |
| `lib/tessiant-knowledge.ts` | Four knowledge-block definitions and live metrics |
| `lib/pulse-journey.ts` | Insight id embedded in task text; contextual chips |
| `lib/pulse-presentation.ts` | Evidence labels, Ask Pulse catalog |
| `lib/pulse-overview-charts.ts` | Cockpit chart series |
| `lib/network-intelligence.ts` | Network intelligence dashboard data |
| `lib/format.ts` | Dates, `uid`, greeting, plurals. Use these, do not reimplement |
| `lib/record-intelligence.ts` | Per-record insight chips, `previewRequirement` (brief from an opportunity) |
| `lib/record-insights.ts` | `RecordInsight` builders; every exported builder wraps a core and adds `unknowns` ("what Qiko doesn't know") |
| `lib/qiko-track-record.ts` | Qiko's scorecard: raised, accepted, acted on, outcomes, value, feedback accuracy. Reads `state.feedback` |
| `lib/relationship-map.ts` | Account relationship graph: nodes, edges, introduction paths from `lead.introducedByAssociateId` |
| `lib/founder-dependency.ts` | Founder-dependency score (ownership, stakeholder breadth, interaction concentration) with a six-month trend |
| `lib/origination.ts` | Lead origination queue |
| `lib/introductions.ts` | Introductions made, introducers for a brief, intro-request tasks |
| `lib/bench-timeline.ts` | 30/60/90 bench vs demand by skill or sector; `benchDate` |
| `lib/capacity-check.ts` | Pre-sales capacity check for Proposal/Negotiation deals |
| `lib/pricing-intelligence.ts` | Placement margins, win rate by band, scarcity premiums, per-brief pricing guidance |
| `lib/availability-confidence.ts` | Availability confidence score, confirm queue, `recordAvailabilityConfirmation`, confirm link |
| `lib/cv-parser.ts` | Deterministic CV-to-profile parser (demo) |
| `lib/offerings.ts` | Offerings catalogue |
| `lib/automations.ts` | Human-in-the-loop rules and proposals; decisions stored under `auto:` keys |
| `lib/morning-brief.ts` | Brief data and plain-text rendering |

## UI composition

- Pages are client components that read `useWorkspaceData()` and call `crm.*`.
- Cross-page UI (copilot, task form, task drawer, add lead, toasts, confirm sign-out) is owned by `AppShell`, not the page.
- Quick panels: `LeadQuickPanel`, `AccountQuickPanel`, `ContactQuickPanel`, `OpportunityQuickPanel`, `AssociateQuickPanel`, `RequirementQuickPanel`, `AssignmentQuickPanel`. Every one opens with `RecordInsight` ("Qiko on this …": verdict, labelled facts, next step, one action) fed by the matching builder in `src/lib/record-insights.ts`. Add a builder there before adding a panel.
- Shared primitives: `src/components/ui/` (`Button`, `Icon`, `Overlay`, `Select`, `TagMultiSelect`, `EntityCard`, `bits`).
- Feature CSS is a CSS module next to the feature. Global tokens live in `src/app/globals.css`.
- Feedback ledger: `FeedbackThumbs` (`src/components/ui/FeedbackThumbs.tsx`) writes `crm.recordFeedback(key, context, verdict)`; keys are `priority:<id>`, `signal:<id>`, `task:<id>`, `origination:<id>`, `pricing:<id>`, `offering:<key>`. Home's `QikoTrackRecord` reads it. `TaskDrawer` asks Qiko-made tasks (origin suggestion/copilot) for an outcome line or verdict before completing.
- Automations: `AutomationInbox` on Home proposes; approve runs the action; `Settings#automations` toggles rules. `DemoTour` (`src/components/shell/DemoTour.tsx`) spotlights elements by `data-tour` attribute across pages; start from the top-bar compass or the first-visit offer.
- Illustrative identity: `Portrait` (people) and `BrandMark` (organisations) are seeded SVGs, not photos or logos; the demo stores neither.

## Explicitly absent

No Salesforce, SharePoint, or LinkedIn sync. No outbound email or WhatsApp delivery. No CV file storage (`demo://` refs and `replaceAssociateCv` are local metadata). No ML training on Pulse feedback. Marketing and Finance Ops workspaces from the old PRD are not built. A separate investor Pulse product exists outside this repo; do not import it. This Pulse is the Tessiant tenant `tessiant-demo` on this CRM's data.
