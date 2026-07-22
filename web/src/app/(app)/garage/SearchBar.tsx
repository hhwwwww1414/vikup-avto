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
        onChange={(e) => setValue(e.target.value)}
        placeholder="Поиск по госномеру, напр. О101 или К575НК"
        className="w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 pr-10 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
        inputMode="text"
      />
      <button
        type="submit"
        aria-label="Искать"
        className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-[var(--muted)] hover:bg-black/5"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
          <path d="M20 20l-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>
    </form>
  );
}
