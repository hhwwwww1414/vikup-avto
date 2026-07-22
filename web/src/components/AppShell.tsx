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
    <nav className="flex flex-col gap-1">
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(item.href + "/");
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
              active
                ? "bg-graphite text-white"
                : "text-graphite hover:bg-black/5"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  const Profile = () => (
    <div className="border-t border-[var(--border)] pt-3">
      <div className="px-3 text-sm font-medium">{user.name}</div>
      <div className="px-3 text-xs text-[var(--muted)]">
        {user.role === "ADMIN" ? "Администратор" : "Менеджер"}
      </div>
      <button
        onClick={logout}
        className="mt-2 w-full rounded-lg px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
      >
        Выйти
      </button>
    </div>
  );

  return (
    <div className="min-h-screen md:flex">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:w-60 md:flex-col md:border-r md:border-[var(--border)] md:bg-[var(--panel)] md:p-4">
        <div className="mb-6 px-3 text-xl font-bold tracking-tight">VIKUP</div>
        <NavLinks />
        <div className="mt-auto">
          <Profile />
        </div>
      </aside>

      {/* Mobile header */}
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-[var(--border)] bg-[var(--panel)] px-4 py-3 md:hidden">
        <div className="text-lg font-bold tracking-tight">VIKUP</div>
        <button
          aria-label="Меню"
          onClick={() => setOpen(true)}
          className="rounded-lg p-2 hover:bg-black/5"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      </header>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-30 md:hidden">
          <div className="absolute inset-0 bg-black/30" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-0 flex h-full w-64 flex-col bg-[var(--panel)] p-4 shadow-xl">
            <div className="mb-6 flex items-center justify-between">
              <div className="px-1 text-xl font-bold tracking-tight">VIKUP</div>
              <button
                aria-label="Закрыть"
                onClick={() => setOpen(false)}
                className="rounded-lg p-2 hover:bg-black/5"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
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

      <main className="flex-1 px-4 py-5 md:px-8 md:py-7">{children}</main>
    </div>
  );
}
