"use client";

import Link from "next/link";
import { useState } from "react";
import { crm } from "@/lib/crm-store";
import { initials } from "@/lib/format";
import type { LeadView } from "@/lib/insights";
import type { Suggestion } from "@/lib/types";
import Button from "@/components/ui/Button";
import Icon from "@/components/ui/Icon";
import { AiChip, EvidenceList, LeadStatusChip, PriorityChip } from "@/components/ui/bits";
import { useWorkspace } from "@/components/shell/WorkspaceContext";
import styles from "./Suggestion.module.css";

export default function SuggestionCard({ suggestion, lead, showLead = true, defaultOpen = false }: { suggestion: Suggestion; lead?: LeadView; showLead?: boolean; defaultOpen?: boolean }) {
  const { openTaskForm, toast } = useWorkspace();
  const [open, setOpen] = useState(defaultOpen);
  const facts = suggestion.evidence.filter((item) => item.kind === "fact").length;

  return (
    <article className={styles.card}>
      <div className={styles.top}>
        {showLead && lead && (
          <Link href={`/sales/leads/${lead.id}`} className={styles.lead}>
            <span className="avatar avatar-sm">{initials(lead.name)}</span>
            <span>
              <b>{lead.name}</b>
              {lead.company && <small>{lead.company}</small>}
            </span>
            <LeadStatusChip status={lead.status} />
          </Link>
        )}
        <div className={styles.chips}>
          <AiChip />
          <PriorityChip priority={suggestion.priority} />
        </div>
      </div>
      <h3 className={styles.title}>{suggestion.title}</h3>
      <p className={styles.reason}>{suggestion.reason}</p>
      <button type="button" className={styles.toggle} onClick={() => setOpen((value) => !value)} aria-expanded={open}>
        <Icon name="chevronDown" size={14} className={open ? styles.rotated : ""} />
        {open ? "Hide evidence" : `Show evidence · ${facts} confirmed ${facts === 1 ? "fact" : "facts"}`}
      </button>
      {open && <EvidenceList items={suggestion.evidence} compact />}
      <div className={styles.actions}>
        <Button
          size="small"
          icon="check"
          onClick={() => {
            crm.acceptSuggestion(suggestion);
            toast("Suggestion accepted — task created");
          }}
        >
          Accept
        </Button>
        <Button
          size="small"
          variant="secondary"
          icon="edit"
          onClick={() =>
            openTaskForm({
              title: "Edit before accepting",
              origin: "suggestion",
              evidence: suggestion.evidence,
              initial: { title: suggestion.title, description: suggestion.reason, priority: suggestion.priority, due: suggestion.suggestedDue, leadId: suggestion.leadId, ownerId: lead?.ownerId ?? "me" },
              onCreated: () => crm.dismissSuggestion(suggestion.id),
            })
          }
        >
          Edit
        </Button>
        <Button
          size="small"
          variant="ghost"
          icon="checkCircle"
          onClick={() => {
            crm.completeSuggestion(suggestion);
            toast("Marked as done");
          }}
        >
          Done
        </Button>
        <Button
          size="small"
          variant="ghost"
          icon="x"
          className={styles.dismiss}
          onClick={() => {
            crm.dismissSuggestion(suggestion.id);
            toast("Suggestion dismissed", "info");
          }}
        >
          Dismiss
        </Button>
      </div>
    </article>
  );
}
