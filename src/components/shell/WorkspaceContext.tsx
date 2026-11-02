"use client";

import { createContext, useContext } from "react";
import type { TaskInput } from "@/lib/crm-store";
import type { Evidence, Session, Task } from "@/lib/types";

export interface TaskFormRequest {
  initial?: Partial<TaskInput>;
  evidence?: Evidence[];
  origin?: Task["origin"];
  onCreated?: (taskId: string) => void;
  title?: string;
}

export interface WorkspaceApi {
  session: Session;
  toast: (message: string, tone?: "success" | "info" | "error") => void;
  askQiko: (question?: string, leadId?: string | null) => void;
  openTaskForm: (request?: TaskFormRequest) => void;
  openTask: (taskId: string) => void;
  openAddLead: () => void;
}

export const WorkspaceContext = createContext<WorkspaceApi | null>(null);

export function useWorkspace(): WorkspaceApi {
  const value = useContext(WorkspaceContext);
  if (!value) throw new Error("useWorkspace must be used inside the workspace shell");
  return value;
}
