"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

const inputCls =
  "w-full rounded-md border border-[var(--border)] bg-white px-3 py-2.5 text-sm outline-none transition focus:border-accent focus:ring-4 focus:ring-accent/10";

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/garage";

  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ login, password }),
      });
      if (res.ok) {
        router.replace(next);
        router.refresh();
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Ошибка входа");
      }
    } catch {
      setError("Сеть недоступна. Попробуйте еще раз.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className="mb-1.5 block text-xs font-bold uppercase tracking-[0.08em] text-[var(--muted)]">
          Логин или email
        </label>
        <input
          type="text"
          autoComplete="username"
          value={login}
          onChange={(e) => setLogin(e.target.value)}
          required
          className={inputCls}
        />
      </div>
      <div>
        <label className="mb-1.5 block text-xs font-bold uppercase tracking-[0.08em] text-[var(--muted)]">
          Пароль
        </label>
        <input
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className={inputCls}
        />
      </div>
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
          {error}
        </div>
      )}
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-md bg-[var(--sidebar)] px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--sidebar-soft)] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? "Вход..." : "Войти"}
      </button>
    </form>
  );
}
