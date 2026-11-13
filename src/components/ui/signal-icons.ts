import type { IconName } from "./Icon";
import type { IconTone } from "./IconTile";

/** Icon and tone for an insight kind label, so the same signal looks the same on every page. */
export function signalVisual(kind: string): { icon: IconName; tone: IconTone } {
  const key = kind.trim().toLowerCase();
  const table: Array<[RegExp, IconName, IconTone]> = [
    [/coverage gap|no coverage|^coverage$/, "shield", "danger"],
    [/relationship coverage|single stakeholder|no primary/, "users", "warning"],
    [/closing|due today|starts soon|starting soon|ending soon|engagement ending/, "calendar", "info"],
    [/advisory|sia/, "star", "qiko"],
    [/expansion/, "trendUp", "success"],
    [/network/, "handshake", "qiko"],
    [/hiring signal/, "trendUp", "success"],
    [/rate benchmark/, "coins", "warning"],
    [/bench risk/, "clock", "warning"],
    [/overdue|start date passed|conflict/, "alert", "danger"],
    [/quiet|stalled/, "clock", "warning"],
    [/unassigned/, "userPlus", "warning"],
    [/renewal/, "refresh", "warning"],
    [/verify|re-engage|last meaningful/, "userCheck", "info"],
    [/match|delivery/, "target", "qiko"],
  ];
  for (const [pattern, icon, tone] of table) {
    if (pattern.test(key)) return { icon, tone };
  }
  return { icon: "sparkles", tone: "qiko" };
}
