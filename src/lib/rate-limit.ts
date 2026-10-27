const WINDOW_MS = 60_000;

const buckets = new Map<string, number[]>();

export type RateLimitResult = {
  allowed: boolean;
  limit: number;
  used: number;
  retryInSeconds: number;
};

export function checkRateLimit(
  key: string,
  limit: number,
  windowMs = WINDOW_MS
): RateLimitResult {
  const now = Date.now();
  const hits = (buckets.get(key) ?? []).filter(
    (time) => now - time < windowMs
  );

  if (hits.length >= limit) {
    const oldest = hits[0] ?? now;
    buckets.set(key, hits);
    return {
      allowed: false,
      limit,
      used: hits.length,
      retryInSeconds: Math.max(1, Math.ceil((windowMs - (now - oldest)) / 1000)),
    };
  }

  hits.push(now);
  buckets.set(key, hits);
  return { allowed: true, limit, used: hits.length, retryInSeconds: 0 };
}

export function resetRateLimit(key: string) {
  buckets.delete(key);
}

export function clearExpiredRateLimits(windowMs = WINDOW_MS) {
  const now = Date.now();
  for (const [key, hits] of buckets) {
    const active = hits.filter((time) => now - time < windowMs);
    if (active.length === 0) buckets.delete(key);
    else buckets.set(key, active);
  }
}
