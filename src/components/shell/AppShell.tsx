"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { signOut, useSession } from "@/lib/crm-store";
import { buildPriorities, isOpen, salesAttentionCount } from "@/lib/insights";
import { initials, todayKey, uid } from "@/lib/format";
import Icon, { type IconName } from "@/components/ui/Icon";
import { useWorkspaceData } from "@/components/ui/bits";
import { ConfirmDialog } from "@/components/ui/Overlay";
import CopilotPanel from "@/components/copilot/CopilotPanel";
import TaskFormModal from "@/components/tasks/TaskFormModal";
import TaskDrawer from "@/components/tasks/TaskDrawer";
import AddLeadModal from "@/components/leads/AddLeadModal";
import PulseNavigation from "@/components/pulse/PulseNavigation";
import { WorkspaceContext, type TaskFormRequest, type WorkspaceApi } from "./WorkspaceContext";
import styles from "./AppShell.module.css";

interface NavChild {
  href: string;
  label: string;
  match: (path: string) => boolean;
}

interface NavItem {
  href: string;
  label: string;
  icon: IconName;
  match: (path: string) => boolean;
  children?: NavChild[];
}

/** Tessiant workspace IA — Accounts live under Sales only (same entities as staffing clients). */
const NAV: NavItem[] = [
  {
    href: "/",
    label: "Home",
    icon: "home",
    match: (path) => path === "/" || path.startsWith("/tasks"),
    children: [
      { href: "/", label: "Home", match: (path) => path === "/" },
      { href: "/tasks", label: "My Tasks", match: (path) => path.startsWith("/tasks") },
    ],
  },
  {
    href: "/sales",
    label: "Sales",
    icon: "sales",
    match: (path) => path.startsWith("/sales"),
    children: [
      { href: "/sales/leads", label: "Leads", match: (path) => path.startsWith("/sales/leads") },
      { href: "/sales/pipeline", label: "Opportunities", match: (path) => path.startsWith("/sales/pipeline") },
      { href: "/sales/accounts", label: "Accounts", match: (path) => path.startsWith("/sales/accounts") },
      { href: "/sales/contacts", label: "Contacts", match: (path) => path.startsWith("/sales/contacts") },
      { href: "/sales/actions", label: "Activities", match: (path) => path.startsWith("/sales/actions") },
    ],
  },
  {
    href: "/staffing",
    label: "Staffing",
    icon: "users",
    match: (path) => path.startsWith("/staffing"),
    children: [
      { href: "/staffing", label: "Staffing Overview", match: (path) => path === "/staffing" },
      { href: "/staffing/associates", label: "Talent Network", match: (path) => path.startsWith("/staffing/associates") },
      { href: "/staffing/requirements", label: "Client Requirements", match: (path) => path.startsWith("/staffing/requirements") },
      { href: "/staffing/placements", label: "Assignments", match: (path) => path.startsWith("/staffing/placements") },
    ],
  },
];

function pageTitle(pathname: string): string {
  if (pathname === "/") return "Home";
  if (pathname.startsWith("/tasks")) return "My Tasks";
  if (pathname.startsWith("/pulse/knowledge")) return "Knowledge";
  if (pathname.startsWith("/pulse/insights")) return "Insights";
  if (pathname.startsWith("/pulse/actions")) return "Pulse actions";
  if (pathname.startsWith("/pulse/value")) return "Value";
  if (pathname.startsWith("/pulse/connections")) return "Connections";
  if (pathname.startsWith("/pulse")) return "Qiko Pulse";
  if (pathname.startsWith("/staffing/associates")) return "Talent Network";
  if (pathname.startsWith("/staffing/requirements")) return "Client Requirements";
  if (pathname.startsWith("/staffing/placements")) return "Assignments";
  if (pathname.startsWith("/staffing/clients")) return "Accounts";
  if (pathname.startsWith("/staffing")) return "Staffing Overview";
  if (pathname.startsWith("/sales/pipeline")) return "Opportunities";
  if (pathname.startsWith("/sales/accounts")) return "Accounts";
  if (pathname.startsWith("/sales/contacts")) return "Contacts";
  if (pathname.startsWith("/sales/leads")) return "Leads";
  if (pathname.startsWith("/sales/actions")) return "Activities";
  if (pathname.startsWith("/sales")) return "Sales";
  if (pathname.startsWith("/settings")) return "Settings";
  return "Tessiant";
}

const subscribePlatform = () => () => {};
const getMacPlatform = () => /Mac|iPhone|iPad|iPod/i.test(navigator.platform);
const getServerPlatform = () => false;

interface Toast {
  id: string;
  message: string;
  tone: "success" | "info" | "error";
}

export default function AppShell({ children }: { children: ReactNode }) {
  const session = useSession();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (session === null) router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [session, router, pathname]);

  if (!session) return <ShellSplash />;
  return <Workspace session={session}>{children}</Workspace>;
}

export function ShellSplash() {
  return (
    <div className={styles.splash} aria-busy="true">
      <Image src="/brand/qiko-icon.png" alt="Qiko" width={56} height={56} priority />
    </div>
  );
}

function Workspace({ session, children }: { session: NonNullable<ReturnType<typeof useSession>>; children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { state, workspace } = useWorkspaceData();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [copilot, setCopilot] = useState<{ open: boolean; question?: string; leadId?: string | null; nonce: number }>({ open: false, nonce: 0 });
  const [taskForm, setTaskForm] = useState<TaskFormRequest | null>(null);
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  const [addLeadOpen, setAddLeadOpen] = useState(false);
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const [menu, setMenu] = useState<"notifications" | "user" | null>(null);
  const [search, setSearch] = useState("");
  const macPlatform = useSyncExternalStore(subscribePlatform, getMacPlatform, getServerPlatform);
  const menuRef = useRef<HTMLDivElement>(null);

  const toast = useCallback((message: string, tone: Toast["tone"] = "success") => {
    const id = uid("toast");
    setToasts((current) => [...current.slice(-2), { id, message, tone }]);
    window.setTimeout(() => setToasts((current) => current.filter((item) => item.id !== id)), 3600);
  }, []);

  const api = useMemo<WorkspaceApi>(
    () => ({
      session,
      toast,
      askQiko: (question, leadId) => setCopilot((current) => ({ open: true, question, leadId: leadId ?? null, nonce: current.nonce + 1 })),
      openTaskForm: (request) => setTaskForm(request ?? {}),
      openTask: (taskId) => setOpenTaskId(taskId),
      openAddLead: () => setAddLeadOpen(true),
    }),
    [session, toast],
  );

  // Close menus on outside click; the platform shortcut opens Ask Qiko.
  useEffect(() => {
    const isMac = /Mac|iPhone|iPad|iPod/i.test(navigator.platform);
    const onDown = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setMenu(null);
    };
    const onKey = (event: KeyboardEvent) => {
      if ((isMac ? event.metaKey : event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCopilot((current) => ({ open: !current.open, nonce: current.nonce + 1 }));
      }
      if (event.key === "Escape") setMenu(null);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  const notifications = useMemo(() => {
    if (!workspace) return [];
    const today = todayKey();
    const overdue = workspace.tasks.filter((task) => isOpen(task) && task.due && task.due < today);
    const groups = buildPriorities(workspace).filter((group) => group.id !== "tasks");
    return [
      ...overdue.map((task) => ({ id: task.id, icon: "clock" as IconName, title: task.title, meta: "Overdue task", onClick: () => setOpenTaskId(task.id) })),
      ...groups.map((group) => ({ id: group.id, icon: "sparkles" as IconName, title: group.title, meta: "Suggested by Qiko", onClick: () => router.push("/tasks") })),
    ];
  }, [workspace, router]);

  const salesAttention = workspace ? salesAttentionCount(workspace) : 0;
  const tessiantAttention = state?.tessiant
    ? state.tessiant.requirements.filter((req) => !req.archived && req.outcome === "active" && req.stage !== "Placed").length
    : 0;
  const onStaffing = pathname.startsWith("/staffing");
  const onPulse = pathname.startsWith("/pulse");
  const currentLabel = pageTitle(pathname);

  useEffect(() => {
    // Tessiant is the customer/workspace identity; Qiko remains the product layer (Core, Pulse, Ask Qiko).
    document.documentElement.dataset.tenant = "tessiant";
    return () => {
      delete document.documentElement.dataset.tenant;
    };
  }, []);

  useEffect(() => {
    if (!onPulse) return;
    const previousTitle = document.title;
    document.title = "Qiko Pulse · Tessiant";
    return () => {
      document.title = previousTitle;
    };
  }, [onPulse]);

  const navigate = (href: string) => {
    setMobileOpen(false);
    router.push(href);
  };

  return (
    <WorkspaceContext.Provider value={api}>
      <div className={`${styles.shell} ${collapsed ? styles.collapsed : ""}`}>
        <div className={`${styles.scrim} ${mobileOpen ? styles.scrimOpen : ""}`} onClick={() => setMobileOpen(false)} aria-hidden="true" />
        <aside className={`${styles.sidebar} ${mobileOpen ? styles.sidebarOpen : ""}`} aria-label="Main navigation">
          {onPulse ? (
            <PulseNavigation
              pathname={pathname}
              collapsed={collapsed}
              onCollapse={() => setCollapsed((value) => !value)}
              onNavigate={() => setMobileOpen(false)}
              onClose={() => setMobileOpen(false)}
            />
          ) : (
            <>
          <div className={styles.brandRow}>
            <Link href="/" className={styles.brand} onClick={() => setMobileOpen(false)} aria-label="Tessiant workspace home">
              {collapsed ? (
                <Image src="/brand/qiko-icon.png" alt="Qiko" width={32} height={32} priority />
              ) : (
                <>
                  <Image src="/brand/qiko-logo.png" alt="Qiko" width={70} height={28} priority className={styles.wordmark} />
                  <span className={styles.product}>Core</span>
                </>
              )}
            </Link>
            <button type="button" className={styles.collapse} onClick={() => setCollapsed((value) => !value)} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
              <Icon name={collapsed ? "chevronRight" : "chevronLeft"} size={14} />
            </button>
            <button type="button" className={styles.mobileClose} onClick={() => setMobileOpen(false)} aria-label="Close navigation">
              <Icon name="x" size={18} />
            </button>
          </div>

          <div className={styles.tenant}>
            <span className={styles.tenantMark}>T</span>
            <span className={styles.hideCollapsed}>
              <b>Tessiant</b>
              <small>Operating workspace · {session.email}</small>
            </span>
          </div>

          <nav className={styles.nav}>
            <p className={`kicker ${styles.section}`}>Workspace</p>
            <ul>
              {NAV.map((item) => {
                const active = item.match(pathname);
                return (
                  <li key={item.href}>
                    <Link href={item.href} className={`${styles.navItem} ${active ? styles.active : ""}`} aria-current={pathname === item.href ? "page" : undefined} onClick={() => setMobileOpen(false)} title={collapsed ? item.label : undefined}>
                      <Icon name={item.icon} size={17} />
                      <span className={styles.hideCollapsed}>{item.label}</span>
                      {item.label === "Sales" && salesAttention > 0 && <span className={`${styles.meta} ${styles.hideCollapsed}`}>{salesAttention}</span>}
                      {item.label === "Staffing" && tessiantAttention > 0 && <span className={`${styles.meta} ${styles.hideCollapsed}`}>{tessiantAttention}</span>}
                    </Link>
                    {item.children && active && !collapsed && (
                      <ul className={styles.subnav}>
                        {item.children.map((child) => (
                          <li key={child.href}>
                            <Link href={child.href} className={`${styles.subItem} ${child.match(pathname) ? styles.subActive : ""}`} aria-current={child.match(pathname) ? "page" : undefined} onClick={() => setMobileOpen(false)}>
                              {child.label}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
            <p className={`kicker ${styles.section} ${styles.sectionGap}`}>Intelligence</p>
            <ul>
              <li>
                <Link
                  href="/pulse"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`${styles.navItem} ${pathname.startsWith("/pulse") ? styles.active : ""}`}
                  onClick={() => setMobileOpen(false)}
                  title={collapsed ? "Qiko Pulse" : undefined}
                >
                  <Icon name="pulse" size={17} />
                  <span className={styles.hideCollapsed}>Qiko Pulse</span>
                </Link>
              </li>
              <li>
                <button type="button" className={styles.navItem} onClick={() => { setMobileOpen(false); api.askQiko(); }} title={collapsed ? "Ask Qiko" : undefined}>
                  <Icon name="sparkles" size={17} />
                  <span className={styles.hideCollapsed}>Ask Qiko</span>
                  <kbd className={`${styles.kbd} ${styles.hideCollapsed}`}>{macPlatform ? "⌘K" : "Ctrl K"}</kbd>
                </button>
              </li>
            </ul>
            <p className={`kicker ${styles.section} ${styles.sectionGap}`}>Account</p>
            <ul>
              <li>
                <Link href="/settings" className={`${styles.navItem} ${pathname.startsWith("/settings") ? styles.active : ""}`} onClick={() => setMobileOpen(false)} title={collapsed ? "Settings" : undefined}>
                  <Icon name="settings" size={17} />
                  <span className={styles.hideCollapsed}>Settings</span>
                </Link>
              </li>
            </ul>
          </nav>

          <div className={styles.sidebarFoot}>
            <button type="button" className={styles.navItem} onClick={() => setConfirmSignOut(true)} title={collapsed ? "Sign out" : undefined}>
              <Icon name="logout" size={17} />
              <span className={styles.hideCollapsed}>Sign out</span>
            </button>
          </div>
            </>
          )}
        </aside>

        <div className={styles.main}>
          <header className={`${styles.topbar} ${onPulse ? styles.pulseTopbar : ""}`}>
            {onPulse ? (
              <>
                <button type="button" className={styles.menuButton} onClick={() => setMobileOpen(true)} aria-label="Open Pulse navigation">
                  <Icon name="menu" size={20} />
                </button>
                <Image src="/brand/qiko-icon.png" alt="" width={28} height={28} className={styles.pulseMobileLogo} />
                <span className={styles.mobileTitle}>{currentLabel}</span>
                <Link href="/" className={styles.pulseCoreLink} aria-label="Back to Tessiant">
                  <Icon name="arrowLeft" size={14} />
                  <span>Back to Tessiant</span>
                </Link>
              </>
            ) : (
              <>
            <button type="button" className={styles.menuButton} onClick={() => setMobileOpen(true)} aria-label="Open navigation">
              <Icon name="menu" size={20} />
            </button>
            <span className={styles.mobileTitle}>{currentLabel}</span>
            <form
              className={styles.search}
              role="search"
              onSubmit={(event) => {
                event.preventDefault();
                const q = search.trim();
                navigate(
                  onStaffing
                    ? `/staffing/associates${q ? `?q=${encodeURIComponent(q)}` : ""}`
                    : `/sales/leads${q ? `?q=${encodeURIComponent(q)}` : ""}`,
                );
                setSearch("");
              }}
            >
              <Icon name="search" size={15} />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={onStaffing ? "Search talent, skills…" : "Search leads, accounts, contacts…"}
                aria-label={onStaffing ? "Search talent network" : "Search sales"}
              />
            </form>
            <div className={styles.topActions} ref={menuRef}>
              <button type="button" className={styles.askButton} onClick={() => api.askQiko()}>
                <Icon name="sparkles" size={14} />
                <span>Ask Qiko</span>
              </button>
              <div className={styles.menuWrap}>
                <button type="button" className={styles.iconButton} aria-label={`Notifications (${notifications.length})`} aria-expanded={menu === "notifications"} onClick={() => setMenu(menu === "notifications" ? null : "notifications")}>
                  <Icon name="bell" size={18} />
                  {notifications.length > 0 && <i className={styles.badgeDot} />}
                </button>
                {menu === "notifications" && (
                  <div className={`${styles.dropdown} ${styles.notifications}`} role="menu">
                    <div className={styles.dropdownHead}>
                      <b>Needs your attention</b>
                      <span className="tag">{notifications.length}</span>
                    </div>
                    {notifications.length === 0 ? (
                      <p className={styles.dropdownEmpty}>You&apos;re all caught up.</p>
                    ) : (
                      notifications.slice(0, 6).map((item) => (
                        <button type="button" role="menuitem" key={item.id} className={styles.notification} onClick={() => { setMenu(null); item.onClick(); }}>
                          <span className={styles.notificationIcon}>
                            <Icon name={item.icon} size={14} />
                          </span>
                          <span>
                            <b>{item.title}</b>
                            <small>{item.meta}</small>
                          </span>
                        </button>
                      ))
                    )}
                    <Link href="/tasks" className={styles.dropdownFoot} onClick={() => setMenu(null)}>
                      Open My Tasks <Icon name="arrowRight" size={13} />
                    </Link>
                  </div>
                )}
              </div>
              <div className={styles.menuWrap}>
                <button type="button" className={styles.userButton} aria-label="Account menu" aria-expanded={menu === "user"} onClick={() => setMenu(menu === "user" ? null : "user")}>
                  <span className="avatar">{initials(session.name)}</span>
                </button>
                {menu === "user" && (
                  <div className={styles.dropdown} role="menu">
                    <div className={styles.userHead}>
                      <span className="avatar">{initials(session.name)}</span>
                      <span>
                        <b>{session.name}</b>
                        <small>{session.email}</small>
                      </span>
                    </div>
                    <Link href="/settings" role="menuitem" className={styles.menuItem} onClick={() => setMenu(null)}>
                      <Icon name="settings" size={15} /> Settings
                    </Link>
                    <button type="button" role="menuitem" className={styles.menuItem} onClick={() => { setMenu(null); setConfirmSignOut(true); }}>
                      <Icon name="logout" size={15} /> Sign out
                    </button>
                  </div>
                )}
              </div>
            </div>
              </>
            )}
          </header>
          <main className={styles.content}>{children}</main>
        </div>

        <div className={styles.toasts} aria-live="polite">
          {toasts.map((item) => (
            <div key={item.id} className={`${styles.toast} ${styles[item.tone]}`} role="status">
              <Icon name={item.tone === "error" ? "alert" : item.tone === "info" ? "info" : "checkCircle"} size={16} />
              {item.message}
            </div>
          ))}
        </div>
      </div>

      {copilot.open && <CopilotPanel key={copilot.nonce} initialQuestion={copilot.question} contextLeadId={copilot.leadId ?? null} onClose={() => setCopilot((current) => ({ ...current, open: false }))} />}
      {taskForm && <TaskFormModal request={taskForm} onClose={() => setTaskForm(null)} />}
      {openTaskId && <TaskDrawer taskId={openTaskId} onClose={() => setOpenTaskId(null)} />}
      {addLeadOpen && <AddLeadModal onClose={() => setAddLeadOpen(false)} />}
      {confirmSignOut && (
        <ConfirmDialog
          title="Sign out of Tessiant?"
          description="Your workspace changes stay saved in this browser for next time."
          confirmLabel="Sign out"
          onCancel={() => setConfirmSignOut(false)}
          onConfirm={() => {
            signOut();
            router.replace("/login");
          }}
        />
      )}
    </WorkspaceContext.Provider>
  );
}
