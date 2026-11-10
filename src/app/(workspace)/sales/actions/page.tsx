"use client";

import { Suspense } from "react";
import { SkeletonRows } from "@/components/ui/bits";
import { ActionWorkspace } from "@/components/tasks/ActionWorkspace";

export default function SalesActivitiesPage() {
  return (
    <Suspense
      fallback={
        <div className="page">
          <SkeletonRows rows={6} height={70} />
        </div>
      }
    >
      <ActionWorkspace
        title="Sales activities"
        subtitle="Follow-ups for leads, accounts and opportunities."
        askPrompt="What sales activities are pending?"
        scope="sales"
      />
    </Suspense>
  );
}
