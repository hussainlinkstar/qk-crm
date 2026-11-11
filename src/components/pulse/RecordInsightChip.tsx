"use client";

import InsightCard from "@/components/pulse/InsightCard";
import { contextualInsightForRecord } from "@/lib/pulse-journey";
import { useWorkspaceData } from "@/components/ui/bits";

export default function RecordInsightChip({
  leadId,
  opportunityId,
  accountId,
  requirementId,
}: {
  leadId?: string | null;
  opportunityId?: string | null;
  accountId?: string | null;
  requirementId?: string | null;
}) {
  const { state } = useWorkspaceData();
  if (!state) return null;
  const insight = contextualInsightForRecord(state, { leadId, opportunityId, accountId, requirementId });
  if (!insight) return null;
  return (
    <div style={{ marginBottom: 14 }}>
      <InsightCard insight={insight} compact reviewOnClick />
    </div>
  );
}
