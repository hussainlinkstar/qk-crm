# Qiko Core — AI-Powered Business Workspace

Product Requirements Document · V1.0 · 29 October 2026

## Product focus

Qiko Core is an AI-powered business workspace that connects customer interactions, operational data, and intelligent recommendations in one interface.

The initial MVP focuses on the **Sales Workspace**, while the application architecture should remain ready for:

- Marketing workspace
- Finance Ops workspace
- Qiko Pulse intelligence
- Additional CRM and business integrations

Primary demo user: **Ed**

## Vision

Qiko Core has three connected layers:

1. **Customer Experience** — Websites, Qiko Signal, forms, scans and customer interactions.
2. **Qiko Core Business Workspace** — CRM records, workflows, tasks, actions and customer context.
3. **Qiko Pulse Intelligence** — Insights, prioritisation, recommendations and proactive intelligence.

V1 builds Layer 2, starting with Sales and keeping the interface ready for Pulse.

## Workspace structure

### Home

After signing in, Ed should land on a personalised conversational dashboard.

Home includes:

- Personalised greeting
- AI business copilot
- Three actionable priority items with supporting context
- Task summary showing pending, in-progress and completed actions
- Workspace access for Sales, Marketing and Finance Ops
- Recent activity and important business changes
- Ability to open and complete actions

Marketing and Finance Ops are future workspaces and should be visibly marked as **Soon** in V1.

### Sales workspace

Sales is the functional MVP workspace. It should consolidate customer activity from Signal, the website, scans, enquiries and product usage into one CRM.

Required screens:

1. Sales overview
2. Unified leads table
3. Lead profile and activity timeline
4. Action workspace

## Sales overview metrics

Display only metrics supported by available data.

- Total leads
- Qiko Signal sign-ups
- Completed free scans/audits
- Active users with recorded activity
- Website and contact-form enquiries
- Follow-ups due
- Qualified sales opportunities

Historical trends should be shown when valid historical data is available.

## Unified CRM

The leads table must support search, filtering and opening a customer profile.

Each lead may include:

- Name and email
- Company or brand
- Source: Signal, website, free audit or manual entry
- Recent activity: signup, scan, enquiry, login or other event
- Last activity date
- CRM status: New, Contacted, Qualified, Won or Lost
- Lead owner
- Next recommended action

Multiple activities belonging to the same identifiable person should be merged into one CRM record rather than creating duplicate leads.

### Lead profile

A lead profile should show:

- Customer identity
- Company information
- Source attribution
- Activity history
- Associated scans and reports
- Notes
- Tasks and actions
- Engagement context

## Actions are the core unit

The action, rather than the metric, should be the primary unit of the V1 experience.

Examples:

- New Signal registration creates a lead-review action.
- Completed free scan creates a review-and-follow-up action.
- Website enquiry creates a contact action.
- Inactive or overdue leads are flagged for attention.

Actions should contain:

- Owner
- Status
- Priority
- Due date
- Linked lead
- Evidence/reason
- Completion history

Ed should be able to accept, dismiss, edit or complete AI-suggested actions.

## AI copilot

The AI copilot should be accessible from Home and the main Sales screens.

Example questions:

- What happened in sales today?
- Who signed up on Signal this week?
- Show users who completed a free scan.
- Which leads should I follow up with first?
- What actions are pending?
- Show me everything we know about this prospect.

Every grounded response should be structured as:

1. **Answer** — concise and evidence-based summary
2. **Evidence** — relevant records, activity and metrics
3. **Recommended action** — suggested next step
4. **Execution** — option to create a task, update a lead or start a supported workflow

## AI behaviour requirements

- Use available CRM and activity data only.
- Clearly distinguish confirmed facts from recommendations.
- Never invent customer information or metrics.
- Show source attribution and timestamps where available.
- Request confirmation before consequential external actions.
- Keep demo data separate and explicitly labelled.

## Data access

Initial integrations may include:

- Qiko Signal registrations, scans, reports and product activity
- Qiko website contact and assessment submissions
- Existing Qiko admin/account services
- New CRM records, notes, ownership and task storage

Before implementation, API availability and field coverage must be validated. Unsupported integrations should not be shown as live data.

Use a replaceable data-access layer for demo and production providers. Do not hardcode demo business values into application logic.

Required data characteristics:

- Source attribution
- Timestamps
- Identifiable-person deduplication
- Incremental synchronisation
- Real/demo data classification
- Clear error and loading states

## UI direction

- Modern AI-native business application
- Predominantly white and neutral surfaces
- Restrained Qiko brand accents
- Minimal gradients
- Compact KPI cards and structured tables
- Balanced spacing and readable typography
- Persistent navigation: Home, Sales, Marketing, Finance Ops and future Pulse
- Copilot available from major screens
- Contextual side panels for lead details, tasks and recommendations
- Responsive desktop and mobile layouts
- No excessive decorative charts or menus

## MVP acceptance criteria

| Priority | Deliverable | Acceptance criterion |
|---|---|---|
| P0 | Authentication and Home | Ed can sign in and view his workspace |
| P0 | Home priorities | Three actionable tasks are shown with supporting context |
| P0 | Sales dashboard | Available sales KPIs are displayed correctly |
| P0 | Unified CRM | Leads can be searched, filtered and opened |
| P0 | Lead profile | Customer activities and related records are visible |
| P0 | Task management | Tasks can be created, assigned, updated and completed |
| P1 | AI Copilot | Answers grounded questions using available CRM data |
| P1 | AI recommendations | Follow-ups include supporting evidence |
| P1 | Activity trends | Historical trends appear only when valid data exists |
| Later | Marketing and Finance Ops | Future workspaces are visible |
| Later | Pulse integration | Interface-ready for advanced intelligence |

## Build approach

Build Qiko Core as a modular application with:

- Functional Home dashboard
- Sales overview
- Unified lead management
- Lead detail panel
- Action workspace
- Task engine
- Grounded AI/copilot interface
- Replaceable demo and real data providers

The first design iteration should define these core screens:

1. Home
2. Sales Overview
3. Lead Detail
4. Action Workspace

## Technology

- Next.js App Router
- React
- TypeScript
- pnpm

Package installation and scripts will be run with pnpm.

## Planned setup commands

```powershell
cd C:\projects\Qiko\qiko-crm-admin
pnpm create next-app@latest . --ts --eslint --app --src-dir --import-alias "@/*" --use-pnpm
pnpm install
pnpm dev
```

## Recommended modules

```text
src/
├── app/
├── components/
│   ├── ai/
│   ├── dashboard/
│   ├── actions/
│   ├── leads/
│   ├── sales/
│   └── ui/
├── data/
├── lib/
└── types/
```

## Implementation rules

- Keep demo data separate from business logic.
- Build reusable data contracts for all CRM entities.
- Keep integrations modular.
- Preserve responsive loading, empty and error states.
- Do not present unavailable integrations as live functionality.
- Avoid unnecessary dependencies until a feature requires them.
- Do not commit secrets or environment files.
