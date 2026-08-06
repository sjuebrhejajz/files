// Lightweight fixed-window rate limiter for Edge Middleware.
//
// This is deliberately simple: an in-memory Map keyed by "ip:route". It only
// protects a single edge isolate (Vercel may run several in parallel), so it
// will NOT stop a distributed flood on its own — that's what Vercel's
// platform-level DDoS mitigation and Cloudflare are for (see README notes).
// What this DOES stop cheaply: a single script hammering /api/upload or
// /api/presence in a tight loop, which is the realistic "someone finds the
// site and writes a bad script" case, and it costs nothing to run.
type Bucket = { count: number; resetAt: number }

const buckets = new Map<string, Bucket>()

// Periodically forget old buckets so this doesn't grow forever.
const MAX_BUCKETS = 5000

export function rateLimit(key: string, limit: number, windowMs: number): { ok: boolean; remaining: number } {
  const now = Date.now()
  const existing = buckets.get(key)

  if (!existing || now > existing.resetAt) {
    if (buckets.size > MAX_BUCKETS) buckets.clear()
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return { ok: true, remaining: limit - 1 }
  }

  if (existing.count >= limit) {
    return { ok: false, remaining: 0 }
  }

  existing.count += 1
  return { ok: true, remaining: limit - existing.count }
}
