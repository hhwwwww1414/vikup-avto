"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function GarageAutoRefresh({ intervalMs = 3000 }: { intervalMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    let refreshing = false;

    const refresh = () => {
      if (document.visibilityState !== "visible" || refreshing) return;
      refreshing = true;
      router.refresh();
      window.setTimeout(() => {
        refreshing = false;
      }, 500);
    };

    const timer = window.setInterval(refresh, intervalMs);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);

    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [intervalMs, router]);

  return null;
}
