import { NextResponse, type NextRequest } from "next/server"
import { rateLimit } from "@/lib/rate-limit"

// Routes worth limiting:
// - /api/upload: each call is cheap but each successful call gets you a
//   presigned PUT, so a loop here is the main way someone could spam the
//   bucket with junk objects or run up R2 request costs.
// - /api/presence: called every 8s per open tab already; a scripted client
//   could call it far faster and generate a PutObject on every hit.
// - /api/user/settings/*-url, /api/admin/badges/image-url: same
//   presign-abuse shape as /api/upload, just for profile/donator-perk/badge images.
const LIMITS: Record<string, { limit: number; windowMs: number }> = {
  "/api/upload": { limit: 20, windowMs: 60_000 }, // 20 presigns / min / IP
  "/api/presence": { limit: 30, windowMs: 60_000 }, // ~1 every 2s / IP
  "/api/user/settings/avatar-url": { limit: 10, windowMs: 60_000 },
  "/api/user/settings/banner-url": { limit: 10, windowMs: 60_000 },
  "/api/user/settings/music-url": { limit: 10, windowMs: 60_000 },
  "/api/user/settings/theme-url": { limit: 10, windowMs: 60_000 },
  "/api/user/settings/video-url": { limit: 10, windowMs: 60_000 },
  "/api/admin/badges/image-url": { limit: 10, windowMs: 60_000 },
}

// /a/ (avatars, banners, music, themes, profile videos, badges) has dynamic
// subpaths, e.g. /a/video/<key>, so it can't live in the exact-path LIMITS
// map above — it gets one shared per-IP bucket across every asset instead.
// This is the main practical defense against bulk-scraping the bucket: 240
// requests/min is generous for normal browsing (a single profile page can
// load half a dozen assets) but throttles anything trying to walk through
// many objects quickly.
const ASSET_PREFIX = "/a/"
const ASSET_LIMIT = { limit: 240, windowMs: 60_000 }

// SECURITY FIX: every /api/admin/* and /api/user/* route returns data scoped
// to whoever's session cookie made the request — none of them ever set an
// explicit Cache-Control header, which meant they relied entirely on Next.js
// correctly detecting that cookies()-based auth checks make a route dynamic
// and therefore uncacheable. That detection was confirmed NOT reliably
// holding in production (an admin-only endpoint's response was verifiably
// served back to a signed-out incognito request). Rather than track down
// and patch every individual route file, this sets Cache-Control: no-store
// on the whole surface centrally, so nothing can be cached and replayed to
// a different user regardless of what any individual route does or doesn't
// declare. This is the actual fix — everything else here is rate limiting.
function isSensitiveApi(path: string): boolean {
  return (
    path.startsWith("/api/admin/") ||
    path.startsWith("/api/user/") ||
    path === "/api/leaderboard" ||
    path.startsWith("/api/auth/discord/")
  )
}

export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname
  // x-forwarded-for is set by Vercel's edge network; not spoofable by the
  // client since Vercel overwrites it at the edge.
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown"
  const sensitive = isSensitiveApi(path)

  if (path.startsWith(ASSET_PREFIX)) {
    const { ok, remaining } = rateLimit(`${ip}:asset`, ASSET_LIMIT.limit, ASSET_LIMIT.windowMs)
    if (!ok) {
      return new NextResponse("Too many requests", { status: 429, headers: { "Retry-After": "60" } })
    }
    const res = NextResponse.next()
    res.headers.set("X-RateLimit-Remaining", String(remaining))
    return res
  }

  const rule = LIMITS[path]
  if (rule) {
    const { ok, remaining } = rateLimit(`${ip}:${path}`, rule.limit, rule.windowMs)
    if (!ok) {
      return NextResponse.json(
        { error: "Too many requests, slow down." },
        { status: 429, headers: { "Retry-After": "60" } },
      )
    }
    const res = NextResponse.next()
    res.headers.set("X-RateLimit-Remaining", String(remaining))
    if (sensitive) res.headers.set("Cache-Control", "no-store, private")
    return res
  }

  const res = NextResponse.next()
  if (sensitive) res.headers.set("Cache-Control", "no-store, private")
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
    "/api/user/settings/video-url",
    "/api/admin/badges/image-url",
    "/a/:path*",
    "/api/admin/:path*",
    "/api/user/:path*",
    "/api/leaderboard",
    "/api/auth/discord/:path*",
  ],
}
