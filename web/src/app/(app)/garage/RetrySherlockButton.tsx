"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function RetrySherlockButton({ vehicleId }: { vehicleId: string }) {
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function retry() {
    if (busy) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/sherlock/vehicles/${vehicleId}/retry`, {
        method: "POST",
      });
      if (response.ok) {
        router.refresh();
        window.setTimeout(() => router.refresh(), 1000);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={retry}
      disabled={busy}
      className="rounded-lg border border-[var(--border)] px-2.5 py-1.5 text-xs font-bold text-[var(--text)] transition hover:border-[var(--border-strong)] disabled:cursor-wait disabled:opacity-60"
    >
      {busy ? "Запускаем..." : "Повторить поиск"}
    </button>
  );
}
