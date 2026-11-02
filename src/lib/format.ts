const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export function timeAgo(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return "—";
  const diff = now - new Date(iso).getTime();
  if (diff < MINUTE) return "Just now";
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)} min ago`;
  if (diff < DAY) return `${Math.floor(diff / HOUR)}h ago`;
  if (diff < 2 * DAY) return "Yesterday";
  if (diff < 7 * DAY) return `${Math.floor(diff / DAY)} days ago`;
  return formatDate(iso);
}

export function formatDate(iso: string | null | undefined, withYear = false): string {
  if (!iso) return "—";
  const date = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(`${iso}T00:00:00`) : new Date(iso);
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", ...(withYear ? { year: "numeric" } : {}) });
}

export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  return `${formatDate(iso, true)} · ${date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`;
}

export function toDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function todayKey(): string {
  return toDateKey(new Date());
}

export function addDays(days: number, from = new Date()): string {
  const date = new Date(from);
  date.setDate(date.getDate() + days);
  return toDateKey(date);
}

export function dueLabel(due: string | null, status: TaskStatus): { text: string; tone: "overdue" | "today" | "soon" | "later" | "none" } {
  if (!due) return { text: "No due date", tone: "none" };
  if (status !== "pending" && status !== "in_progress") return { text: formatDate(due), tone: "later" };
  const today = todayKey();
  if (due < today) return { text: `Overdue · ${formatDate(due)}`, tone: "overdue" };
  if (due === today) return { text: "Due today", tone: "today" };
  if (due === addDays(1)) return { text: "Due tomorrow", tone: "soon" };
  return { text: `Due ${formatDate(due)}`, tone: "later" };
}

export function initials(name: string | null | undefined): string {
  if (!name) return "?";
  return name.split(/\s+/).filter(Boolean).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
}

export function greeting(date = new Date()): string {
  const hour = date.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export function firstName(name: string): string {
  return name.split(/\s+/)[0] ?? name;
}

export function uid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;
}

export function plural(count: number, one: string, many = `${one}s`): string {
  return `${count} ${count === 1 ? one : many}`;
}
import type { TaskStatus } from "./types";
