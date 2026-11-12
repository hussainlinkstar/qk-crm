# Domain rules

Follow these when a change touches records, numbers, matching, or insights. Re-read the cited function before changing a formula.

## Commercial numbers

An opportunity carries five different figures. UI copy must name which one it is.

| Field | Meaning |
|---|---|
| `amount` | Estimated pipeline value. Open stages only |
| `probability` | Win likelihood 0–100. Defaults from `stageProbability` when stage changes |
| weighted | `amount * probability / 100` via `weightedPipelineValue`. Closed Lost is 0. Closed Won uses agreed value if present |
| `agreedContractValue` | Agreed after Closed Won. Still not recognised revenue |
| `expectedBilling` | Forecast from assignments / SOWs |
| `recognisedRevenue` | Realised when engagements complete |

`commercialBuckets` in `sales-crm.ts` is the only rollup. Do not add pipeline into recognised revenue. Currency is `GBP \| EUR \| USD` per record; do not assume a single currency in a sum without saying so.

Placement margin is separate: `estimatedMargin` compares associate cost and client rate **only when unit and currency match**. Label remains an estimate. Do not copy margin into `recognisedRevenue`.

Pulse value (`PulseValueAttribution`) is a third ledger: `realisedRevenue`, `pipelinePotential`, `estimatedTimeSavedHours`, `directCostSavings`, `qualitativeBenefit`. `attributedSourceKeys` blocks counting the same source twice. A second outcome on the same insight must not add the money again.

## Sales lifecycle

1. Lead is the pre-opportunity person. Status flow: New → Working → Qualified, or Unqualified. Converted is the exit into account records.
2. `addLead` dedupes an identifiable person (same email). On duplicate it returns `existingId` and does not create a second lead.
3. `convertLead` requires an existing `ClientAccount`. It creates the contact and opportunity (currency GBP in this path), sets the lead to Converted, and records a conversion activity. It refuses a second conversion. Closed Won / Lost live on the opportunity, not the lead.
4. `createRequirementFromOpportunity` only runs when the opportunity is Proposal, Negotiation, or Closed Won. It links `linkedOpportunityId`. Use it instead of hand-building a requirement that ignores the opportunity.
5. Activities (`/sales/actions`) are `ActivityEvent` rows with `activityType` (`call`, `meeting`, `email`, `introduction`, `note`, `follow_up`, `other`). Logging is not sending.
6. Growth insights (`sales-growth.ts`) and relationship strength (`sales-relationship.ts`) are derived. Do not persist a second copy of those labels onto the account unless a new explicit field is required.
7. `client360(state, accountId)` is the account read model: contacts, opportunities, requirements, assignments. Account pages should keep using it.

Lead sources are the Tessiant list in `LEAD_SOURCES` (referral, associate introduction, SIA, inbound, and so on). Old Signal/audit source strings normalize in `normalizeLeadSource`.

## Staffing lifecycle

Requirement (stored stage) and candidate (shortlist) move independently.

Requirement: New Requirement → Sourcing → Validation → Interview → Commercials → Placed, with outcome `active` until hold, loss, cancel, or archive. `archived` hides it from open counts.

Candidate, in order: suggested → contacted → availability_confirmed → shortlisted → submitted_to_client → interview → offer → placed, or rejected. `actionsForCandidate` in `requisition.ts` is the allowed next action for a status. Do not add a button that skips this helper.

Typical mutation chain:

1. `findMatches` ranks active associates with `rankMatches` and stores candidates plus reasons, gaps, and flags.
2. `shortlistAssociate` / `setCandidateStatus` moves one candidate.
3. `completeCandidateValidation` records availability and indicative cost.
4. `completeInterview` stores feedback.
5. `sendQuote` / `agreeQuote` set the client rate. These are CRM events, not emails.
6. `confirmPlacement` creates the `Placement` row, links requirement, associate, and candidate, and emits placement/assignment domain events.
7. `extendAssignment`, `completeAssignment`, `cancelAssignment` update ops lifecycle. Completion asks for `confirmedAvailableDate` and must call the availability sync (`syncAssociateAvailabilityFromAssignments`). That sync uses **committed capacity**, not "any placement = unavailable".

Match score (`buildMatchPresentation`): starts from a suitability base, adds verified/role/seniority/skills/sector fit, then subtracts an availability penalty. Final score is clamped 0–100. Availability is explained separately from skills fit (`currentlyAvailable` vs `commerciallySuitable`). Flags include `verified`, `unverified`, `unavailable`, `missing_data`, `manual_override`. Inactive associates are excluded from `rankMatches`. Show reasons and gaps in the UI; do not show a bare percentage with no explanation.

`NetworkStats.totalMembers` is the headline network size. Directory tables show the sample (`sampleSize`). Never present the sample count as the whole network.

Account ownership: `primaryOwnerId` and `secondaryOwnerId` on `ClientAccount`. Relationship-concentration insights depend on a missing secondary owner. Change owners only through `updateAccountOwners`.

## Pulse

Tenant id: `tessiant-demo`. Schema source: Tessiant CRM. Insights are regenerated by `generateTessiantInsights` and then merged with persisted reviews. They are not stored as a growing list of duplicates.

Rules (`PULSE_RULE_CONFIG` thresholds):

| Rule id | Looks at |
|---|---|
| `coverage_gap` | Open requirement with too few verified-available matches |
| `stalled_requirement` | Stage age over `stalledStageDays` |
| `expiring_availability` | Availability verification older than `availabilityVerificationDays` |
| `offering_mismatch` | Open demand vs what the network actually offers |
| `relationship_concentration` | Account with a single owner |
| `possible_cross_sell` | Staffing account with no consulting follow-on |
| `sia_contribution` | SIA-sourced work |

Knowledge blocks (`KNOWLEDGE_BLOCK_IDS`): `network`, `augmentation`, `commercial`, `capability`. Definitions and which metrics each block shows live in `tessiant-knowledge.ts`.

Loop:

1. Pending insight on `/pulse/insights`.
2. `acceptPulseInsight` writes a CRM task whose description contains `[pulse-insight:<id>]`. `findTaskForInsight` depends on that tag. Do not drop it.
3. `rejectPulseInsight` stores a reason on `tessiant.pulse.reviews`. Copy must not say the model will retrain.
4. `recordPulseOutcome` / `recordPulseValue` complete the loop. Value categories stay separate, and `attributedSourceKeys` is checked before adding money.

Evidence links use real entity ids and hrefs back to Sales or Staffing routes. A new insight rule needs an evidence href the user can open.

Ask Pulse (`askPulseCatalog` in `pulse-presentation.ts`) is a fixed grounded catalog. Ask Qiko (`answerQuestion` in `copilot.ts`) is a separate matcher over workspace records. Both return answer, evidence, and a recommendation. Executions (`create_task`, `update_status`, `open`) wait for the user. The `answerQuestion` signature is the future LLM seam; do not call a model from a page.

## Tasks as the unit of work

Home priorities, suggestion chips, Pulse accept, and assignment renewal follow-ups all become `Task` rows. Prefer `openTaskForm` / `createTask` over a bespoke todo list. A renewal follow-up should go through `ensureAssignmentRenewalFollowUp` so the placement stores `followUpTaskId`.

Suggestion decisions live in `state.decisions` keyed by suggestion id (`accepted`, `dismissed`, `done`). Accept creates the task; do not also leave the suggestion looking new.

## Copy and honesty

- Say "sample", "demo", or "estimate" where the seed or scorer is the source.
- Do not say "sent" for quote, email, or WhatsApp unless the row is only a log — then say "logged".
- Do not say "revenue" for pipeline or weighted pipeline.
- Settings connector rows stay `demo` or `future` until a real client exists.
