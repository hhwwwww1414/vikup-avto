"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

interface NavItem {
  href: string;
  label: string;
  adminOnly?: boolean;
}

const NAV: NavItem[] = [
  { href: "/garage", label: "Гараж" },
  { href: "/analytics", label: "Аналитика", adminOnly: true },
  { href: "/managers", label: "Менеджеры", adminOnly: true },
];

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
    <nav className="flex flex-col gap-1.5">
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(item.href + "/");
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={`group flex items-center justify-between rounded-md px-3 py-2.5 text-sm font-semibold transition ${
              active
                ? "bg-white text-[var(--sidebar)] shadow-sm"
                : "text-white/70 hover:bg-white/[0.08] hover:text-white"
            }`}
          >
            <span>{item.label}</span>
            <span
              className={`h-1.5 w-1.5 rounded-full transition ${
                active ? "bg-accent" : "bg-white/0 group-hover:bg-white/35"
              }`}
            />
          </Link>
        );
      })}
    </nav>
  );

  const Profile = () => (
    <div className="border-t border-white/10 pt-4">
      <div className="rounded-md bg-white/[0.07] px-3 py-3">
        <div className="truncate text-sm font-semibold text-white">{user.name}</div>
        <div className="mt-0.5 truncate text-xs text-white/52">{user.login}</div>
        <div className="mt-2 inline-flex rounded-sm bg-white/10 px-2 py-1 text-[11px] font-bold uppercase tracking-[0.08em] text-white/70">
          {user.role === "ADMIN" ? "Админ" : "Менеджер"}
        </div>
      </div>
      <button
        onClick={logout}
        className="mt-3 w-full rounded-md px-3 py-2 text-left text-sm font-semibold text-red-200 transition hover:bg-red-500/12 hover:text-red-100 focus:outline-none focus:ring-2 focus:ring-white/30"
      >
        Выйти
      </button>
    </div>
  );

  return (
    <div className="min-h-screen md:flex">
      <aside className="hidden md:flex md:w-64 md:min-w-64 md:flex-col md:bg-[var(--sidebar)] md:p-4">
        <div className="mb-7 px-3 pt-2">
          <div className="text-2xl font-black tracking-tight text-white">VIKUP</div>
          <div className="mt-1 text-xs font-medium text-white/45">Учет выкупных авто</div>
        </div>
        <NavLinks />
        <div className="mt-auto">
          <Profile />
        </div>
      </aside>

      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-[var(--border)] bg-white/92 px-4 py-3 backdrop-blur md:hidden">
        <div>
          <div className="text-lg font-black tracking-tight">VIKUP</div>
          <div className="text-[11px] font-medium text-[var(--muted)]">Гараж</div>
        </div>
        <button
          aria-label="Меню"
          onClick={() => setOpen(true)}
          className="rounded-md border border-[var(--border)] bg-white p-2 transition hover:bg-[var(--panel-strong)] focus:outline-none focus:ring-2 focus:ring-accent/25"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      </header>

      {open && (
        <div className="fixed inset-0 z-30 md:hidden">
          <div className="absolute inset-0 bg-black/45" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-0 flex h-full w-72 flex-col bg-[var(--sidebar)] p-4 shadow-2xl">
            <div className="mb-7 flex items-center justify-between">
              <div>
                <div className="text-2xl font-black tracking-tight text-white">VIKUP</div>
                <div className="mt-1 text-xs font-medium text-white/45">Учет выкупных авто</div>
              </div>
              <button
                aria-label="Закрыть"
                onClick={() => setOpen(false)}
                className="rounded-md p-2 text-white/72 transition hover:bg-white/10 hover:text-white focus:outline-none focus:ring-2 focus:ring-white/30"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            <NavLinks onNavigate={() => setOpen(false)} />
            <div className="mt-auto">
              <Profile />
            </div>
          </div>
        </div>
      )}

      <main className="min-w-0 flex-1 px-4 py-5 sm:px-6 md:px-8 md:py-8">{children}</main>
    </div>
  );
}
