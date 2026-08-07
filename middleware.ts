import { NextResponse, type NextRequest } from "next/server"
import { rateLimit } from "@/lib/rate-limit"

// Routes worth limiting:
// - /api/upload: each call is cheap but each successful call gets you a
//   presigned PUT, so a loop here is the main way someone could spam the
//   bucket with junk objects or run up R2 request costs.
// - /api/presence: called every 8s per open tab already; a scripted client
//   could call it far faster and generate a PutObject on every hit.
// - /api/user/settings/avatar-url, banner-url, music-url, theme-url: same
//   presign-abuse shape as /api/upload, just for profile/donator-perk images.
const LIMITS: Record<string, { limit: number; windowMs: number }> = {
  "/api/upload": { limit: 20, windowMs: 60_000 }, // 20 presigns / min / IP
  "/api/presence": { limit: 30, windowMs: 60_000 }, // ~1 every 2s / IP
  "/api/user/settings/avatar-url": { limit: 10, windowMs: 60_000 },
  "/api/user/settings/banner-url": { limit: 10, windowMs: 60_000 },
  "/api/user/settings/music-url": { limit: 10, windowMs: 60_000 },
  "/api/user/settings/theme-url": { limit: 10, windowMs: 60_000 },
}

export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname
  const rule = LIMITS[path]
  if (!rule) return NextResponse.next()

  // x-forwarded-for is set by Vercel's edge network; not spoofable by the
  // client since Vercel overwrites it at the edge.
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown"
  const { ok, remaining } = rateLimit(`${ip}:${path}`, rule.limit, rule.windowMs)

  if (!ok) {
    return NextResponse.json(
      { error: "Too many requests, slow down." },
      { status: 429, headers: { "Retry-After": "60" } },
    )
  }

  const res = NextResponse.next()
  res.headers.set("X-RateLimit-Remaining", String(remaining))
  return res
}

export const config = {
  matcher: [
    "/api/upload",
    "/api/presence",
    "/api/user/settings/avatar-url",
    "/api/user/settings/banner-url",
    "/api/user/settings/music-url",
    "/api/user/settings/theme-url",
  ],
}
