import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { sql } from "@/lib/db"
import { getCurrentUser } from "@/lib/auth"
import { exchangeDiscordCode, fetchDiscordUser } from "@/lib/discord"

// SECURITY: consistent with the rest of the auth-sensitive routes — explicit
// rather than relying solely on Next.js detecting the cookies() call below.
export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  const settingsUrl = new URL("/dashboard/settings", req.url)

  const user = await getCurrentUser()
  if (!user) return NextResponse.redirect(settingsUrl)

  const { searchParams } = new URL(req.url)
  const code = searchParams.get("code")
  const state = searchParams.get("state")

  const jar = await cookies()
  const expectedState = jar.get("discord_oauth_state")?.value
  jar.delete("discord_oauth_state")

  if (!code || !state || !expectedState || state !== expectedState) {
    settingsUrl.searchParams.set("discord_error", "1")
    return NextResponse.redirect(settingsUrl)
  }

  try {
    const token = await exchangeDiscordCode(code)
    const discordUser = await fetchDiscordUser(token.access_token)

    // One Discord account can only ever be linked to one site account.
    const existing = await sql`select id from users where discord_id = ${discordUser.id} and id != ${user.id}`
    if (existing.length > 0) {
      settingsUrl.searchParams.set("discord_error", "taken")
      return NextResponse.redirect(settingsUrl)
    }

    await sql`
      update users
      set discord_id = ${discordUser.id}, discord_username = ${discordUser.username}, discord_avatar_url = ${discordUser.avatarUrl}
      where id = ${user.id}
    `

    settingsUrl.searchParams.set("discord_connected", "1")
    return NextResponse.redirect(settingsUrl)
  } catch (err) {
    console.error("[auth/discord/callback]", err)
    settingsUrl.searchParams.set("discord_error", "1")
    return NextResponse.redirect(settingsUrl)
  }
}
