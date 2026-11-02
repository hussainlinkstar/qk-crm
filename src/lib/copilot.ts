// Ask Qiko — grounded copilot over CRM data. Every answer is built only from workspace records:
// facts are marked "fact", recommendations "inference", and executions require user confirmation.
// The `answerQuestion` signature is the seam for a future LLM / Qiko Pulse backend.

import type { CopilotAnswer, CrmState, Evidence, Execution } from "./types";
import { buildWorkspace, isOpen, sortTasks, type LeadView } from "./insights";
import { addDays, formatDate, plural, timeAgo, todayKey, uid } from "./format";

const DAY = 86_400_000;

export const SUGGESTED_QUESTIONS = [
  "What happened in sales today?",
  "Who signed up on Signal this week?",
  "Show me users who completed a free scan",
  "Which leads should I follow up with first?",
  "What actions are pending?",
];

function answer(question: string, data: Omit<CopilotAnswer, "id" | "question" | "at" | "grounded"> & { grounded?: boolean }): CopilotAnswer {
  return { id: uid("ans"), question, at: new Date().toISOString(), grounded: data.grounded ?? true, ...data };
}

function leadFact(lead: LeadView, label?: string): Evidence {
  return {
    label: label ?? `${lead.name}${lead.company ? ` · ${lead.company}` : ""}`,
    detail: lead.lastActivity ? `${lead.lastActivity.title} · ${timeAgo(lead.lastActivity.occurredAt)}` : `Status ${lead.status}`,
    at: lead.lastActivity?.occurredAt,
    source: lead.lastActivity?.source ?? "Qiko Core",
    kind: "fact",
  };
}

function findLead(question: string, leads: LeadView[], contextLeadId?: string | null): LeadView | null {
  const text = question.toLowerCase();
  const byName = leads.find((lead) => text.includes(lead.name.toLowerCase()))
    ?? leads.find((lead) => lead.company && text.includes(lead.company.toLowerCase()))
    ?? leads.find((lead) => lead.name.split(" ").some((part) => part.length > 3 && new RegExp(`\\b${part.toLowerCase()}\\b`).test(text)));
  if (byName) return byName;
  if (contextLeadId && /\b(this|the|current)\s+(prospect|lead|customer|contact)\b|\bthem\b|\bthey\b/.test(text)) return leads.find((lead) => lead.id === contextLeadId) ?? null;
  return null;
}

export function answerQuestion(state: CrmState, question: string, contextLeadId?: string | null, now = Date.now()): CopilotAnswer {
  const workspace = buildWorkspace(state, now);
  const text = question.toLowerCase().trim();
  const leads = workspace.leads;
  const memberName = (id: string | null) => (id ? state.members.find((member) => member.id === id)?.name ?? "Unassigned" : "Unassigned");

  // — A specific prospect
  const lead = /everything|about|tell me|profile|who is|summar|know/.test(text) || contextLeadId ? findLead(question, leads, contextLeadId) : findLead(question, leads);
  if (lead && !/pending|follow up with first|signed up|free scan/.test(text)) {
    const events = workspace.byLead.get(lead.id) ?? [];
    const scans = state.scans.filter((scan) => scan.leadId === lead.id);
    const notes = state.notes.filter((note) => note.leadId === lead.id);
    const suggestion = workspace.suggestions.find((item) => item.leadId === lead.id);
    const executions: Execution[] = [{ type: "open", label: "Open lead profile", href: `/sales/leads/${lead.id}` }];
    if (suggestion) executions.unshift({ type: "create_task", label: "Create follow-up task", task: { title: suggestion.title, description: suggestion.reason, leadId: lead.id, priority: suggestion.priority, due: suggestion.suggestedDue } });
    else if (!lead.openTasks.length && lead.status !== "Won" && lead.status !== "Lost") executions.unshift({ type: "create_task", label: "Create follow-up task", task: { title: `Follow up with ${lead.name}`, description: "", leadId: lead.id, priority: "medium", due: addDays(1) } });
    if (lead.status === "New") executions.push({ type: "update_status", label: "Mark as Contacted", leadId: lead.id, status: "Contacted" });
    if (lead.status === "Contacted" && lead.engagementScore >= 50) executions.push({ type: "update_status", label: "Mark as Qualified", leadId: lead.id, status: "Qualified" });
    return answer(question, {
      answer: `${lead.name}${lead.role ? `, ${lead.role}` : ""}${lead.company ? ` at ${lead.company}` : ""} is a ${lead.status.toLowerCase()} lead from ${lead.source}, owned by ${memberName(lead.ownerId)}. We have ${plural(events.length, "recorded activity", "recorded activities")}, ${plural(scans.length, "scan")} and ${plural(notes.length, "note")}${lead.openTasks.length ? `, plus ${plural(lead.openTasks.length, "open task")}` : ""}.`,
      evidence: [
        ...events.slice(0, 4).map((event): Evidence => ({ label: event.title, detail: event.detail, at: event.occurredAt, source: event.source, kind: "fact" })),
        ...scans.slice(0, 1).map((scan): Evidence => ({ label: `Scan of ${scan.website}: ${scan.score}/100`, detail: scan.findings.join("; "), at: scan.completedAt, source: "Qiko Signal", kind: "fact" })),
        ...notes.slice(0, 1).map((note): Evidence => ({ label: "Latest note", detail: note.body, at: note.createdAt, source: "Qiko Core", kind: "fact" })),
      ],
      recommendation: suggestion ? `${suggestion.title}. ${suggestion.reason}` : lead.openTasks[0] ? `Finish the open task "${lead.openTasks[0].title}".` : lead.status === "Won" || lead.status === "Lost" ? "No sales action needed." : "Schedule a follow-up to keep momentum.",
      executions,
    });
  }

  // — Today
  if (/today|happened|latest|recent|update/.test(text) && !/pending|task|action/.test(text)) {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    let window = "today";
    let events = state.events.filter((event) => new Date(event.occurredAt) >= start);
    if (!events.length) {
      window = "in the last 24 hours";
      events = state.events.filter((event) => now - new Date(event.occurredAt).getTime() <= DAY);
    }
    const count = (kind: string) => events.filter((event) => event.kind === kind).length;
    const parts = [
      count("signup") && plural(count("signup"), "Signal sign-up"),
      count("scan") && plural(count("scan"), "free scan"),
      count("enquiry") && plural(count("enquiry"), "enquiry", "enquiries"),
      count("login") + count("product") + count("report") && plural(count("login") + count("product") + count("report"), "product interaction"),
    ].filter(Boolean);
    const completed = state.tasks.filter((task) => task.completedAt && new Date(task.completedAt) >= start).length;
    return answer(question, {
      answer: events.length ? `${window[0].toUpperCase()}${window.slice(1)} there ${events.length === 1 ? "was" : "were"} ${plural(events.length, "recorded event")}: ${parts.join(", ") || "CRM updates only"}.${completed ? ` ${plural(completed, "task")} completed.` : ""} ${plural(workspace.suggestions.length, "suggested action")} ${workspace.suggestions.length === 1 ? "is" : "are"} waiting for review.` : "No sales activity has been recorded in the last 24 hours.",
      evidence: events.slice(0, 6).map((event): Evidence => ({ label: `${workspace.leadById.get(event.leadId)?.name ?? "Unknown lead"} — ${event.title}`, detail: event.detail, at: event.occurredAt, source: event.source, kind: "fact" })),
      recommendation: workspace.suggestions[0] ? `Start with: ${workspace.suggestions[0].title}.` : null,
      executions: [
        ...(workspace.suggestions[0] ? [{ type: "create_task", label: "Create task for top suggestion", task: { title: workspace.suggestions[0].title, description: workspace.suggestions[0].reason, leadId: workspace.suggestions[0].leadId, priority: workspace.suggestions[0].priority, due: workspace.suggestions[0].suggestedDue } } as Execution] : []),
        { type: "open", label: "Open Sales overview", href: "/sales" },
      ],
    });
  }

  // — Sign-ups
  if (/sign(ed)?[\s-]?up|regist|signal/.test(text)) {
    const days = /month|30/.test(text) ? 30 : /today/.test(text) ? 1 : 7;
    const signups = state.events.filter((event) => event.kind === "signup" && now - new Date(event.occurredAt).getTime() <= days * DAY);
    const people = signups.map((event) => workspace.leadById.get(event.leadId)).filter((item): item is LeadView => Boolean(item));
    const uncontacted = people.filter((person) => person.status === "New");
    return answer(question, {
      answer: people.length ? `${plural(people.length, "person", "people")} signed up on Qiko Signal in the last ${days === 1 ? "day" : `${days} days`}${uncontacted.length ? `; ${uncontacted.length} ${uncontacted.length === 1 ? "has" : "have"} not been contacted yet` : ""}.` : `Nobody signed up on Qiko Signal in the last ${days} days.`,
      evidence: people.map((person) => leadFact(person, `${person.name}${person.company ? ` · ${person.company}` : ""} — ${person.status}`)),
      recommendation: uncontacted.length ? `Review ${uncontacted.map((person) => person.name.split(" ")[0]).slice(0, 3).join(", ")}${uncontacted.length > 3 ? " and others" : ""} today while interest is fresh.` : null,
      executions: [
        ...(uncontacted[0] ? [{ type: "create_task", label: `Create review task for ${uncontacted[0].name}`, task: { title: `Review new Signal lead ${uncontacted[0].name}`, description: "New Qiko Signal registration awaiting first contact.", leadId: uncontacted[0].id, priority: "high", due: todayKey() } } as Execution] : []),
        { type: "open", label: "View Signal leads", href: "/sales/leads?source=Qiko%20Signal" },
      ],
    });
  }

  // — Free scans
  if (/scan|audit/.test(text)) {
    const scans = [...state.scans].sort((a, b) => b.completedAt.localeCompare(a.completedAt));
    const recent = scans.filter((scan) => now - new Date(scan.completedAt).getTime() <= 7 * DAY);
    const list = (recent.length ? recent : scans).slice(0, 8);
    const lowest = [...list].sort((a, b) => a.score - b.score)[0];
    const lowestLead = lowest ? workspace.leadById.get(lowest.leadId) : undefined;
    return answer(question, {
      answer: `${plural(scans.length, "free scan")} have been completed in total, ${recent.length} in the last 7 days.${lowestLead ? ` The weakest recent result is ${lowestLead.name}'s ${lowest.website} at ${lowest.score}/100.` : ""}`,
      evidence: list.map((scan): Evidence => {
        const owner = workspace.leadById.get(scan.leadId);
        return { label: `${owner?.name ?? "Unknown"} — ${scan.website} · ${scan.score}/100`, detail: scan.findings.slice(0, 2).join("; "), at: scan.completedAt, source: "Qiko Signal", kind: "fact" };
      }),
      recommendation: lowestLead ? `Low scores are the clearest sales opening — walk ${lowestLead.name} through the findings.` : null,
      executions: [
        ...(lowestLead ? [{ type: "create_task", label: `Review ${lowestLead.name}'s scan`, task: { title: `Review ${lowestLead.name}'s scan results and follow up`, description: `Scan of ${lowest.website} scored ${lowest.score}/100.`, leadId: lowestLead.id, priority: "high", due: todayKey() } } as Execution] : []),
        { type: "open", label: "View leads with scans", href: "/sales/leads?activity=scan" },
      ],
    });
  }

  // — Who to follow up with first
  if (/follow[\s-]?up|first|priorit|focus|who should|hot|best/.test(text)) {
    const ranked = workspace.suggestions.slice(0, 5);
    return answer(question, {
      answer: ranked.length ? `Here are the ${ranked.length} leads I'd prioritise, ranked by urgency and supporting evidence. ${ranked[0] ? `Start with ${workspace.leadById.get(ranked[0].leadId)?.name}.` : ""}` : "There are no outstanding follow-up suggestions — every active lead has an open task or recent contact.",
      evidence: ranked.flatMap((item) => [{ label: item.title, detail: item.reason, source: "Qiko Core", kind: "inference" as const }, ...item.evidence.filter((entry) => entry.kind === "fact").slice(0, 1)]),
      recommendation: ranked[0] ? `${ranked[0].title}.` : null,
      executions: [
        ...ranked.slice(0, 2).map((item): Execution => ({ type: "create_task", label: `Create task: ${workspace.leadById.get(item.leadId)?.name}`, task: { title: item.title, description: item.reason, leadId: item.leadId, priority: item.priority, due: item.suggestedDue } })),
        { type: "open", label: "Open action workspace", href: "/sales/actions" },
      ],
    });
  }

  // — Pending actions
  if (/pending|action|task|to[\s-]?do|overdue|due/.test(text)) {
    const open = sortTasks(state.tasks.filter(isOpen));
    const today = todayKey();
    const overdue = open.filter((task) => task.due && task.due < today);
    return answer(question, {
      answer: open.length ? `You have ${plural(open.length, "open task")} (${open.filter((task) => task.status === "in_progress").length} in progress)${overdue.length ? `, ${overdue.length} overdue` : ""}, plus ${plural(workspace.suggestions.length, "suggested action")} to review.` : "No open tasks right now.",
      evidence: open.slice(0, 6).map((task): Evidence => ({ label: task.title, detail: `${task.priority} priority · ${task.due ? `due ${formatDate(task.due)}` : "no due date"} · ${memberName(task.ownerId)}`, at: task.createdAt, source: "Qiko Core", kind: "fact" })),
      recommendation: overdue[0] ? `Clear the overdue task first: "${overdue[0].title}".` : open[0] ? `Next up: "${open[0].title}".` : null,
      executions: [{ type: "open", label: "Open action workspace", href: "/sales/actions" }],
    });
  }

  // — Pipeline / opportunities
  if (/pipeline|opportunit|qualified|won|lost|conversion/.test(text)) {
    const byStatus = (status: string) => leads.filter((item) => item.status === status);
    const qualified = byStatus("Qualified");
    return answer(question, {
      answer: `The pipeline has ${plural(qualified.length, "qualified opportunity", "qualified opportunities")}, ${byStatus("Contacted").length} contacted and ${byStatus("New").length} new leads. ${byStatus("Won").length} won and ${byStatus("Lost").length} lost to date.`,
      evidence: qualified.slice(0, 6).map((item) => leadFact(item)),
      recommendation: qualified[0] ? `Keep qualified deals moving — ${qualified.filter((item) => !item.openTasks.length).length} have no open task.` : null,
      executions: [{ type: "open", label: "View qualified leads", href: "/sales/leads?status=Qualified" }],
    });
  }

  return answer(question, {
    answer: "I can only answer from your Qiko Core workspace data, and I couldn't match that question to it. Try asking about sign-ups, scans, follow-ups, pending actions, the pipeline, or a specific lead by name.",
    evidence: [],
    recommendation: null,
    executions: [],
    grounded: false,
  });
}
