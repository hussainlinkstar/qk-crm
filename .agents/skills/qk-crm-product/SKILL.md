---
name: qk-crm-product
description: >-
  Product brain for the Tessiant operating workspace in this repo (Qiko Core CRM:
  sales, staffing, Pulse, tasks, copilot). Use when changing, extending, debugging,
  or reviewing this CRM — leads, accounts, contacts, opportunities, activities,
  associates, requirements, assignments, placements, Pulse insights, Ask Qiko,
  demo seed, or crm-store. Read this skill before editing src/.
---

# Qiko / Tessiant CRM product skill

This skill is the map of the product in `qk-crm` (package `qiko-crm-admin`). The UI calls it **Tessiant**, an operating workspace powered by **Qiko Core**.

`README.md` is the original Sales-only PRD. It is stale. Do not revert staffing, accounts, opportunities, or Pulse to that older Signal-only lead model. `TESSIANT_CRM_DEMO_CHANGELOG.md` and `TESSIANT_PULSE_DEMO_CHANGELOG.md` are historical; `DATA_VERSION` and the source files below are current.

Source code wins over this skill. If they disagree, follow the code, then update the matching reference in this folder in the same change.

## Read before editing

1. This file.
2. The one reference that matches the change (links below). Do not load every reference for a small edit.
3. The current source files named in that reference. Re-read them; do not code from memory of this skill.
4. For any Next.js API, file, or config change, read the matching doc in `node_modules/next/dist/docs/` first. This app is Next.js 16, not older App Router.

## What the product is

A client-only demo CRM for a B2B consulting and staff-augmentation firm. One signed-in member works three connected areas:

- **Sales** — leads, accounts, contacts, opportunities, activities.
- **Staffing** — talent network (associates), client requirements, candidate shortlists, assignments.
- **Qiko Pulse** — deterministic insights over that same data, with accept → task → outcome → value.

There is no API server, database, or auth provider. State lives in the browser. Integrations (Salesforce, SharePoint, LinkedIn, live email, WhatsApp, Signal) are labelled demo or future. Never present them as connected.

## Hard product rules

- **One store.** Read with `useCrm()` / `useWorkspaceData()`. Write only through `crm.*` in `src/lib/crm-store.ts`. Do not `localStorage.setItem` from a page.
- **One account record.** `CrmState.tessiant.accounts` (`ClientAccount`) is the account. Sales accounts and staffing clients are the same rows. Do not add a second account collection.
- **Money is not one number.** Keep pipeline amount, weighted pipeline, agreed contract, expected billing, and recognised revenue separate. A placement day-rate is not opportunity revenue. See [domain-rules.md](domain-rules.md).
- **Assignments share capacity.** `capacityPercent` on a placement is that engagement's share. Overlapping assignments are allowed. Do not mark an associate fully unavailable just because one placement exists.
- **Matching and Pulse are deterministic.** Scores come from `tessiant-matching.ts`. Insights come from `tessiant-pulse-rules.ts`. Ask Qiko answers come from `copilot.ts`. Do not add a live model call or claim the demo trained a model.
- **Facts stay labelled.** Copilot and Pulse evidence uses `fact` vs `inference`. Do not invent customers, metrics, or message sends.
- **Seed shape changes bump `DATA_VERSION`** in `src/data/demo-seed.ts`. `readCrm` drops stored state when the version differs and reseeds. Say that in the user-facing note when a bump is required (Settings → reset demo data).
- **Domain events.** Staffing and sales mutations that Pulse must see go through `createDomainEvent` / `appendDomain`. Stable `eventId`s; duplicates are ignored.
- **Demo honesty.** New UI that depends on an unbuilt integration shows a demo or future state. Do not fake a successful external send.

## Change workflow

```
- [ ] Name the surface: shell, sales, staffing, pulse, tasks, copilot, settings, or store
- [ ] Read the matching section in product-map.md and domain-rules.md
- [ ] Read the current page, component, and lib file before editing
- [ ] Extend an existing crm.* action instead of a parallel write path
- [ ] If a stored field or seed shape changes, bump DATA_VERSION and seed/upgrade path
- [ ] If a route, entity, status, or crm method is added, update this skill's reference
- [ ] Match existing UI (Button, Icon, Overlay, CSS modules, SIGNAL_STYLE_GUIDE.md)
- [ ] Verify the changed flow in the browser, including a second page that reads the same state
```

Surface → first files:

| Change | Open first |
|---|---|
| Navigation, auth gate, toasts, task drawer, add-lead, Ask Qiko shell | `src/components/shell/AppShell.tsx`, `WorkspaceContext.tsx` |
| Any persisted behaviour | `src/lib/crm-store.ts` method, then the page that calls it |
| Sales record or pipeline | `src/lib/types.ts`, `src/lib/sales-crm.ts` |
| Staffing record, match, or assignment | `src/lib/tessiant-types.ts`, then the lib in [domain-rules.md](domain-rules.md) |
| Pulse insight, value, or knowledge | `src/lib/tessiant-pulse-rules.ts`, `tessiant-pulse-types.ts` |
| New screen | nearest existing page in the same area; copy its chrome, do not invent a new layout system |
| Visual only | [ui.md](ui.md) and `SIGNAL_STYLE_GUIDE.md` |

## After the change

Update the reference file in this skill when the change adds or renames a route, entity, status, `crm.*` method, Pulse rule, or money bucket. Leave the reference alone for a copy or style tweak.

Verify in the browser: sign in with any email, exercise the control, refresh, and open the other screen that shows the same record. Demo persistence is `localStorage` key `qiko-core-crm`. A version bump only appears after reset or a fresh browser store.

## References

- [product-map.md](product-map.md) — routes, entities, store, file map
- [domain-rules.md](domain-rules.md) — sales, staffing, Pulse, copilot, money
- [ui.md](ui.md) — shell, visual system, components, what not to restyle
