"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

interface NavItem {
  href: string;
  label: string;
  adminOnly?: boolean;
  icon: React.ReactNode;
}
const NAV: NavItem[] = [
  {
    href: "/garage",
    label: "Гараж",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M4 11l1.7-4.1A3 3 0 0 1 8.5 5h7a3 3 0 0 1 2.8 1.9L20 11" />
        <path d="M5 11h14v6H5zM7 17v2m10-2v2" />
        <path d="M7.5 14h.01M16.5 14h.01" />
      </svg>
    ),
  },
  {
    href: "/analytics",
    label: "Аналитика",
    adminOnly: true,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M4 19V5m0 14h16" />
        <path d="M8 16v-5m4 5V8m4 8v-7" />
      </svg>
    ),
  },
  {
    href: "/managers",
    label: "Менеджеры",
    adminOnly: true,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M16 19a4 4 0 0 0-8 0" />
        <circle cx="12" cy="8" r="3" />
        <path d="M20 18a3.5 3.5 0 0 0-3-3.4M4 18a3.5 3.5 0 0 1 3-3.4" />
      </svg>
    ),
  },
];

function navIconClass(active: boolean) {
  return `h-5 w-5 ${active ? "text-[var(--accent)]" : "text-[var(--muted)]"} [&_path]:stroke-current [&_path]:stroke-[1.9] [&_path]:stroke-linecap-round [&_path]:stroke-linejoin-round [&_circle]:stroke-current [&_circle]:stroke-[1.9]`;
}

export function AppShell({
  user,
  children,
}: {
  user: { name: string; role: "ADMIN" | "MANAGER"; login: string };
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const items = NAV.filter((n) => !n.adminOnly || user.role === "ADMIN");

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  const NavLinks = ({ onNavigate }: { onNavigate?: () => void }) => (
    <nav className="space-y-1">
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
              active
                ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                : "text-[var(--muted-strong)] hover:bg-[var(--sidebar-soft)] hover:text-[var(--text)]"
            }`}
          >
            <span className={navIconClass(active)}>{item.icon}</span>
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );

  const Profile = () => (
    <div className="mt-auto border-t border-[var(--border)] pt-4">
      <div className="flex items-center gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[var(--accent-soft)] text-sm font-extrabold text-[var(--accent)]">
          {user.name.slice(0, 1).toUpperCase()}
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-bold text-[var(--text)]">{user.name}</div>
          <div className="truncate text-xs text-[var(--muted)]">{user.login}</div>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between gap-3">
        <span className="rounded-full bg-[var(--panel-strong)] px-2.5 py-1 text-[11px] font-bold text-[var(--muted-strong)]">
          {user.role === "ADMIN" ? "Админ" : "Менеджер"}
        </span>
        <button
          onClick={logout}
          className="rounded-lg px-2.5 py-1.5 text-xs font-bold text-[var(--muted-strong)] transition hover:bg-red-50 hover:text-red-600 focus:outline-none focus:ring-4 focus:ring-red-500/10"
        >
          Выйти
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-[var(--border)] bg-[var(--sidebar)] px-4 py-5 md:flex">
        <div className="mb-7 flex items-center gap-3 px-2">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--accent)] text-sm font-extrabold text-white">
            V
          </div>
          <div>
            <div className="text-lg font-extrabold tracking-tight text-[var(--text)]">VIKUP</div>
            <div className="text-xs text-[var(--muted)]">Dashboard</div>
          </div>
        </div>
        <NavLinks />
        <Profile />
      </aside>

      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-[var(--border)] bg-white/90 px-4 py-3 backdrop-blur md:hidden">
        <div className="flex items-center gap-2.5">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-[var(--accent)] text-xs font-extrabold text-white">
            V
          </div>
          <div className="text-base font-extrabold tracking-tight">VIKUP</div>
        </div>
        <button
          aria-label="Меню"
          onClick={() => setOpen(true)}
          className="grid h-10 w-10 place-items-center rounded-xl border border-[var(--border)] bg-white text-[var(--text)] shadow-sm"
        >
          <svg width="21" height="21" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      </header>

      {open && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-slate-950/35" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-0 flex h-full w-[min(86vw,320px)] flex-col border-r border-[var(--border)] bg-white p-4 shadow-2xl">
            <div className="mb-7 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="grid h-9 w-9 place-items-center rounded-xl bg-[var(--accent)] text-xs font-extrabold text-white">
                  V
                </div>
                <div className="text-base font-extrabold tracking-tight">VIKUP</div>
              </div>
              <button
                aria-label="Закрыть"
                onClick={() => setOpen(false)}
                className="grid h-10 w-10 place-items-center rounded-xl border border-[var(--border)] bg-white text-[var(--muted)]"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            <NavLinks onNavigate={() => setOpen(false)} />
            <Profile />
          </div>
        </div>
      )}

      <main className="min-w-0 px-4 py-5 sm:px-6 md:pl-72 md:pr-8 md:py-7 xl:pr-10">
        {children}
      </main>
    </div>
  );
}
