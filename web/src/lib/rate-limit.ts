/**
 * Tiny in-memory fixed-window rate limiter. Sufficient for a single-instance
 * internal tool (login brute-force protection). Not shared across processes.
 */
interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

export interface RateResult {
  allowed: boolean;
  remaining: number;
  retryAfterSec: number;
}

export function rateLimit(key: string, limit: number, windowMs: number): RateResult {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, retryAfterSec: 0 };
  }
  if (b.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSec: Math.ceil((b.resetAt - now) / 1000),
    };
  }
  b.count += 1;
  return { allowed: true, remaining: limit - b.count, retryAfterSec: 0 };
}

// Periodic cleanup so the map does not grow unbounded.
if (typeof setInterval !== "undefined") {
  const timer = setInterval(() => {
    const now = Date.now();
    for (const [k, v] of buckets) {
      if (v.resetAt <= now) buckets.delete(k);
    }
  }, 60_000);
  // Do not keep the event loop alive just for cleanup.
  if (typeof (timer as { unref?: () => void }).unref === "function") {
    (timer as { unref: () => void }).unref();
  }
}
