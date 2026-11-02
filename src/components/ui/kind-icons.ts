import type { ActivityKind } from "@/lib/types";
import type { IconName } from "./Icon";

export const KIND_ICON: Record<ActivityKind, IconName> = {
  signup: "userPlus",
  login: "login",
  scan: "scan",
  report: "file",
  enquiry: "message",
  product: "zap",
  lead_created: "plus",
  status_change: "flag",
  owner_change: "users",
  note: "note",
  interaction: "phone",
  task: "tasks",
};
