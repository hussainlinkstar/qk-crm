# UI conventions

Visual source of truth: `SIGNAL_STYLE_GUIDE.md` at the repo root. Where that guide and the code disagree, follow the code and the tokens in `src/app/globals.css`. The guide's `Button` path is stale; the component is `src/components/ui/Button.tsx`.

## Shell

`AppShell` is the authenticated frame: collapsible sidebar, mobile drawer, top bar, search, notifications, user menu, toasts, sign-out confirm, copilot panel, task form, task drawer, add-lead modal.

- New global actions go on `WorkspaceApi` in `WorkspaceContext.tsx` and are provided by `AppShell`. Do not mount a second copilot or toast stack on a page.
- Page titles come from `pageTitle()` in `AppShell`. Add a branch when adding a route.
- Sales attention badge and staffing attention badge are computed in `AppShell`. Extend those counts rather than adding a third badge system.
- Ask Qiko shortcut is Cmd/Ctrl+K.

Product theme attributes in `globals.css`:

| Attribute | Where it is set | Effect |
|---|---|---|
| `data-product="signal"` | `sales/layout.tsx` | Sales surface |
| `data-product="pulse"` | `PulseSubnav` on mount, removed on leave | Pulse indigo tokens |
| `data-tenant="tessiant"` | `AppShell` on mount | Tessiant workspace identity: deep teal `--brand` for primary actions, links, active nav |

Colour roles (see the comment at the top of `globals.css`):

- `--brand` is the workspace (Tessiant teal). Operational actions, links, active navigation.
- `--qiko-accent` is intelligence (Qiko indigo). Ask Qiko, insight cards, recommendations, Pulse. A tenant never overrides it. Use `.kicker-qiko` for a "Qiko" kicker and `Button variant="qiko"` for an intelligence action such as accepting an insight.
- Semantic tokens are for status only.

Pulse sets `data-product="pulse"`, which puts `--brand` back to indigo so Pulse keeps its own identity. The sidebar link opens Pulse in a new browser tab, by the user's decision.

## Build screens this way

- Page root: `<div className="page">`, header `page-head`, title plus `subtitle`.
- Record pages (one account, requirement, …) use `RecordHeader` from `src/components/ui/RecordHeader.tsx`: back link, mark, title, chips, one meta line, up to six facts, actions. Account 360 and the requirement page use it; lead and associate profiles still have their own hero. Put a "Qiko on this record" panel (indigo accent, actionable signals) directly under it, before the tabs, when the record has signals.
- Kanban cards: title, one context line, one progress line, one footer (owner avatar, one or two chips). Priority is the left edge via `data-priority`, not a chip.
- Every list page opens with a Qiko insight section: `InsightSignals` (`src/components/sales/InsightSignals.tsx`) shows three cards and folds the rest behind "View all". Signals come from a read-only lib (`contact-intelligence.ts`, `activity-intelligence.ts`, `sales-growth.ts`) and each one opens the record or task it rests on.
- Overview charts: `BarList` (labelled horizontal bars, rows can link) and `Spark` (sparkline in a tile). `CountUp` animates headline numbers. Keep Pulse's own chart components for Pulse.
- The floating Qiko launcher (`qikoFab` in `AppShell`) is the always-available way into Ask Qiko; it hides while the copilot drawer is open.
- Loading: `SkeletonRows` from `bits`. Empty: `EmptyState`. Do not invent a spinner page.
- Actions: `Button` variants (`primary`, `secondary`, and the variants already in that file). Radius 10px. No pill buttons.
- Icons: `Icon` plus `IconName` from `src/components/ui/Icon.tsx` and `kind-icons.ts`. Do not drop in a new icon set. `IconTile` (`src/components/ui/IconTile.tsx`) is the tinted square used on metric tiles (`className="metric-icon"`, top-right), signal cards and section headers; `signalVisual(kind)` in `signal-icons.ts` maps an insight kind to its icon and tone so the same signal looks the same everywhere. Avatars take `avatarStyle(name)` from `format.ts` for a stable colour per person.
- Confirms: `ConfirmDialog` from `Overlay`. Destructive resets and deletes use it.
- Tables and cards use the global classes (`card`, `card-head`, `card-body`) before adding a new module class.
- Feature-specific layout goes in a colocated `*.module.css`. Do not add Tailwind. This repo does not use it.
- Dates, relative time, initials, ids, and plurals come from `src/lib/format.ts`.
- Every Qiko claim carries provenance: `RecordInsight` ends with "N recorded facts · M inferences" and a "What Qiko doesn't know" toggle; signals and priorities carry `FeedbackThumbs` (compact on rows, labelled on spotlights). Figures that are not read from a record are labelled "estimate" (`chip chip-demo` styling, wording "estimate"); inferences carry the indigo sparkle; never present an inference as a fact.
- **Never write the words "demo", "showcase", "fictional" or "demonstration" in user-visible text** (user instruction, 2026-11-13). Internal identifiers (`chip-demo`, `demo: true`, `as_demo_*`, `DemoTour`) are fine; copy is not. Sample-data sources in Settings say "Sample data".
- Motion language for maps: the account `RelationshipMap` mirrors the Pulse knowledge map (breathing core rings, curved links with SMIL pulses on live edges, scale-in node arrival, glow on hover). Entrance animations must never start from opacity 0 on the element itself; a paused tab would show nothing. Honour `prefers-reduced-motion` by switching pulses off (`data-motion`).
- Human in the loop: anything Qiko would do on its own is a proposal with Approve / "Not this one" (`AutomationInbox`), never an action taken silently.

## Tone

Flat neutral canvas `#F6F7F9`, white panels, ink `#0F172A`, borders `#E6E8EE`. Tessiant teal for workspace actions; Qiko indigo only on intelligence. Compact type (body 13–14px). Flat cards, 12px radius, hairline border, `--shadow-xs` at most. Status chips 6px radius. Modals and large panels 14px. Auth card is the exception at a larger radius; do not copy that radius into workspace cards.

Quiet, information-first, output-driven. Lead a screen with what the data says (outcomes, findings, a ranked list), then the records. No canvas gradients, heavy shadows, or decorative charts. `Spark` (`src/components/ui/Spark.tsx`) is the inline sparkline for outcome tiles; `TrendChart` and the Pulse chart components serve full charts. Motion: one short page fade, hover lifts, content swaps. No per-block stagger animations.

## Responsive

Sidebar is persistent on desktop and a drawer on small screens (`AppShell` already does this). New pages must work in that main column: stack card grids, keep table scroll horizontal, keep touch targets at least 44px. Check a narrow viewport when the layout changes.

## Verification

After a UI or state change, with `pnpm dev` running:

1. Sign in at `/login` with any email.
2. Open the changed route from the sidebar, not only by URL.
3. Perform the action (create, edit, stage change, accept insight).
4. Refresh. The result must still be there (`qiko-core-crm`).
5. Open the other route that reads the same record (account 360, requirement, task list, Pulse evidence link) and confirm it matches.
6. If `DATA_VERSION` changed, reset demo data from Settings and confirm the new seed loads.

Run `pnpm lint` when the requested UI work is finished, not after every intermediate edit.
