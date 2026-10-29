# Qiko Core UI Style Guide

## Purpose

Qiko Core must follow Qiko Signal's authenticated light-app visual system.
This guide is the implementation reference for buttons, cards, forms, tables, navigation, typography, spacing, charts and states.
Qiko Signal is the visual source of truth: [frontend](/C:/projects/Qiko/qiko-signal/frontend).

## Do not run validation repeatedly

Run `pnpm lint` and `pnpm build` only when the requested UI implementation phase is complete or when the user explicitly asks for validation.

## Visual foundation

- Canvas: `#F7F8FA`
- Panels/cards: `#FFFFFF`
- Primary ink: `#0C0F16`
- Secondary text: `#4B5563`
- Muted text: `#6B7280`
- Borders: `#E8EAEE`
- Card/subsection wells: `#EEF1F6`
- Purple brand/accent: `#9333EA`
- Blue link/focus: `#2563EB`
- Success, warning and danger use restrained semantic colors rather than saturated decorative color.

The interface should feel light, quiet, compact and information-focused. Avoid excessive gradients, large shadows, oversized cards and decorative chrome.

## Radius scale

Use the Signal radius scale consistently:

- `6px`: badges and chips
- `8px`: nested controls and small visual segments
- `10px`: buttons, inputs, tabs, menu items, avatars and active sidebar navigation
- `12px`: cards, menus and tab tracks
- `14px`: panels, overlays and larger surfaces

Rules:

- Do not use pill-shaped action buttons or navigation rows.
- Reserve fully rounded shapes for status dots, switches, toggles and progress indicators.
- Action buttons use soft 10px corners, not 0px, 18px or unconstrained pill radii.

## Typography

- Font: Inter/system UI for product body and UI text.
- Use Satoshi when available for display typography, with Inter as fallback.
- Page titles are large, strongly weighted and tightly tracked.
- Section titles are approximately 18–20px and clearly separated from card content.
- Body text is normally 13–14px.
- Supporting and metadata text is 10.5–12px.
- Numeric metrics use tabular numbers and tight tracking.
- Uppercase micro labels use a monospace font, 10.5px, medium weight and roughly 0.08em letter spacing.

Avoid mixed font families inside one control and avoid using letter spacing that becomes too compressed in tables.

## Buttons

Use the reusable [`Button`](/src/components/Button.tsx) component for actions throughout the CRM. Choose `variant`, `size`, `fullWidth`, and native button props instead of creating one-off button CSS:

```tsx
<Button variant="primary" size="large" fullWidth>Sign in</Button>
<Button variant="secondary">Cancel</Button>
```


### Primary

- Height: 38px; 44px for touch/mobile
- Horizontal padding: 15px
- Background: `#111827` or near-black ink
- Text: white
- Radius: 10px
- Font: 13px, semibold
- Hover: pure black
- No prominent colored shadow

### Secondary / ghost

- Height: 38px; 44px for touch/mobile
- Background: `#EEF1F6`
- Text: primary ink
- Radius: 10px
- Hover: `#E8ECF3`

### Outline

- White or panel background
- Border: `#E8EAEE`
- Hover border: `#D7DAE0`
- Radius: 10px

### Danger

- Soft red background
- Red text
- Radius: 10px

Disabled controls use reduced opacity, no shadow and the normal disabled cursor state.

## Cards and surfaces

- Card radius: 12px
- Card background: white
- Standard border: light neutral line
- Cards normally do not use large dropshadows.
- A very subtle shadow is acceptable only when an elevated surface needs separation.
- Primary card padding: 24px
- Compact card padding: 20px
- Nested subsection cards: 16px with 12px mobile padding
- Use flat borders and surface hierarchy before adding shadow.

## Sidebar and navigation

- Sidebar background: white
- Active navigation item: `#EEF1F6`
- Active navigation text: primary ink
- Active navigation radius: 10px
- Navigation height: 40px
- Inactive navigation text: secondary gray
- Hover: `#F5F6F8`
- Future/disabled navigation remains subdued and communicates its unavailable status without looking interactive.

The sidebar should prioritize a compact hierarchy, clear active state and consistent vertical spacing.

## Forms and inputs

- Height: 40–44px
- Radius: 10px
- Border: `#E8EAEE`
- Background: white
- Text: primary ink
- Placeholder: muted gray
- Focus border: blue or purple, with a visible 2–3px accessible ring
- Labels must remain visible and readable, not rely on placeholders
- Validation states use semantic border/text colors and an associated message

Inputs should be quiet by default and become visually clear only on hover and focus.

## Tables

- White table surface inside a 12px card
- Header height: 44px
- Header background: nearly white
- Row height: approximately 68–72px
- Header text: uppercase or strong compact text with low contrast
- Row separators: very light neutral borders
- Hover: `#FAFAFC`
- Keep action columns narrow and align right
- Lead row actions should be proper buttons with text where practical, such as “View”

Avoid dense text and cramped controls. If the table exceeds the available width, keep horizontal scrolling instead of compressing columns.

## Badges and status chips

- Radius: 6px for compact labels
- Fully rounded shape only for status dots or special progress indicators
- Padding: approximately 8px horizontal and 4px vertical
- Font: 10–11px, semibold
- Use soft tinted backgrounds and dark accessible text for status states

## Menus, modals and panels
n- Menu radius: 12px
- Menu item radius: 10px
- Modal/panel radius: 14px
- Menu items use 13px text, medium weight and consistent 40px height
- Menus may use a restrained shadow; cards should remain flat
- Modal scrims use a neutral translucent overlay
- Keep close, cancel and primary actions clearly differentiated

## Charts

- Cards and chart backgrounds: white
- Chart grid lines are subtle gray
- Axis labels use muted gray
- Use restrained brand colors: purple, blue, green, orange and red only as semantic series
- Tooltips use panel background and a restrained elevation
- Prefer clear line/area charts for trends and compact donut/ring charts for source composition
- Avoid excessive chart decoration, 3D effects and unnecessary legends

## Home dashboard

- Greeting and subtitle establish hierarchy before cards.
- Copilot input is a full-width, single focused surface with one clear send action.
- Prompt suggestions are compact bordered controls with consistent spacing, not random labels.
- Snapshot cards should use consistent height and align metrics horizontally.
- Action and report lists should look like complete interactive rows with clear hover states and concise labels.
- Lead with content and hierarchy, not decorative gradients or dashboard clutter.

## Sales workspace
n- Put page purpose and primary Add Lead action at the top.
- Metrics are flat cards with 12px radius.
- The lead table is the primary working surface.
- Keep 30-day trends and source views only if they support the workflow; do not let charts compete with CRM actions.
- Lead detail drawers or overlays are full-height, with a persistent close action and clear profile hierarchy.

## Responsive behavior

- Desktop sidebar remains fixed; mobile uses compact navigation or a menu.
- Card grids collapse to one or two columns at narrower widths.
- Touch targets are at least 44px on mobile.
- Table action controls must remain accessible during horizontal scrolling.
- Typography remains readable; do not reduce card padding or type solely to force desktop density onto mobile.

## Authentication pages

Login, signup/register, forgot password, reset password and verify-email pages share the same Signal auth system.

### Auth layout

- Use a light gray canvas matching `[data-signal-auth]` and the authenticated workspace.
- Desktop auth uses a split composition where space allows: 1.05fr brand side and 0.95fr form side, centered inside a maximum width of 1120px.
- The brand side remains visible on desktop and is hidden below the large breakpoint.
- The form column is centered vertically with 420px maximum card width.
- The mobile layout contains only the essential form and footer navigation; avoid dashboard previews or product screenshots.
- Authentication branding, title, subtitle and form stay inside one clean white card.
- Auth card radius is 24px, matching the reference Signal login: this is intentionally larger than normal workspace cards.
- Desktop auth form card reference width is approximately 484px, with 36px horizontal and vertical padding.
- Use the canvas `#F7F8FA` for both columns. The reference does not use a dark auth panel.
- Form card is white with a single `#E8EAEE` hairline border and a restrained `0 12px 32px -20px rgba(15,23,42,.12)` shadow.
- Left-side product lockup sits near the top; large brand copy sits below it in a centered editorial column.
- The form lockup and product name sit above a quiet “Back to home” navigation link inside the card.
- The welcome title and subtitle use a clear two-level hierarchy directly above the inputs.
- Auth card border is a light neutral line; elevation is restrained: approximately `0 12px 32px -20px rgba(15,23,42,.12)` or lower.
- Page title is approximately 26px, extrabold, with tight tracking and 1.2 line height.
- Subtitle is approximately 13.5px with 1.5 line height.

### Auth brand panel

- Keep the brand lockup at the top, short value proposition in the center, and trust/footer note at the bottom.
- Brand copy should be about 34px, extrabold and tightly tracked on larger screens.
- Supporting text uses 15px with 1.55 line height; supporting lists use 13.5px.
- Brand chips use well/status neutral background, not saturated gradients.
- Decorative auth chips may be fully rounded only for promotional/status text.

### Auth cards, forms and inner controls

- Auth card internal vertical spacing is consistent: 20px between major groups.
- Form groups normally use 16px vertical spacing.
- Two-column fields can split at the small breakpoint; stack at mobile width.
- Labels are visible and persistent, not placeholder-only.
- Reference auth inputs have white background, hairline neutral border, 14px radius and 48px height.
- Auth inputs do not use leading icons in the reference; keep labels separate and rely on placeholder text only inside the field.
- Reference auth primary buttons are 52px tall, 14px radius and use the purple-to-indigo gradient.
- Auth card submit buttons use 15px semibold text and no decorative arrow or separate icon treatment.
- Editable fields use hover and focus feedback through border and focus-ring changes, not large shadows.
- Disabled fields use a very light gray fill; editable fields remain white.
- Validation text must sit directly under the affected field and use accessible semantic red, not decoration.
- Password fields include clear show/hide and strength feedback where applicable.
- Checkboxes use branded focus states and visible labels; legal links remain standard text links with underline on hover.
- Forgot-password links align right and use the auth accent color.

### Auth buttons

- Submit buttons are full width.
- Auth primary buttons use the configured auth gradient/background when tenant branding calls for it; default to the Signal primary style.
- Auth button height: 38px desktop and 44px on mobile for touch accessibility.
- Radius: 10px, never pill-shaped.
- Font: 13.5px, semibold.
- Include a restrained brand shadow only on auth CTAs: roughly `0 10px 24px -12px` tint at rest and a slightly stronger lift on hover.
- Auth button should provide clear loading text and use the same width/height while loading.
- Secondary auth actions use ghost/outline styling, not oversized colored cards.
- Social/provider buttons use consistent height, icon alignment and neutral border treatment.
- Do not add arrows as decoration unless they communicate forward/back navigation.

### Auth status and links

- Success notices use soft green; warnings use soft amber; errors use soft red; progress uses soft blue; trust uses soft purple.
- Status chips use 6px radius, 11–12px text and semantic soft fills.
- Inline alerts use a restrained tinted surface and complete title/message content; keep recovery actions as real buttons.
- Footer switches between auth states use concise text plus an accent-colored link: “New to Qiko Core?” + “Create an account”.
- Legal/footer links remain muted, compact and readable with a minimum 44px mobile touch height.
- Do not communicate success only through toasts; place durable confirmation or next-step guidance on the page where appropriate.

## Inner application surfaces

Authenticated inner pages, including dashboard, Sales, lead detail, actions, settings, forms and modals, must inherit the same light Signal surface rules rather than using the dark marketing/auth style.

### Page structure

- Use the flat `#F7F8FA` canvas and white content surfaces.
- Use a fixed compact sidebar, 40px navigation rows and a 64px top bar.
- Preserve a single clear page title, supporting subtitle and one primary page action.
- Group related controls in toolbars instead of scattering isolated icons.
- Keep page density compact; prefer consistent 12px card gaps and 24px page padding.
- Empty states must include a clear heading, concise explanation and a single primary/secondary action pair when applicable.
- Loading states should preserve layout dimensions and use restrained skeletons rather than layout-breaking spinners.
- Error states should identify the failed action and provide a retry action; avoid full-page decorative interruptions.

### Inner cards and action blocks

- Cards are white with 12px radius and very light or no shadow.
- Use `#EEF1F6` only as a subsection/well background, not as the main card background.
- KPI cards contain one dominant metric, a short label and optional supporting trend; avoid repeating decorative borders.
- Action blocks use a full-row interactive pattern, 40px minimum, with a clear hover background.
- Report rows, task rows and checklist rows should not look like separate nested fake buttons unless they perform a real action.
- Primary action rows can use text plus a restrained count/status and a clear View/Open affordance.
- Never use an arrow icon alone as the only way to show a row action when text such as “View” is clearer.

### Inner buttons and icon controls

- Reuse the same 38px primary/secondary/danger button variants.
- Icon-only controls require visible accessible labels, consistent 38px or 44px touch targets and quiet neutral surfaces.
- Header icon controls may use icon-only treatments, but form actions and row actions should use text labels.
- Use black/dark primary actions, not bright brand gradients, for normal workspace operations.
- Use ghost buttons for low-priority actions and outline buttons for secondary contextual actions.
- Keep button groups visually associated with one toolbar or form, with consistent 8px gaps.

### Tables, panels and workflows

- Tables sit inside one flat card with one header row, restrained separators and stable row action columns.
- Drawers/panels are full-height where appropriate, with a persistent close control at the top and clear section hierarchy.
- Lead profile cards should use the same card, status, label and typography rules as the rest of the product.
- Modals use 14px radius, restrained elevation and explicit Cancel plus primary actions in a dedicated footer.
- Toasts are secondary feedback; the underlying page or panel should also retain durable state for important actions.

## Implementation principles

1. Reuse existing primitives when available.
2. Keep hardcoded visual values centralized in CSS variables or style tokens.
3. Use borders and spacing before elevation.
4. Keep one visual language across authenticated screens, modals and forms.
5. Preserve accessibility: visible focus, semantic states, readable contrast and no color-only meaning.
6. Do not copy a web marketing style into the product workspace.
7. Do not introduce new generic component libraries or visual styles before matching Signal tokens.
