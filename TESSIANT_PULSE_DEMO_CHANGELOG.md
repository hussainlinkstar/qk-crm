# Tessiant on Qiko Pulse — Demo V1 change log

**Date:** 6 November 2026  
**Companion:** `01_Tessiant_CRM_Cursor_Build_Spec.md` / CRM Demo V1 in this repo  
**Build note:** A separate investor-domain Qiko Pulse product exists elsewhere (`savvy/Qiko/.../qiko-v2`). Tessiant staffing Pulse is implemented here as a **tenant intelligence configuration** on the shared CRM fixture so entity IDs and KPIs reconcile for the founder demo. This is **not** a claim of live multi-repo sync.

## What shipped (P0)

| Surface | Route |
|---|---|
| Cockpit | `/pulse` |
| Knowledge blocks | `/pulse/knowledge`, `/pulse/knowledge/[id]` |
| Insights | `/pulse/insights` |
| To-dos / actions | `/pulse/actions` |
| Value | `/pulse/value` |
| Connections | `/pulse/connections` |

Knowledge blocks: **Network**, **Augmentation**, **Commercial** (P0) + **Capability** (P1 light).

Rules (deterministic): `coverage_gap`, `stalled_requirement`, `expiring_availability`, `offering_mismatch`, `relationship_concentration`, `possible_cross_sell`, `sia_contribution`.

Loop: **Accept → CRM task** · **Reject → feedback reason** · **Complete → outcome/value** with anti-double-count keys. No auto ML training claims.

## Reusable Pulse V1 vs Tessiant-specific

| Platform-level reusable | Tessiant configuration/data |
|---|---|
| App shell, nav, cards, chips, localStorage persistence | Tessiant context labels + DEMO badges |
| Insight review lifecycle (pending/accept/reject) | Tessiant rule IDs + knowledge block IDs |
| Evidence/provenance UI linking to source records | Associate/requirement/account/candidate IDs from CRM seed |
| Task acceptance + completion | Staffing follow-ups tagged `[pulse-insight:…]` |
| Value framework (realised / pipeline / estimate) | Placement day-rates + outcome attribution |
| Connections status panel | Shared `pulse-adapter` + honest non-Salesforce stubs |
| Chart/KPI layout primitives | Network mix, stage funnel, Tessiant KPIs |

### Existing product conflict / gap

- Full Pulse monorepo is **Joseph Mews investor intelligence**, not staffing — wrong domain to fork for this demo.
- CRM previously had Pulse as **nav “Soon”** only; adapter existed after CRM Demo V1.
- **Smallest general-purpose change used:** `tessiant.pulse` review/outcome store + pure `generateTessiantInsights(state)` — no premature multi-tenant engine rebuild.

## Shared CRM ↔ Pulse contract

- Source: `CrmState.tessiant` + `getPulseSnapshot()` / `domainEvents`
- Tenant: `tessiant-demo`
- Schema: `PULSE_SCHEMA_VERSION = 1`, source `tessiant-crm`
- Same IDs as staffing seed (`req_sap`, `acc_crest`, `as_elena`, …)
- `DATA_VERSION` bumped to **5** (includes `pulse` slice)

## Mocked boundaries

- No live Salesforce/SharePoint/LinkedIn
- No autonomous hiring/messaging
- Chat uses predefined grounded answers only
- Feedback stored for *future* rule review — not trained models

## Run / demo script

```bash
pnpm install
pnpm dev
```

1. Staffing CRM: open retail requirement, progress shortlist/placement as needed  
2. Open **Qiko Pulse** → see same requirement evidence on coverage/relationship insights  
3. Accept a capacity-gap or relationship insight → task appears under Pulse To-dos  
4. Complete + record outcome → Value page shows separated categories  
5. If stale data: Settings → reset demo data  

## QA

- `pnpm lint` / `pnpm build` after changes  
- Verify accept/reject persists across refresh  
- Verify second outcome on same insight does not double-count financials  
- Verify evidence links open staffing CRM records  
