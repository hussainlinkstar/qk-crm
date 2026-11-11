"use client";

import { Suspense } from "react";
import { SkeletonRows } from "@/components/ui/bits";
import { ActionWorkspace } from "@/components/tasks/ActionWorkspace";

export default function MyTasksPage() {
  return (
    <Suspense
      fallback={
        <div className="page">
          <SkeletonRows rows={6} height={70} />
        </div>
      }
    >
      <ActionWorkspace title="My Tasks" subtitle="Board-first task management." defaultOwnerMine />
    </Suspense>
  );
}
