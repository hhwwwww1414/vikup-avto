"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

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
      setError("Сеть недоступна. Попробуйте ещё раз.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className="mb-1 block text-sm font-medium">Логин или email</label>
        <input
          type="text"
          autoComplete="username"
          value={login}
          onChange={(e) => setLogin(e.target.value)}
          required
          className="w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">Пароль</label>
        <input
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
        />
      </div>
      {error && (
        <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white transition hover:bg-accent-hover disabled:opacity-60"
      >
        {loading ? "Вход..." : "Войти"}
      </button>
    </form>
  );
}
