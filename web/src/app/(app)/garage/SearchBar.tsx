"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function SearchBar({ initial }: { initial: string }) {
  const router = useRouter();
  const [value, setValue] = useState(initial);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const q = value.trim();
    router.push(q ? `/garage?q=${encodeURIComponent(q)}` : "/garage");
  }

  return (
    <form onSubmit={submit} className="relative w-full">
      <svg
        className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[var(--muted)]"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
      >
        <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
        <path d="M20 20l-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <input
        value={value}
        onChange={(e) => setValue(e.target.value.toUpperCase())}
        placeholder="Номер, регион или часть номера"
        className="dashboard-input h-12 w-full px-11 pr-24 text-sm font-semibold uppercase tracking-normal placeholder:normal-case placeholder:font-medium placeholder:text-[var(--muted)]"
        inputMode="text"
        autoCapitalize="characters"
        autoComplete="off"
        spellCheck={false}
      />
      <button
        type="submit"
        className="absolute right-1.5 top-1/2 h-9 -translate-y-1/2 rounded-xl bg-[var(--text)] px-4 text-xs font-bold text-white transition hover:bg-[var(--accent)] focus:outline-none focus:ring-4 focus:ring-blue-500/10"
      >
        Найти
      </button>
    </form>
  );
}
