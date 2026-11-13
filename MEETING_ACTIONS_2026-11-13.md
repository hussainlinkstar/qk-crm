# Tessiant review, 13 Nov 2026 — action plan

Source: Gemini notes and transcript of the review with Jake (Ed absent). Owner for every item is Ali.
Status reflects the local build at the time of writing. Companion: `CLIENT_BRIEF_MAP.md`.

## Decisions taken in the meeting

1. **Showcase over realism.** Design the demo as if Tessiant has all its data and a premium LinkedIn account. Realistic-but-boring signals are out; compelling ones are in.
2. **Every point in Christine's email is evidenced** as a visible element and a talking point.
3. **Staffing and CRM are shown as one product.** Qiko Core (CRM) and the staff-augmentation product must read as one cohesive flow, with the network and LinkedIn sourcing step visible.

## Action points

| # | Action (from the notes) | What it means in the product | Status |
|---|---|---|---|
| 1 | Schedule a Monday-morning review with Ed before the call | Calendar invite, similar time to today | **To do (you)** |
| 2 | Move the bottom Home element to the top, thinner, full width, two columns | "Best next move" is now a slim two-column band directly under Ask Qiko: headline and summary left, evidence and actions right | **Done** |
| 3 | Map Christine's email to talking points and visible elements | `CLIENT_BRIEF_MAP.md`; Network mix card on Staffing overview with her three shares in her words; SIA-introduced win seeded so the SIA share is real | **Done** |
| 3a | Show 500-plus contractors in Talent Network "rather than 48" | Directory now holds 511 profiles (the hand-written records plus deterministic, clearly fictional "demo-sample" profiles weighted like a real bench: retail-heavy, a public-sector minority, a small SIA tier, most people deployed). Network headline stays 524. Performance checked: directory navigation shows one 50ms task; matching over 511 profiles is instant. Page size raised to 20. DATA_VERSION 20 | **Done** |
| 3b | Use her titles: Senior Industry Advisors, SAP solution architect | Role filter and headlines already use SIA and executive advisor; SAP S/4HANA solution architect requirement exists | **Done** |
| 4 | Couple staffing and CRM explicitly | "From deal to delivery" ribbon (Deal → Requirement → Placement, current node highlighted, next move named) on the opportunity panel, every requirement page, every assignment page and Account 360; a linked-requirement chip on pipeline cards; "From deal to delivery" chains in flight on both the Sales and Staffing overviews. All resolved from recorded links only | **Done** |
| 5 | Evidence the sourcing step: trawling LinkedIn, the network and internal CVs, compressed from hours to seconds | "Sourcing sweep" on every open requirement page: Internal CV library → Tessiant network (1st degree) → 2nd-degree network → LinkedIn (premium), each step counting up as it runs, then "3,658 profiles checked · 3h by hand → 4s with Qiko" and the matcher refreshes Recommended matches. Internal and first-degree counts are recorded; the outer two are labelled demo. The header "Find Matches" button plays it | **Done** |
| 6 | Make secondary signals showcase-level (Jake: "pedestrian"). Example: five second-degree connections could fill an open role; 500 primary and ~3,000 secondary network | Seeded a 3,100-profile second-degree network with per-skill reach. Showcase signals (tagged "showcase") now sit in Sales "What deserves attention" and Staffing "Needs attention": "N second-degree connections could fill …" with a Request-introductions task, past-client "Hiring signal" leading to originate an opportunity, and a "Rate benchmark" on deals in proposal or negotiation. The sourcing sweep draws from the same seed | **Done** |
| 7 | Fix white space in the Sales insights box | Replaced by the spotlight layout (one signal in focus, ranked rail) | **Done** |
| 8 | Brand the Leads page insights as Qiko, consistent with everywhere else | Leads top strip now sits under a Qiko kicker and heading with the indigo card treatment | **Done** |
| 9 | "Review evidence in Pulse" routing | Opens Pulse Insights in a new tab from the Home band; deep-linking to the specific insight is a small follow-up | **Partly** |
| 10 | Ask Qiko "goes to the back" when opened from a panel | Verified today from the lead panel: the copilot opens on top. If it recurs on a specific screen, note which | **Verified** |
| 11 | Deploy the updated prototype and share the link before the weekend | Vercel deploy from your machine; this session is local-only by your instruction | **To do (you)** |
| 12 | Feedback loop on whether "high priority" was right (your own idea) | Built: ✓ ○ ✕ on Home focus rows, signal cards and spotlights; "Close the loop" on Qiko-made tasks; Home "Track record" tile shows raised / acted on / outcomes / attributed and the right-call rate | **Done** |

## Suggested order to hit the Friday deploy

1. ~~Item 5 (sourcing sweep)~~ done.
2. ~~Item 4 (deal → requirement → placement coupling)~~ done.
3. ~~Item 6 (showcase signals with a seeded second-degree network)~~ done.
4. ~~Item 3a (511 profiles)~~ done; performance passed.
5. Deploy, send the link, book Monday with Ed.
