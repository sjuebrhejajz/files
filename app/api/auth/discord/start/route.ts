import { NextResponse } from "next/server"
import { randomBytes } from "crypto"
import { getCurrentUser } from "@/lib/auth"
import { getDiscordAuthUrl } from "@/lib/discord"

// SECURITY: this redirect is per-session (embeds a fresh random state and
// sets a matching cookie) — it must never be cached and replayed to a
// different visitor with someone else's state.
export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.redirect(new URL("/dashboard/settings", req.url))
  }

  const state = randomBytes(16).toString("hex")
  const authUrl = getDiscordAuthUrl(state)

  const res = NextResponse.redirect(authUrl)
  res.headers.set("Cache-Control", "no-store, private")
  // Verified against on callback to prevent a forged/replayed redirect from
  // linking an attacker-chosen Discord account to the victim's session.
  res.cookies.set("discord_oauth_state", state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 600, // 10 minutes — plenty for the Discord consent screen
  })
  return res
}
