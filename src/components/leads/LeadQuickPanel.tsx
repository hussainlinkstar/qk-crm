"use client";

import Link from "next/link";
import Select from "@/components/ui/Select";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { crm } from "@/lib/crm-store";
import { addDays, formatDate, initials } from "@/lib/format";
import { LEAD_STATUSES, type ConversationChannel, type LeadStatus } from "@/lib/types";
import Button from "@/components/ui/Button";
import Icon from "@/components/ui/Icon";
import { Drawer } from "@/components/ui/Overlay";
import { useWorkspaceData } from "@/components/ui/bits";
import RecordInsightChip from "@/components/pulse/RecordInsightChip";
import { useWorkspace } from "@/components/shell/WorkspaceContext";
import LogInteractionModal from "./LogInteractionModal";
import ComposeMessageModal from "./ComposeMessageModal";
import styles from "./Leads.module.css";

const JOURNEY: LeadStatus[] = ["New", "Working", "Qualified", "Converted"];

export default function LeadQuickPanel({ leadId, onClose }: { leadId: string; onClose: () => void }) {
  const router = useRouter();
  const { state, workspace } = useWorkspaceData();
  const { openTaskForm, askQiko, toast } = useWorkspace();
  const [logOpen, setLogOpen] = useState(false);
  const [compose, setCompose] = useState<ConversationChannel | null>(null);
  if (!state || !workspace) return null;
  const lead = workspace.leadById.get(leadId);
  if (!lead) return null;

  const journeyIndex = JOURNEY.indexOf(lead.status === "Unqualified" ? "New" : lead.status);
  const accounts = state.tessiant?.accounts ?? [];

  const advanceStatus = (status: LeadStatus) => {
    if (lead.status === status) return;
    crm.updateLead(lead.id, { status });
    toast(`Status → ${status}`);
  };

  const convert = () => {
    const accountId = lead.accountId ?? accounts[0]?.id;
    if (!accountId) {
      toast("Create an account before converting", "error");
      return;
    }
    const result = crm.convertLead(lead.id, {
      accountId,
      opportunityName: `${lead.company ?? lead.name} · ${lead.serviceInterest ?? "engagement"}`,
      opportunityType: (lead.serviceInterest as "augmentation" | "advisory" | "consultancy" | "project team" | "mixed") || "augmentation",
      amount: 120000,
      services: lead.serviceInterest ? [lead.serviceInterest] : ["Staff augmentation"],
    });
    if (!result.ok) {
      toast(result.error, "error");
      return;
    }
    toast("Lead converted to contact + opportunity", "success");
    onClose();
    router.push(`/sales/accounts/${accountId}`);
  };

  return (
    <Drawer
      kicker="Lead"
      title={
        <span className={styles.panelTitle}>
          <span className="avatar">{initials(lead.name)}</span>
          <span>
            {lead.name}
            <small>{lead.role ? `${lead.role} · ` : ""}{lead.company ?? "No company"}</small>
          </span>
        </span>
      }
      onClose={onClose}
      width={540}
      footer={
        <Link href={`/sales/leads/${lead.id}`} className={styles.fullProfile} onClick={onClose}>
          Open full profile <Icon name="arrowRight" size={14} />
        </Link>
      }
    >
      <RecordInsightChip leadId={lead.id} accountId={lead.accountId} />

      <div className={styles.panelControls}>
        <label>
          <span>Status</span>
          <Select
            className={`${styles.panelSelect} ${
              {
                New: styles.toneNew,
                Working: styles.toneWorking,
                Qualified: styles.toneQualified,
                Unqualified: styles.toneUnqualified,
                Converted: styles.toneConverted,
              }[lead.status]
            }`}
            value={lead.status}
            aria-label="Lead status"
            disabled={lead.status === "Converted"}
            onChange={(event) => {
              const next = event.target.value as LeadStatus;
              if (next === "Converted") {
                convert();
                return;
              }
              advanceStatus(next);
            }}
          >
            {LEAD_STATUSES.map((status) => (
              <option key={status} disabled={status === "Converted" && lead.status !== "Qualified" && lead.status !== "Converted"}>
                {status}
              </option>
            ))}
          </Select>
        </label>
        <label>
          <span>Owner</span>
          <Select
            className={styles.panelSelect}
            value={lead.ownerId ?? ""}
            aria-label="Update lead owner"
            disabled={lead.status === "Converted"}
            onChange={(event) => {
              const ownerId = event.target.value || null;
              crm.updateLead(lead.id, { ownerId });
              toast(ownerId ? `Owner → ${state.members.find((member) => member.id === ownerId)?.name ?? "Assigned"}` : "Owner cleared");
            }}
          >
            <option value="">Unassigned</option>
            {state.members.map((member) => (
              <option key={member.id} value={member.id}>
                {member.id === "me" ? "Me" : member.name}
              </option>
            ))}
          </Select>
        </label>
      </div>
      <p className={styles.panelSource}>Source · {lead.source}</p>

      <section className={styles.journey} aria-label="Qualification journey">
        <div className={styles.journeyTrack}>
          {JOURNEY.map((step, index) => {
            const done = journeyIndex >= 0 && index <= journeyIndex;
            const current = lead.status === step;
            return (
              <button
                key={step}
                type="button"
                className={`${styles.journeyStep} ${done ? styles.journeyDone : ""} ${current ? styles.journeyCurrent : ""}`}
                disabled={lead.status === "Converted" || step === "Converted"}
                onClick={() => advanceStatus(step)}
              >
                <span className={styles.journeyDot} />
                {step}
              </button>
            );
          })}
        </div>
        {lead.status !== "Converted" && lead.status !== "Unqualified" && (
          <div className={styles.journeyActions}>
            {lead.status !== "Qualified" && (
              <Button size="small" variant="secondary" onClick={() => advanceStatus("Qualified")}>
                Mark qualified
              </Button>
            )}
            {lead.status === "Qualified" && accounts.length > 0 && (
              <Button size="small" icon="arrowRight" onClick={convert}>
                Convert to opportunity
              </Button>
            )}
            <Button size="small" variant="ghost" onClick={() => advanceStatus("Unqualified")}>
              Mark unqualified
            </Button>
          </div>
        )}
        {lead.status === "Converted" && lead.convertedOpportunityId && (
          <p className={styles.journeyDoneNote}>
            Converted.{" "}
            <Link href="/sales/pipeline" onClick={onClose}>
              Open opportunities
            </Link>
          </p>
        )}
      </section>

      <div className={styles.quickActions}>
        <Button size="small" icon="plus" onClick={() => openTaskForm({ initial: { title: `Follow up with ${lead.name}`, leadId: lead.id, ownerId: lead.ownerId ?? "me", due: addDays(1) } })}>Task</Button>
        <Button size="small" variant="secondary" icon="phone" onClick={() => setLogOpen(true)}>Log interaction</Button>
        <Button size="small" variant="secondary" icon="mail" onClick={() => setCompose("email")}>Email</Button>
        <Button size="small" variant="secondary" icon="whatsapp" onClick={() => setCompose("whatsapp")}>WhatsApp</Button>
        <Button size="small" variant="soft" icon="sparkles" onClick={() => askQiko(`Tell me everything about ${lead.name}`, lead.id)}>Ask Qiko</Button>
      </div>

      <dl className={styles.facts}>
        <div><dt>Email</dt><dd>{lead.email}</dd></div>
        <div><dt>Phone</dt><dd>{lead.phone ?? "—"}</dd></div>
        <div><dt>Added</dt><dd>{formatDate(lead.createdAt, true)}</dd></div>
        <div><dt>Next</dt><dd>{lead.nextActionLabel}</dd></div>
      </dl>

      {logOpen && <LogInteractionModal leadId={lead.id} leadName={lead.name} onClose={() => setLogOpen(false)} />}
      {compose && (
        <ComposeMessageModal
          channel={compose}
          leadId={lead.id}
          leadName={lead.name}
          address={compose === "email" ? lead.email : lead.phone ?? ""}
          onClose={() => setCompose(null)}
        />
      )}
    </Drawer>
  );
}
