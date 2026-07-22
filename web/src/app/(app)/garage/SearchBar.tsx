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
      <input
        value={value}
        onChange={(e) => setValue(e.target.value.toUpperCase())}
        placeholder="О101НТ, 799 или К575НК"
        className="h-12 w-full rounded-lg border border-[var(--border)] bg-white px-4 pr-12 text-[15px] font-semibold uppercase tracking-normal text-[var(--text)] outline-none transition placeholder:font-medium placeholder:normal-case placeholder:text-[var(--muted)] focus:border-accent focus:ring-4 focus:ring-accent/10"
        inputMode="text"
        autoCapitalize="characters"
        autoComplete="off"
        spellCheck={false}
      />
      <button
        type="submit"
        aria-label="Искать"
        className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-md text-[var(--muted)] transition hover:bg-slate-100 hover:text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-accent/25"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
          <path d="M20 20l-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>
    </form>
  );
}
