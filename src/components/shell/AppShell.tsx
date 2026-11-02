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
import { WorkspaceContext, type TaskFormRequest, type WorkspaceApi } from "./WorkspaceContext";
import styles from "./AppShell.module.css";

interface NavItem {
  href: string;
  label: string;
  icon: IconName;
  match: (path: string) => boolean;
  children?: { href: string; label: string; match: (path: string) => boolean }[];
}

const NAV: NavItem[] = [
  { href: "/", label: "Home", icon: "home", match: (path) => path === "/" },
  {
    href: "/sales",
    label: "Sales",
    icon: "sales",
    match: (path) => path.startsWith("/sales"),
    children: [
      { href: "/sales", label: "Overview", match: (path) => path === "/sales" },
      { href: "/sales/leads", label: "Leads", match: (path) => path.startsWith("/sales/leads") },
      { href: "/sales/pipeline", label: "Pipeline", match: (path) => path.startsWith("/sales/pipeline") },
      { href: "/sales/actions", label: "Actions", match: (path) => path.startsWith("/sales/actions") },
    ],
  },
];

const FUTURE: { label: string; icon: IconName; hint: string }[] = [
  { label: "Marketing", icon: "megaphone", hint: "Campaigns, channels and engagement" },
  { label: "Finance Ops", icon: "wallet", hint: "Revenue, payments and invoices" },
];

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
  const { workspace } = useWorkspaceData();
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
      ...groups.map((group) => ({ id: group.id, icon: "sparkles" as IconName, title: group.title, meta: "Suggested by Qiko", onClick: () => router.push("/sales/actions") })),
    ];
  }, [workspace, router]);

  const salesAttention = workspace ? salesAttentionCount(workspace) : 0;
  const currentLabel = pathname === "/" ? "Home" : pathname.startsWith("/sales/pipeline") ? "Pipeline" : pathname.startsWith("/sales/leads") ? "Leads" : pathname.startsWith("/sales/actions") ? "Actions" : pathname.startsWith("/sales") ? "Sales" : pathname.startsWith("/settings") ? "Settings" : "Qiko Core";

  const navigate = (href: string) => {
    setMobileOpen(false);
    router.push(href);
  };

  return (
    <WorkspaceContext.Provider value={api}>
      <div className={`${styles.shell} ${collapsed ? styles.collapsed : ""}`}>
        <div className={`${styles.scrim} ${mobileOpen ? styles.scrimOpen : ""}`} onClick={() => setMobileOpen(false)} aria-hidden="true" />
        <aside className={`${styles.sidebar} ${mobileOpen ? styles.sidebarOpen : ""}`} aria-label="Main navigation">
          <div className={styles.brandRow}>
            <Link href="/" className={styles.brand} onClick={() => setMobileOpen(false)} aria-label="Qiko Core home">
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
            <span className={styles.tenantMark}>Q</span>
            <span className={styles.hideCollapsed}>
              <b>Qiko workspace</b>
              <small>{session.email}</small>
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
              {FUTURE.map((item) => (
                <li key={item.label}>
                  <span className={`${styles.navItem} ${styles.disabled}`} aria-disabled="true" title={`${item.label} — ${item.hint}. Coming soon.`}>
                    <Icon name={item.icon} size={17} />
                    <span className={styles.hideCollapsed}>{item.label}</span>
                    <span className={`${styles.soon} ${styles.hideCollapsed}`}>Soon</span>
                  </span>
                </li>
              ))}
            </ul>
            <p className={`kicker ${styles.section} ${styles.sectionGap}`}>Intelligence</p>
            <ul>
              <li>
                <span className={`${styles.navItem} ${styles.disabled}`} aria-disabled="true" title="Qiko Pulse — proactive intelligence. Coming soon.">
                  <Icon name="pulse" size={17} />
                  <span className={styles.hideCollapsed}>Qiko Pulse</span>
                  <span className={`${styles.soon} ${styles.hideCollapsed}`}>Soon</span>
                </span>
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
            <div className={`${styles.demoCard} ${styles.hideCollapsed}`}>
              <b>
                <Icon name="database" size={13} /> Demo workspace
              </b>
              <p>Realistic sample data. Your changes are saved in this browser.</p>
            </div>
            <button type="button" className={styles.navItem} onClick={() => setConfirmSignOut(true)} title={collapsed ? "Sign out" : undefined}>
              <Icon name="logout" size={17} />
              <span className={styles.hideCollapsed}>Sign out</span>
            </button>
          </div>
        </aside>

        <div className={styles.main}>
          <header className={styles.topbar}>
            <button type="button" className={styles.menuButton} onClick={() => setMobileOpen(true)} aria-label="Open navigation">
              <Icon name="menu" size={20} />
            </button>
            <span className={styles.mobileTitle}>{currentLabel}</span>
            <form
              className={styles.search}
              role="search"
              onSubmit={(event) => {
                event.preventDefault();
                navigate(`/sales/leads${search.trim() ? `?q=${encodeURIComponent(search.trim())}` : ""}`);
                setSearch("");
              }}
            >
              <Icon name="search" size={15} />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search leads, companies, emails…" aria-label="Search leads" />
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
                    <Link href="/sales/actions" className={styles.dropdownFoot} onClick={() => setMenu(null)}>
                      Open action workspace <Icon name="arrowRight" size={13} />
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
          </header>
          <main className={styles.content}>{children}</main>
        </div>

        <button type="button" className={styles.fab} onClick={() => api.askQiko()} aria-label="Ask Qiko">
          <Icon name="sparkles" size={20} />
        </button>

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
          title="Sign out of Qiko Core?"
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
