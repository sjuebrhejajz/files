import { NextResponse } from "next/server"
import { randomBytes } from "crypto"
import { getCurrentUser } from "@/lib/auth"
import { getDiscordAuthUrl } from "@/lib/discord"

export async function GET(req: Request) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.redirect(new URL("/dashboard/settings", req.url))
  }

  const state = randomBytes(16).toString("hex")
  const redirectUri = new URL("/api/auth/discord/callback", req.url).toString()
  const authUrl = getDiscordAuthUrl(state, redirectUri)

  const res = NextResponse.redirect(authUrl)
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
