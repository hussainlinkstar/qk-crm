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
| `data-tenant="tessiant"` | CSS only. No component sets it today | Indigo brand overrides. Do not describe them as a live Tessiant green theme |

The sidebar wordmark already says Tessiant. Do not add a second theme attribute unless the task is specifically to turn that token block on.

## Build screens this way

- Page root: `<div className="page">`, header `page-head`, title plus `subtitle`.
- Loading: `SkeletonRows` from `bits`. Empty: `EmptyState`. Do not invent a spinner page.
- Actions: `Button` variants (`primary`, `secondary`, and the variants already in that file). Radius 10px. No pill buttons.
- Icons: `Icon` plus `IconName` from `src/components/ui/Icon.tsx` and `kind-icons.ts`. Do not drop in a new icon set.
- Confirms: `ConfirmDialog` from `Overlay`. Destructive resets and deletes use it.
- Tables and cards use the global classes (`card`, `card-head`, `card-body`) before adding a new module class.
- Feature-specific layout goes in a colocated `*.module.css`. Do not add Tailwind. This repo does not use it.
- Dates, relative time, initials, ids, and plurals come from `src/lib/format.ts`.

## Tone

Light canvas `#F7F8FA`, white panels, ink `#0C0F16`, borders `#E8EAEE`, purple accent `#9333EA` used sparingly. Compact type (body 13–14px). Flat cards, 12px radius. Status chips 6px radius. Modals and large panels 14px. Auth card is the exception at a larger radius; do not copy that radius into workspace cards.

Quiet, information-first. No large gradients, heavy shadows, or decorative charts. A chart is allowed when `TrendChart` or the Pulse chart components already serve that job.

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
