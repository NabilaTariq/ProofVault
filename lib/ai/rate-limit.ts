// ─── Per-user throttle for paid AI endpoints ─────────────────────────────────
//
// Every AI route costs real money per call, and the buttons that trigger them
// sit in the UI where a stuck retry loop can hammer them. This keeps a single
// user from running up a bill.
//
// Scope: in-memory, so the counter is per server instance and resets on a cold
// start. That is enough to stop a runaway client on a single-instance
// deployment. On multiple instances each one enforces its own allowance, so a
// user's real ceiling is (limit x instances) — move the counter into Postgres
// (an `ai_usage` table keyed by user_id + created_at) if that matters.

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

/** Drop expired buckets so the map cannot grow without bound. */
function sweep(now: number) {
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  /** Seconds until the window resets. Only meaningful when `allowed` is false. */
  retryAfter: number;
}

/**
 * Consume one unit of a user's allowance for `feature`.
 * Call this only once you have decided the request is otherwise valid.
 */
export function checkRateLimit(
  userId: string,
  feature: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now();
  sweep(now);

  const key = `${feature}:${userId}`;
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, retryAfter: 0 };
  }

  if (existing.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfter: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }

  existing.count += 1;
  return { allowed: true, remaining: limit - existing.count, retryAfter: 0 };
}
