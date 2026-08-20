"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "@/lib/SessionProvider";
import { apiClient } from "@/lib/api";

const PUBLIC_PREFIXES = ["/login", "/403", "/external/", "/verify/"];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PREFIXES.some((p) => (p.endsWith("/") ? pathname.startsWith(p) : pathname === p));
}

interface NavItem {
  label: string;
  href: string;
  icon: string;
  permission?: string;
  cta?: boolean;
}

interface NavGroup {
  title: string | null;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    title: null,
    items: [
      { label: "Dashboard", href: "/dashboard", icon: "⌂" },
      { label: "Buat Memo", href: "/memos/new", icon: "＋", permission: "memo.create", cta: true },
    ],
  },
  {
    title: "MEMO",
    items: [
      { label: "Inbox Memo", href: "/memos/inbox", icon: "▣" },
      { label: "Draft", href: "/memos/drafts", icon: "✎" },
      { label: "Outbox", href: "/memos/outbox", icon: "➤" },
      { label: "Waiting Approval", href: "/approvals/inbox", icon: "⌛", permission: "memo.approve" },
      { label: "Approved", href: "/memos/approved", icon: "✓" },
      { label: "Rejected", href: "/memos/rejected", icon: "✕" },
      { label: "Published", href: "/memos/published", icon: "◎" },
      { label: "Archive", href: "/memos/archive", icon: "▤", permission: "memo.archive" },
    ],
  },
  {
    title: "TASK & WORKFLOW",
    items: [
      { label: "My Tasks", href: "/tasks/assigned", icon: "☑" },
      { label: "Tugas Diberikan", href: "/tasks/issued", icon: "⚑" },
    ],
  },
  {
    title: "REPORT",
    items: [{ label: "Reports", href: "/reports", icon: "▥", permission: "report.view" }],
  },
  {
    title: "MASTER DATA",
    items: [
      { label: "Master User", href: "/master/users", icon: "♟", permission: "master.user.manage" },
      { label: "Master Perusahaan", href: "/master/companies", icon: "▣", permission: "master.company.manage" },
      { label: "Master Departemen", href: "/master/departments", icon: "▦", permission: "master.department.manage" },
      { label: "Master Category", href: "/master/categories", icon: "▱", permission: "master.category.manage" },
      { label: "Jenis Memo", href: "/master/types", icon: "☷", permission: "master.category.manage" },
      { label: "Penomoran Memo", href: "/master/numbering", icon: "#", permission: "master.category.manage" },
      { label: "Master Workflow", href: "/master/workflows", icon: "⌘", permission: "master.workflow.manage" },
      { label: "Master Digital Signature", href: "/master/signatures", icon: "✍", permission: "master.signature.manage" },
    ],
  },
  {
    title: "SETTINGS",
    items: [{ label: "Settings", href: "/settings", icon: "⚙", permission: "settings.manage" }],
  },
];

function initials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "U";
}

const PAGE_TITLES: { match: (p: string) => boolean; title: string }[] = NAV_GROUPS.flatMap((g) =>
  g.items.map((item) => ({ match: (p: string) => p === item.href || p.startsWith(item.href + "/"), title: item.label }))
);

const DETAIL_ROUTE_TITLES: { match: RegExp; title: string }[] = [
  { match: /^\/memos\/[^/]+$/, title: "Detail Memo" },
  { match: /^\/approvals\/[^/]+$/, title: "Detail Persetujuan" },
];

function pageTitleFor(pathname: string): string {
  const detail = DETAIL_ROUTE_TITLES.find((t) => t.match.test(pathname));
  if (detail) return detail.title;
  const found = PAGE_TITLES.find((t) => t.match(pathname));
  return found?.title ?? "Dashboard";
}

function useClock() {
  const [time, setTime] = useState("");
  useEffect(() => {
    const tick = () => setTime(new Date().toLocaleTimeString("id-ID", { hour12: false }));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return time;
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading, logout } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState<number | null>(null);
  const clock = useClock();

  const publicPath = isPublicPath(pathname);

  useEffect(() => {
    if (loading) return;
    if (!user && !publicPath) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    } else if (user && pathname === "/login") {
      router.replace("/dashboard");
    }
  }, [loading, user, publicPath, pathname, router]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    apiClient<{ unreadCount: number }>("/dashboard").then((res) => {
      if (!cancelled && res.success && res.data) setUnreadCount(res.data.unreadCount);
    });
    return () => {
      cancelled = true;
    };
  }, [user]);

  if (publicPath) {
    return <main className="flex-1">{children}</main>;
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-screen text-slate-500 text-sm">
        Memuat sesi...
      </div>
    );
  }

  if (!user) {
    return <div className="flex-1 min-h-screen" />;
  }

  const canSee = (item: NavItem) => !item.permission || user.permissions.includes(item.permission);

  return (
    <div className="flex min-h-screen">
      <aside
        className="w-[280px] text-white flex-shrink-0 hidden md:flex md:flex-col overflow-y-auto sticky top-0 h-screen p-4"
        style={{ background: "linear-gradient(180deg,#07172f,#0b2548)" }}
      >
        <div className="flex items-center gap-2.5 pb-4 border-b border-white/10">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/ums-logo.png" alt="UMS" className="w-[42px] flex-shrink-0" />
          <div>
            <b className="text-sm block">UTAMA MEMO SYSTEM</b>
            <span className="block text-[#b8c3d2] text-xs mt-0.5">Sistem Memo Internal</span>
          </div>
        </div>

        <nav className="flex-1 mt-1">
          {NAV_GROUPS.map((group, gi) => {
            const visibleItems = group.items.filter(canSee);
            if (visibleItems.length === 0) return null;
            return (
              <div key={group.title ?? `g${gi}`} className={group.title ? "mt-4" : ""}>
                {group.title && (
                  <p className="text-[11px] text-[#9eb0c8] tracking-wider px-2 mt-4 mb-1.5">{group.title}</p>
                )}
                {visibleItems.map((item) => {
                  const active = pathname === item.href || pathname.startsWith(item.href + "/");
                  const baseClasses = "flex items-center gap-2.5 px-3 py-2.5 rounded-md text-sm my-0.5 no-underline";
                  const ctaClasses = "bg-gradient-to-r from-[#f6272f] to-[#df1018] text-white font-semibold my-3";
                  const activeClasses = "bg-gradient-to-r from-[#0d61ff] to-[#2378ff] text-white";
                  const idleClasses = "text-white/90 hover:bg-white/10";
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`${baseClasses} ${item.cta ? ctaClasses : active ? activeClasses : idleClasses}`}
                    >
                      <span className="w-5 text-center" aria-hidden="true">
                        {item.icon}
                      </span>
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </nav>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-[84px] bg-white border-b border-ums-border flex items-center justify-between px-4 md:px-6 sticky top-0 z-10">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-ums-text m-0">{pageTitleFor(pathname)}</h1>
            <small className="text-slate-500 text-xs">Home / {pageTitleFor(pathname)}</small>
          </div>
          <div className="flex items-center gap-3 md:gap-4">
            <span className="hidden md:inline text-sm text-slate-500 font-mono">{clock}</span>
            <Link href="/dashboard" className="relative text-xl" aria-label={`${unreadCount ?? 0} memo belum dibaca`}>
              🔔
              {!!unreadCount && (
                <i className="not-italic absolute -right-2 -top-2 bg-ums-red text-white rounded-full px-1.5 text-[10px] font-bold">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </i>
              )}
            </Link>
            <div className="relative">
              <button
                onClick={() => setMenuOpen((v) => !v)}
                className="flex items-center gap-2.5"
                aria-haspopup="menu"
                aria-expanded={menuOpen}
              >
                <span
                  className="w-[42px] h-[42px] rounded-full flex items-center justify-center font-bold text-white flex-shrink-0"
                  style={{ background: "#5d45e8" }}
                  aria-hidden="true"
                >
                  {initials(user.fullName)}
                </span>
                <span className="hidden md:block text-left">
                  <b className="block text-sm text-ums-text">{user.username}</b>
                  <small className="block text-xs text-slate-500">{user.roles[0] ?? "-"}</small>
                </span>
              </button>
              {menuOpen && (
                <div role="menu" className="absolute right-0 mt-2 w-52 bg-white border border-ums-border rounded-lg shadow-lg text-sm z-20">
                  <div className="px-4 py-2.5 border-b border-slate-100 text-xs text-slate-500">
                    {user.fullName}
                    <br />
                    {user.departmentName || "Tanpa departemen"}
                  </div>
                  <button
                    role="menuitem"
                    onClick={async () => {
                      setMenuOpen(false);
                      await logout();
                      router.replace("/login");
                    }}
                    className="w-full text-left px-4 py-2.5 text-red-600 hover:bg-red-50"
                  >
                    Keluar
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>
        <main className="flex-1 p-4 md:p-6 overflow-x-hidden bg-ums-bg">{children}</main>
      </div>
    </div>
  );
}
