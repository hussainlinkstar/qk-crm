# Tessiant CRM Demo V1 — change log

**Date:** 6 November 2026  
**Target:** Existing Qiko Core CRM (`qiko-crm-admin`) — not a greenfield app.

## Summary

Added a Tessiant staff-augmentation portal under `/staffing` on top of Qiko Core: associates directory, client requirements with explainable matching/shortlist, placement commercials, client relationship owners, Tessiant green theme overlay, and a shared Pulse domain-event adapter. Existing Sales CRM behaviour is preserved.

## Reused vs adapted vs added

| Area | Approach |
|---|---|
| App shell, auth, toasts, modals, tasks | **Reused** (`AppShell`, `WorkspaceContext`, task modals) |
| Page chrome, cards, chips, tables, CSS variables | **Reused** (`globals.css`, `bits`, `Button`, `Icon`) |
| localStorage CRM store + demo seed pattern | **Adapted** — `DATA_VERSION` 3→4, optional `tessiant` slice |
| Leads directory / profile / pipeline UX patterns | **Adapted** as templates for associates & requirements |
| Sales overview KPIs | **Adapted** pattern for staffing KPIs |
| Associates, requirements, matching, placements, Pulse adapter, Tessiant theme | **Added** |

## Routes added

- `/staffing` — overview KPIs, open reqs, Pulse handoff panel
- `/staffing/associates` — sample directory (search/filter)
- `/staffing/associates/[id]` — profile + demo edits
- `/staffing/requirements` — list + create with validation
- `/staffing/requirements/[id]` — integrated stage/match/commercial workspace
- `/staffing/placements` — confirmed placements + late-stage filter
- `/staffing/clients` — accounts, relationship owners, integration stubs

## Key files

**Added**
- `src/lib/tessiant-types.ts`
- `src/lib/tessiant-matching.ts`
- `src/lib/tessiant-insights.ts`
- `src/lib/pulse-adapter.ts` (`getPulseSnapshot`, `createDomainEvent`)
- `src/data/tessiant-seed.ts`
- `src/app/(workspace)/staffing/**`
- `TESSIANT_CRM_DEMO_CHANGELOG.md`

**Edited**
- `src/lib/types.ts` — `CrmState.tessiant?`
- `src/data/demo-seed.ts` — version 4 + Tessiant slice + staffing tasks
- `src/lib/crm-store.ts` — staffing mutations + domain events
- `src/components/shell/AppShell.tsx` — Staffing nav, theme tenant, search
- `src/app/globals.css` — `[data-tenant="tessiant"]` green tokens (temporary demo; not claimed official)
- `src/app/(workspace)/page.tsx` — Tessiant workspace card
- `src/app/(workspace)/settings/page.tsx` — Tessiant / Salesforce stubs

## Demo seed storyline

1. **Retail transformation** (`req_retail`) — Elena (verified), Marcus (unavailable), Priya (sector mismatch)
2. **SAP architecture** (`req_sap`) — capacity gap Pulse signal
3. **SIA intro** (`req_sia`) — potential advisory, not booked revenue
4. **Public-sector expansion** (`req_public`) — coverage signal
5. **Crest Consumer** — founder relationship concentration (no secondary owner)

Network KPI **524** aggregate; sample table **48** profiles (explicitly labelled).

## Mocked boundaries (honest)

- No Salesforce / SharePoint / LinkedIn
- No real email/WhatsApp sending for quotes
- No AI match endpoint — deterministic scorer
- Pulse is adapter-only (`domainEvents` + `getPulseSnapshot`); nav Pulse remains “Soon”
- CV refs are `demo://…` fiction
- Persistence: browser `localStorage` key `qiko-core-crm`

## Run instructions

```bash
pnpm install
pnpm dev
```

Sign in (any email), open **Staffing**. If you still see old data, Settings → reset demo data (bumps to `DATA_VERSION` 4).

Walkthrough: Overview → open/create requirement → Find Matches → shortlist → verify → interview → quote → agree → confirm placement → Overview Pulse panel.

## Tests / QA

- Repo has no unit test runner configured (`lint` / `build` only).
- Run: `pnpm lint` and `pnpm build` after install.
