// Demo data provider. Clearly labelled as demo data in the UI (dataMode: "demo").
// Generated relative to "now" so the workspace always looks current. Replace this module
// with a real provider (Qiko Signal, website submissions, Admin V2) without touching screens.

import type {
  ActivityEvent,
  Contact,
  ConversationMessage,
  CrmState,
  Lead,
  Member,
  Opportunity,
  Scan,
  Task,
} from "@/lib/types";
import { adaptLeadRecord, normalizeLeadSource, normalizeLeadStatus } from "@/lib/sales-crm";
import { addDays, toDateKey } from "@/lib/format";
import { createTessiantSlice } from "./tessiant-seed";

export const DATA_VERSION = 24;

export function demoMessages(ago: (hours: number) => string): ConversationMessage[] {
  return [
    { id: "msg_felix_1", leadId: "l_felix", channel: "email", direction: "out", address: "felix@ardenpartners.com", subject: "Retail case study", body: "Felix — as promised, the retail visibility case study is attached. Happy to walk the partners through the Growth plan.", at: ago(100), actor: "You" },
    { id: "msg_felix_2", leadId: "l_felix", channel: "email", direction: "in", address: "felix@ardenpartners.com", subject: "Re: Retail case study", body: "Thanks. I'll review this with the partners and come back with questions on pricing for three brands.", at: ago(70), actor: "Felix Brooks" },
    { id: "msg_felix_3", leadId: "l_felix", channel: "whatsapp", direction: "out", address: "+44 20 7946 0999", subject: null, body: "Hi Felix, just checking the case study landed. Free for a short call Thursday?", at: ago(6), actor: "You" },
    { id: "msg_felix_4", leadId: "l_felix", channel: "whatsapp", direction: "in", address: "+44 20 7946 0999", subject: null, body: "Got it, thanks. Thursday afternoon works.", at: ago(4), actor: "Felix Brooks" },
    { id: "msg_amelia_1", leadId: "l_amelia", channel: "email", direction: "out", address: "amelia@northstar.com", subject: "Welcome to Qiko Signal", body: "Amelia — welcome aboard. I can walk you through what the free scan found for Northstar whenever you have 20 minutes.", at: ago(2), actor: "You" },
    { id: "msg_amelia_2", leadId: "l_amelia", channel: "email", direction: "in", address: "amelia@northstar.com", subject: "Re: Welcome to Qiko Signal", body: "Thanks. Can we look at the Growth plan for three brands this week?", at: ago(1), actor: "Amelia Hart" },
    { id: "msg_liam_1", leadId: "l_liam", channel: "email", direction: "out", address: "liam@harbour.co", subject: "Your Harbour & Co audit", body: "Liam — sharing what the audit covers and the three findings worth fixing first.", at: ago(96), actor: "Sarah Ahmed" },
    { id: "msg_liam_2", leadId: "l_liam", channel: "email", direction: "in", address: "liam@harbour.co", subject: "Re: Your Harbour & Co audit", body: "Prefer to stay on email. The mobile speed finding is the one I want to talk through.", at: ago(80), actor: "Liam O'Connor" },
    { id: "msg_liam_3", leadId: "l_liam", channel: "whatsapp", direction: "out", address: "+44 20 7946 0128", subject: null, body: "Sent the audit note by email. Shout if Thursday is better than Friday.", at: ago(18), actor: "Sarah Ahmed" },
  ];
}

const HOUR = 3_600_000;

function rng(seed: number) {
  let value = seed;
  return () => {
    value = (value * 1664525 + 1013904223) % 4294967296;
    return value / 4294967296;
  };
}

export function createDemoState(owner: { name: string; email: string }): CrmState {
  const now = Date.now();
  const ago = (hours: number) => new Date(now - hours * HOUR).toISOString();
  const random = rng(42);
  const pick = <T,>(items: readonly T[]) => items[Math.floor(random() * items.length)];

  const members: Member[] = [
    { id: "me", name: owner.name, email: owner.email, role: "Workspace admin" },
    { id: "m_sarah", name: "Sarah Ahmed", email: "sarah.ahmed@qiko.ai", role: "Account executive" },
    { id: "m_ali", name: "Ali Khan", email: "ali.khan@qiko.ai", role: "Sales development" },
    { id: "m_maya", name: "Maya Patel", email: "maya.patel@qiko.ai", role: "Customer success" },
  ];

  const leads: Lead[] = [];
  const events: ActivityEvent[] = [];
  const scans: Scan[] = [];
  const tasks: Task[] = [];
  let eventId = 0;

  const event = (leadId: string, kind: ActivityEvent["kind"], title: string, hoursAgo: number, source: string, detail?: string, actor?: string) => {
    events.push({ id: `ev_${++eventId}`, leadId, kind, title, detail, occurredAt: ago(hoursAgo), source, actor });
  };

  const lead = (
    id: string,
    data: Omit<Lead, "id" | "nextAction" | "createdAt" | "status" | "source"> & {
      createdHoursAgo: number;
      /** Accepts current or legacy demo statuses/sources; normalised via sales-crm helpers. */
      status: string;
      source: string;
      sector?: string | null;
      serviceInterest?: string | null;
      accountId?: string | null;
      introducedByAssociateId?: string | null;
    },
  ) => {
    const { createdHoursAgo, status, source, ...rest } = data;
    leads.push(
      adaptLeadRecord({
        id,
        ...rest,
        status: normalizeLeadStatus(status),
        source: normalizeLeadSource(source),
        sector: rest.sector ?? null,
        serviceInterest: rest.serviceInterest ?? null,
        accountId: rest.accountId ?? null,
        createdAt: ago(createdHoursAgo),
        nextAction: null,
      }),
    );
  };

  const scan = (leadId: string, website: string, score: number, hoursAgo: number, findings: string[]) => {
    scans.push({ id: `scan_${scans.length + 1}`, leadId, website, score, status: "completed", completedAt: ago(hoursAgo), findings, reportName: `Visibility audit · ${website}` });
    event(leadId, "scan", "Completed a free scan", hoursAgo, "Qiko Signal", `${website} · score ${score}/100`);
  };

  const task = (
    data: Omit<Task, "id" | "history" | "createdAt" | "updatedAt" | "completedAt" | "evidence" | "origin"> & {
      id?: string;
      createdHoursAgo: number;
      completedHoursAgo?: number;
    },
  ) => {
    const { createdHoursAgo, completedHoursAgo, id: customId, ...rest } = data;
    const id = customId ?? `task_${tasks.length + 1}`;
    const history = [{ at: ago(createdHoursAgo), actorId: rest.ownerId ?? "me", action: "Created task" }];
    if (rest.status === "in_progress") history.push({ at: ago(createdHoursAgo - 2), actorId: rest.ownerId ?? "me", action: "Started work" });
    if (completedHoursAgo !== undefined) history.push({ at: ago(completedHoursAgo), actorId: rest.ownerId ?? "me", action: "Marked completed" });
    tasks.push({
      id,
      ...rest,
      origin: "manual",
      evidence: [],
      history,
      createdAt: ago(createdHoursAgo),
      updatedAt: ago(completedHoursAgo ?? createdHoursAgo),
      completedAt: completedHoursAgo !== undefined ? ago(completedHoursAgo) : null,
    });
  };

  // — Five new Qiko Signal registrations awaiting review
  const signalLeads: [string, string, string, string, string, number][] = [
    ["l_amelia", "Amelia Hart", "amelia@northstar.com", "Northstar Retail", "Head of Growth", 3],
    ["l_priya", "Priya Shah", "priya@atlaslabs.ai", "Atlas Labs", "Founder", 7],
    ["l_jonas", "Jonas Weber", "jonas@kettleandco.de", "Kettle & Co", "Marketing Director", 15],
    ["l_sofia", "Sofia Marin", "sofia.marin@brightline.health", "Brightline Health", "COO", 22],
    ["l_daniel", "Daniel Okafor", "daniel@orbitfreight.com", "Orbit Freight", "Operations Lead", 31],
  ];
  for (const [id, name, email, company, role, hours] of signalLeads) {
    lead(id, {
      name,
      email,
      phone: null,
      company,
      role,
      source: "Website",
      status: "New",
      ownerId: "me",
      createdHoursAgo: hours,
      sector: "Retail",
      serviceInterest: "augmentation",
      accountId: id === "l_amelia" ? "acc_northbridge" : null,
    });
    event(id, "enquiry", "Inbound website enquiry", hours, "Website", `Interest registered · ${email}`);
    event(id, "lead_created", "Lead captured for qualification", hours - 1, "Tessiant CRM");
  }
  event("l_amelia", "product", "Connected website domain", 2, "Qiko Signal", "northstar.com");
  event("l_priya", "product", "Invited a teammate", 5, "Qiko Signal");

  // — Three completed free scans with sales potential
  lead("l_liam", { name: "Liam O'Connor", email: "liam@harbour.co", phone: "+44 20 7946 0128", company: "Harbour & Co", role: "Managing Director", source: "Free audit", status: "Contacted", ownerId: "m_sarah", createdHoursAgo: 120 });
  event("l_liam", "enquiry", "Requested a free audit", 120, "Website", "Audit request form");
  event("l_liam", "interaction", "Intro email sent", 96, "Qiko Core", "Email · Shared what the audit covers", "Sarah Ahmed");
  scan("l_liam", "harbour.co", 54, 9, ["Missing structured data on 12 product pages", "Slow mobile load (4.8s LCP)", "No AI-search citations for core services"]);
  event("l_liam", "report", "Downloaded the scan report", 6, "Qiko Signal");

  lead("l_hannah", { name: "Hannah Moore", email: "hannah@fernway.studio", phone: null, company: "Fernway Studios", role: "Creative Director", source: "Qiko Signal", status: "New", ownerId: "me", createdHoursAgo: 80 });
  event("l_hannah", "signup", "Registered on Qiko Signal", 80, "Qiko Signal");
  scan("l_hannah", "fernway.studio", 61, 20, ["Brand mentioned in 2 of 10 AI answers", "Competitors cited 4× more often", "Outdated service descriptions"]);

  lead("l_ravi", { name: "Ravi Mistry", email: "ravi@copperleaf.finance", phone: "+44 161 496 0754", company: "Copperleaf Finance", role: "CMO", source: "Free audit", status: "New", ownerId: "m_ali", createdHoursAgo: 50 });
  event("l_ravi", "enquiry", "Requested a free audit", 50, "Website", "Assessment form");
  scan("l_ravi", "copperleaf.finance", 47, 30, ["Low visibility for 'SME lending' queries", "No FAQ schema", "Thin comparison content"]);
  event("l_ravi", "report", "Opened the scan report twice", 26, "Qiko Signal");

  // — SIA-introduced win: David Okello (SIA) introduced Civic Services' finance director; advisory engagement delivered.
  lead("l_sia_intro", { name: "Rachel Nwosu", email: "rachel.nwosu@civicservices.example", phone: null, company: "Civic Services Partnership", role: "Finance Director", source: "SIA introduction", status: "Converted", ownerId: "m_sarah", createdHoursAgo: 135 * 24, accountId: "acc_civic", serviceInterest: "advisory", sector: "Public sector", introducedByAssociateId: "as_sia_david" });
  event("l_sia_intro", "interaction", "Introduced by David Okello (SIA)", 135 * 24, "Tessiant CRM", "Warm introduction from the SIA network · finance transformation advisory", "Sarah Ahmed");
  event("l_sia_intro", "conversion", "Converted to advisory opportunity", 128 * 24, "Tessiant CRM", "Civic Services finance transformation advisory", "Sarah Ahmed");

  // — Two prospects showing strong engagement
  lead("l_chloe", { name: "Chloe Bennett", email: "chloe@lumenanalytics.io", phone: "+44 20 3868 1190", company: "Lumen Analytics", role: "VP Marketing", source: "Qiko Signal", status: "Qualified", ownerId: "me", createdHoursAgo: 400 });
  event("l_chloe", "signup", "Registered on Qiko Signal", 400, "Qiko Signal");
  scan("l_chloe", "lumenanalytics.io", 72, 300, ["Strong technical SEO", "Weak presence in AI shopping answers"]);
  event("l_chloe", "status_change", "Status changed to Qualified", 200, "Qiko Core", "Contacted → Qualified", "You");
  event("l_chloe", "login", "Logged in to Qiko Signal", 50, "Qiko Signal");
  event("l_chloe", "report", "Exported competitor report", 30, "Qiko Signal");
  event("l_chloe", "product", "Viewed pricing page 3 times", 12, "Website");
  event("l_chloe", "login", "Logged in to Qiko Signal", 4, "Qiko Signal");

  lead("l_omar", { name: "Omar Siddiqui", email: "omar@tidewater.co.uk", phone: null, company: "Tidewater Logistics", role: "Digital Lead", source: "Website", status: "Contacted", ownerId: "m_maya", createdHoursAgo: 260 });
  event("l_omar", "enquiry", "Submitted a contact form", 260, "Website", "\"Interested in monitoring our brand in AI search.\"");
  event("l_omar", "interaction", "Discovery call", 150, "Qiko Core", "Call · 25 min — evaluating three vendors", "Maya Patel");
  event("l_omar", "signup", "Registered on Qiko Signal", 60, "Qiko Signal");
  event("l_omar", "product", "Added 5 tracked competitors", 40, "Qiko Signal");
  event("l_omar", "login", "Logged in to Qiko Signal", 14, "Qiko Signal");
  event("l_omar", "report", "Shared a report with 2 colleagues", 8, "Qiko Signal");

  // — New website enquiry
  lead("l_marcus", { name: "Marcus Chen", email: "marcus@fieldhouse.io", phone: "+44 7700 900461", company: "Fieldhouse", role: "Head of Ops", source: "Website", status: "New", ownerId: "me", createdHoursAgo: 2 });
  event("l_marcus", "enquiry", "Submitted a contact form", 2, "Website", "\"We'd like to make our weekly reporting more efficient — can we talk this week?\"");

  // — Enquiry already being worked
  lead("l_grace", { name: "Grace Turner", email: "grace@pillarlegal.com", phone: "+44 113 496 0222", company: "Pillar Legal", role: "Partner", source: "Website", status: "Contacted", ownerId: "me", createdHoursAgo: 28 });
  event("l_grace", "enquiry", "Submitted an assessment enquiry", 28, "Website", "AI readiness assessment");
  event("l_grace", "interaction", "Left a voicemail", 5, "Qiko Core", "Call · No answer", "You");

  // — Stale qualified lead
  lead("l_ethan", { name: "Ethan Price", email: "ethan@meridianhotels.com", phone: "+44 131 496 0011", company: "Meridian Hotels", role: "Director of Digital", source: "Free audit", status: "Qualified", ownerId: "me", createdHoursAgo: 700 });
  event("l_ethan", "enquiry", "Requested a free audit", 700, "Website");
  scan("l_ethan", "meridianhotels.com", 58, 650, ["Booking pages not indexed", "No AI citations for 'boutique hotel Edinburgh'"]);
  event("l_ethan", "interaction", "Proposal walkthrough", 300, "Qiko Core", "Meeting · Asked for multi-property pricing", "You");

  // — Won, lost and manual leads
  lead("l_noah", { name: "Noah Hughes", email: "noah@greenwayfoods.co", phone: null, company: "Greenway Foods", role: "CEO", source: "Qiko Signal", status: "Won", ownerId: "m_sarah", createdHoursAgo: 900 });
  event("l_noah", "signup", "Registered on Qiko Signal", 900, "Qiko Signal");
  event("l_noah", "status_change", "Status changed to Won", 72, "Qiko Core", "Qualified → Won", "Sarah Ahmed");

  lead("l_zara", { name: "Zara Hussain", email: "zara@halofitness.com", phone: null, company: "Halo Fitness", role: "Owner", source: "Website", status: "Lost", ownerId: "m_ali", createdHoursAgo: 800 });
  event("l_zara", "enquiry", "Submitted a contact form", 800, "Website");
  event("l_zara", "status_change", "Status changed to Lost", 240, "Qiko Core", "Budget moved to next year", "Ali Khan");

  lead("l_felix", {
    name: "Felix Brooks",
    email: "felix@ardenpartners.com",
    phone: "+44 20 7946 0999",
    company: "Crest Consumer Brands",
    role: "Partner / advisor",
    source: "Event",
    status: "Working",
    ownerId: "me",
    createdHoursAgo: 340,
    sector: "Retail",
    serviceInterest: "advisory",
    accountId: "acc_crest",
  });
  event("l_felix", "lead_created", "Lead added manually", 340, "Tessiant CRM", "Met at Retail Tech Summit", "You");
  event("l_felix", "interaction", "Follow-up email", 100, "Tessiant CRM", "Email · Promised a case study", "You");

  // — Broader pipeline history (older leads) so trends and filters have depth
  const firstNames = ["Olivia", "Arjun", "Sophie", "Thomas", "Kwame", "Hannah", "Mateo", "Isla", "Lucas", "Freya", "Ella", "Samuel", "Oscar", "Ruby", "Yusuf", "Maya", "Henry", "Leah", "Tariq", "Evie", "Joel", "Aisha", "Poppy", "Mei", "Imogen", "Rory", "Nadia", "Callum", "Sienna", "Tolu", "George", "Layla", "Jack", "Anya", "Ben", "Clara"];
  const lastNames = ["Pemberton", "Patel", "Walsh", "Haddon", "Darko", "Lloyd", "Ruiz", "Fraser", "Price", "Holland", "Ward", "Ellis", "Hale", "Ashford", "Osman", "Doyle", "Calder", "Collins", "Hamid", "Hart", "Fleming", "Okafor", "Lane", "Chen", "Palmer", "Quinn", "Karim", "Stewart", "Rowe", "Adeyemi", "Banks", "Rahman", "Ellison", "Novak", "Carter", "Dunn"];
  const companies = ["Brightwater", "Kinfolk Coffee", "Vantage Dental", "Northgate Homes", "Larkspur Studio", "Sable Systems", "Oakridge Clinics", "Harbourline", "Mosaic Travel", "Bluebell Bakery", "Crestview Legal", "Ironbridge Tools", "Solace Spa", "Fable Books", "Quayside Motors", "Elmtree Schools", "Pinnacle Gyms", "Saffron Kitchens"];
  const sources = ["Website", "Website", "Website", "Website", "Website", "Referral", "Manual entry"] as const;
  const statuses = ["Working", "Working", "Qualified", "Qualified", "Converted", "Unqualified", "New"] as const;
  const owners = ["me", "m_sarah", "m_ali", "m_maya"];

  for (let index = 0; index < firstNames.length; index += 1) {
    const id = `l_g${index + 1}`;
    const name = `${firstNames[index]} ${lastNames[index]}`;
    const company = companies[index % companies.length];
    const domain = `${company.toLowerCase().replace(/[^a-z]/g, "")}.com`;
    const source = pick(sources);
    const status = pick(statuses);
    const createdHours = 24 * (8 + Math.floor(random() * 80));
    lead(id, { name, email: `${firstNames[index].toLowerCase()}@${domain}`, phone: null, company, role: null, source, status, ownerId: pick(owners), createdHoursAgo: createdHours });
    if (source === "Website") event(id, "enquiry", "Submitted a contact form", createdHours, "Website");
    else if (source === "Referral") event(id, "lead_created", "Referral lead captured", createdHours, "Tessiant CRM");
    else event(id, "lead_created", "Lead added manually", createdHours, "Tessiant CRM", undefined, "You");
    if (source !== "Manual entry" && random() > 0.35) {
      scan(id, domain, 40 + Math.floor(random() * 45), createdHours - 24 - Math.floor(random() * 48), ["Limited AI-search visibility", "Missing structured data"]);
    }
    const logins = Math.floor(random() * 4);
    for (let login = 0; login < logins; login += 1) event(id, "login", "Logged in to Qiko Signal", Math.max(80, createdHours - 30 - Math.floor(random() * createdHours * 0.6)), "Qiko Signal");
    if (status === "Working" || status === "Qualified") {
      event(id, "interaction", pick(["Follow-up call", "Sent case study", "Demo session", "Pricing discussion"]), 24 + Math.floor(random() * 120), "Tessiant CRM", undefined, "You");
    }
  }

  // — Tasks
  const today = toDateKey(new Date());
  task({ title: "Call Grace Turner about her assessment enquiry", description: "Voicemail left this morning. Try again after lunch and offer a 20-minute walkthrough.", status: "in_progress", priority: "high", due: today, ownerId: "me", leadId: "l_grace", createdHoursAgo: 26 });
  task({ title: "Share retail case study with Arden Partners", description: "Promised during the follow-up email.", status: "pending", priority: "medium", due: addDays(-2), ownerId: "me", leadId: "l_felix", createdHoursAgo: 99 });
  task({ title: "Kick-off onboarding call with Greenway Foods", description: "Introduce Maya from Customer Success and agree the first 30-day plan.", status: "pending", priority: "medium", due: addDays(2), ownerId: "m_sarah", leadId: "l_noah", createdHoursAgo: 70 });
  task({ title: "Prepare Q4 pipeline summary", description: "Summarise qualified opportunities for the Monday review.", status: "pending", priority: "low", due: addDays(4), ownerId: "me", leadId: null, createdHoursAgo: 48 });
  task({ title: "Qualify Meridian Hotels opportunity", description: "Confirm budget, timeline and decision makers.", status: "completed", priority: "high", due: addDays(-14), ownerId: "me", leadId: "l_ethan", createdHoursAgo: 360, completedHoursAgo: 300 });
  task({ title: "Discovery call with Greenway Foods", description: "", status: "completed", priority: "high", due: addDays(-6), ownerId: "m_sarah", leadId: "l_noah", createdHoursAgo: 200, completedHoursAgo: 150 });
  task({ title: "Send onboarding guide to Tidewater Logistics", description: "", status: "completed", priority: "medium", due: addDays(-3), ownerId: "m_maya", leadId: "l_omar", createdHoursAgo: 100, completedHoursAgo: 60 });

  events.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));

  // Tessiant staffing follow-ups linked to requirements (requirementId via description prefix for demo)
  task({
    title: "Verify Elena Vos availability for Northbridge",
    description: "[requirement:req_retail] Confirm start date and day-rate before interview.",
    status: "pending",
    priority: "high",
    due: today,
    ownerId: "me",
    leadId: "l_amelia",
    createdHoursAgo: 6,
  });
  task({
    title: "Obtain updated CV pack for SAP shortlist",
    description: "[requirement:req_sap] Safe DEMO CV refs only — no real personal documents.",
    status: "pending",
    priority: "medium",
    due: addDays(1),
    ownerId: "m_sarah",
    leadId: null,
    createdHoursAgo: 20,
  });
  task({
    title: "Send Crest SIA intro follow-up",
    description: "[requirement:req_sia] Potential advisory — do not treat as booked revenue.",
    status: "pending",
    priority: "medium",
    due: addDays(2),
    ownerId: "me",
    leadId: "l_felix",
    createdHoursAgo: 5,
  });

  // Pulse demo journey — accepted insights → to-dos → outcomes (fictional but coherent).
  task({
    id: "task_pulse_rel_crest",
    title: "Assign secondary owner and capture relationship history",
    description:
      "[pulse-insight:ins_rel_acc_crest]\nActive account has a primary relationship owner and no documented secondary owner.\nRecommended: Assign secondary owner and capture relationship history",
    status: "completed",
    priority: "high",
    due: addDays(-1),
    ownerId: "m_sarah",
    leadId: "l_felix",
    createdHoursAgo: 72,
    completedHoursAgo: 18,
  });
  task({
    id: "task_pulse_cross_sia",
    title: "Review possible consulting/advisory opportunity (pipeline only)",
    description:
      "[pulse-insight:ins_crosssell_req_sia]\n[requirement:req_sia]\nSIA interview recorded positive feedback without a confirmed placement.\nRecommended: Review possible consulting/advisory opportunity (pipeline only)",
    status: "in_progress",
    priority: "medium",
    due: addDays(2),
    ownerId: "me",
    leadId: "l_felix",
    createdHoursAgo: 20,
  });

  const contacts: Contact[] = [
    {
      id: "ct_amelia",
      accountId: "acc_northbridge",
      name: "Amelia Hart",
      email: "amelia@northstar.com",
      phone: null,
      role: "Head of Growth / hiring manager",
      ownerId: "me",
      isPrimary: true,
      notes: "Primary contact for retail transformation staffing.",
      createdAt: ago(48),
      updatedAt: ago(4),
    },
    {
      id: "ct_north_proc",
      accountId: "acc_northbridge",
      name: "James Cole",
      email: "james.cole@northbridge.example",
      phone: "+44 20 7000 1100",
      role: "Procurement",
      ownerId: "m_sarah",
      isPrimary: false,
      notes: "Commercial paper and rate cards.",
      createdAt: ago(40 * 24),
      updatedAt: ago(10),
    },
    {
      id: "ct_helix_cio",
      accountId: "acc_helix",
      name: "Priya Nair",
      email: "priya.nair@helix.example",
      phone: null,
      role: "Programme CIO",
      ownerId: "m_sarah",
      isPrimary: true,
      notes: "SAP S/4 capacity decisions.",
      createdAt: ago(72),
      updatedAt: ago(12),
    },
    {
      id: "ct_felix",
      accountId: "acc_crest",
      name: "Felix Brooks",
      email: "felix@ardenpartners.com",
      phone: "+44 20 7946 0999",
      role: "Partner / executive sponsor",
      ownerId: "me",
      isPrimary: true,
      notes: "Founder-heavy relationship — add secondary owner.",
      createdAt: ago(340),
      updatedAt: ago(24),
    },
    {
      id: "ct_civic",
      accountId: "acc_civic",
      name: "Helen Okonkwo",
      email: "helen.okonkwo@civic.example",
      phone: null,
      role: "Change lead",
      ownerId: "m_sarah",
      isPrimary: true,
      notes: "Public-sector expansion prospect.",
      createdAt: ago(96),
      updatedAt: ago(90),
    },
    {
      id: "ct_meridian",
      accountId: "acc_meridian",
      name: "Tomás Ribeiro",
      email: "tomas.ribeiro@meridian-partners.example",
      phone: "+44 20 7000 4411",
      role: "Managing partner / hiring manager",
      ownerId: "m_ali",
      isPrimary: true,
      notes: "Professional-services consulting buyer.",
      createdAt: ago(10 * 24),
      updatedAt: ago(2 * 24),
    },
  ];

  const opportunities: Opportunity[] = [
    {
      id: "opp_northbridge_retail",
      name: "Northbridge retail transformation PM",
      accountId: "acc_northbridge",
      contactId: "ct_amelia",
      leadId: "l_amelia",
      type: "augmentation",
      stage: "Negotiation",
      amount: 185000,
      currency: "GBP",
      probability: 75,
      expectedCloseDate: addDays(14),
      ownerId: "me",
      services: ["Staff augmentation", "Programme leadership"],
      nextStep: "Agree day-rate band and generate staffing requirement",
      agreedContractValue: null,
      expectedBilling: null,
      recognisedRevenue: null,
      lostReason: null,
      source: "Website",
      createdAt: ago(48),
      updatedAt: ago(4),
      closedAt: null,
    },
    {
      id: "opp_helix_sap",
      name: "Helix SAP S/4 architecture capacity",
      accountId: "acc_helix",
      contactId: "ct_helix_cio",
      leadId: null,
      type: "augmentation",
      stage: "Proposal",
      amount: 210000,
      currency: "GBP",
      probability: 50,
      expectedCloseDate: addDays(28),
      ownerId: "m_sarah",
      services: ["SAP architecture"],
      nextStep: "Send proposal pack with scarce-skill premiums",
      agreedContractValue: null,
      expectedBilling: null,
      recognisedRevenue: null,
      lostReason: null,
      source: "Existing client",
      createdAt: ago(72),
      updatedAt: ago(12),
      closedAt: null,
    },
    {
      id: "opp_crest_sia",
      name: "Crest SIA board advisory intro",
      accountId: "acc_crest",
      contactId: "ct_felix",
      leadId: "l_felix",
      type: "advisory",
      stage: "Discovery",
      amount: 48000,
      currency: "GBP",
      probability: 25,
      expectedCloseDate: addDays(45),
      ownerId: "me",
      services: ["Senior Industry Advisors", "Advisory"],
      nextStep: "Chemistry meeting — do not treat as booked revenue",
      agreedContractValue: null,
      expectedBilling: null,
      recognisedRevenue: null,
      lostReason: null,
      source: "Event",
      createdAt: ago(24),
      updatedAt: ago(6),
      closedAt: null,
    },
    {
      id: "opp_northbridge_pmo_won",
      name: "Northbridge retail PMO assignment",
      accountId: "acc_northbridge",
      contactId: "ct_amelia",
      leadId: null,
      type: "augmentation",
      stage: "Closed Won",
      amount: 160000,
      currency: "GBP",
      probability: 100,
      expectedCloseDate: addDays(-60),
      ownerId: "me",
      services: ["Programme leadership"],
      nextStep: "Assignment live — track billing vs recognition",
      agreedContractValue: 160000,
      expectedBilling: 125000,
      recognisedRevenue: 45000,
      lostReason: null,
      source: "Existing client",
      createdAt: ago(90 * 24),
      updatedAt: ago(10),
      closedAt: ago(60 * 24),
    },
    {
      id: "opp_civic_prospect",
      name: "Civic public-sector change team",
      accountId: "acc_civic",
      contactId: "ct_civic",
      leadId: null,
      type: "project team",
      stage: "Qualification",
      amount: 320000,
      currency: "GBP",
      probability: 10,
      expectedCloseDate: addDays(60),
      ownerId: "m_sarah",
      services: ["Public sector expansion", "Change & transformation"],
      nextStep: "Qualify coverage gap vs Tessiant offerings",
      agreedContractValue: null,
      expectedBilling: null,
      recognisedRevenue: null,
      lostReason: null,
      source: "Existing client",
      createdAt: ago(96),
      updatedAt: ago(90),
      closedAt: null,
    },
    {
      id: "opp_greenway_won",
      name: "Greenway Foods consultancy retainer",
      accountId: "acc_crest",
      contactId: null,
      leadId: "l_noah",
      type: "consultancy",
      stage: "Closed Won",
      amount: 72000,
      currency: "GBP",
      probability: 100,
      expectedCloseDate: addDays(-20),
      ownerId: "m_sarah",
      services: ["Consultancy"],
      nextStep: "Onboarding — commercial value tracked separately from staffing",
      agreedContractValue: 72000,
      expectedBilling: 24000,
      recognisedRevenue: 12000,
      lostReason: null,
      source: "Website",
      createdAt: ago(900),
      updatedAt: ago(72),
      closedAt: ago(72),
    },
    {
      id: "opp_meridian_consult",
      name: "Meridian operating-model consultancy",
      accountId: "acc_meridian",
      contactId: "ct_meridian",
      leadId: null,
      type: "consultancy",
      stage: "Proposal",
      amount: 140000,
      currency: "GBP",
      probability: 50,
      expectedCloseDate: addDays(21),
      ownerId: "m_ali",
      services: ["Consultancy", "Staff augmentation"],
      nextStep: "Proposal walkthrough — staffing requirement already open for shortlist",
      agreedContractValue: null,
      expectedBilling: null,
      recognisedRevenue: null,
      lostReason: null,
      source: "Existing client",
      createdAt: ago(5 * 24),
      updatedAt: ago(30),
      closedAt: null,
    },
    {
      id: "opp_meridian_aug",
      name: "Meridian surge augmentation bench",
      accountId: "acc_meridian",
      contactId: "ct_meridian",
      leadId: null,
      type: "augmentation",
      stage: "Qualification",
      amount: 96000,
      currency: "GBP",
      probability: 10,
      expectedCloseDate: addDays(50),
      ownerId: "m_ali",
      services: ["Staff augmentation"],
      nextStep: "Qualify surge headcount vs network availability",
      agreedContractValue: null,
      expectedBilling: null,
      recognisedRevenue: null,
      lostReason: null,
      source: "Existing client",
      createdAt: ago(2 * 24),
      updatedAt: ago(2 * 24),
      closedAt: null,
    },
    {
      id: "opp_civic_sia_won",
      name: "Civic Services finance transformation advisory",
      accountId: "acc_civic",
      contactId: null,
      leadId: "l_sia_intro",
      type: "advisory",
      stage: "Closed Won",
      amount: 42000,
      currency: "GBP",
      probability: 100,
      expectedCloseDate: addDays(-125),
      ownerId: "m_sarah",
      services: ["Senior Industry Advisors", "Advisory"],
      nextStep: "Delivered — SIA-introduced advisory engagement completed",
      agreedContractValue: 42000,
      expectedBilling: 42000,
      recognisedRevenue: 42000,
      lostReason: null,
      source: "SIA introduction",
      createdAt: ago(128 * 24),
      updatedAt: ago(60 * 24),
      closedAt: ago(125 * 24),
    },
  ];

  // Link converted demo leads
  const siaIntro = leads.find((item) => item.id === "l_sia_intro");
  if (siaIntro) {
    siaIntro.status = "Converted";
    siaIntro.convertedOpportunityId = "opp_civic_sia_won";
  }
  const noah = leads.find((item) => item.id === "l_noah");
  if (noah) {
    noah.status = "Converted";
    noah.convertedOpportunityId = "opp_greenway_won";
    noah.serviceInterest = "consultancy";
  }
  const amelia = leads.find((item) => item.id === "l_amelia");
  if (amelia) {
    amelia.status = "Qualified";
    amelia.accountId = "acc_northbridge";
    amelia.serviceInterest = "augmentation";
  }

  return {
    version: DATA_VERSION,
    dataMode: "demo",
    seededAt: new Date(now).toISOString(),
    leads,
    contacts,
    opportunities,
    events,
    scans,
    notes: [
      { id: "note_1", leadId: "l_chloe", body: "Budget approved for Q1. Confirm decision makers before proposal.", authorId: "me", createdAt: ago(90) },
      { id: "note_2", leadId: "l_ethan", body: "Needs multi-site pricing. Decision maker is the CFO (Laura).", authorId: "me", createdAt: ago(299) },
      { id: "note_3", leadId: "l_liam", body: "Prefers email. Interested in programme augmentation support.", authorId: "m_sarah", createdAt: ago(95), accountId: null },
      {
        id: "note_acc_crest",
        leadId: "l_felix",
        accountId: "acc_crest",
        body: "Founder dependency risk — add secondary relationship owner before scale.",
        authorId: "me",
        createdAt: ago(20),
      },
    ],
    messages: demoMessages(ago),
    tasks,
    members,
    decisions: {},
    // A few recorded verdicts so Qiko's track record has a starting score; keys match live priority and signal ids.
    feedback: {
      "priority:dependency-acc_crest": { key: "priority:dependency-acc_crest", context: "priority", verdict: "right", at: ago(26 * 24) },
      "signal:deal-opp_helix_sap": { key: "signal:deal-opp_helix_sap", context: "signal", verdict: "right", at: ago(30 * 24) },
      "signal:reach-req_sap": { key: "signal:reach-req_sap", context: "signal", verdict: "partly", at: ago(52 * 24) },
      "pricing:req_sap": { key: "pricing:req_sap", context: "signal", verdict: "right", at: ago(70 * 24) },
    },
    tessiant: createTessiantSlice(now),
  };
}
