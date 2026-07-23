"use client";

import { useState } from "react";

export function RetrySherlockButton({ vehicleId }: { vehicleId: string }) {
  const [busy, setBusy] = useState(false);

  async function retry() {
    if (busy) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/sherlock/vehicles/${vehicleId}/retry`, {
        method: "POST",
      });
      if (response.ok) {
        window.location.reload();
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
