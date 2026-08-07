import { NextResponse } from "next/server"
import { requireAdmin, AuthError } from "@/lib/auth"

export async function GET() {
  try {
    await requireAdmin()

    const redirectUri = process.env.DISCORD_REDIRECT_URI ?? null
    const clientId = process.env.DISCORD_CLIENT_ID ?? null

    return NextResponse.json({
      // Compare this character-for-character against the redirect URL entered
      // in the Discord Developer Portal (Application → OAuth2 → Redirects).
      // Common mismatches: http vs https, a trailing slash on one side but not
      // the other, or www vs no-www.
      redirectUri,
      clientIdConfigured: Boolean(clientId),
      clientSecretConfigured: Boolean(process.env.DISCORD_CLIENT_SECRET),
      exampleAuthorizeUrl:
        clientId && redirectUri
          ? `https://discord.com/oauth2/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=identify&state=example`
          : null,
    })
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status })
    console.error("[auth/discord/debug]", err)
    return NextResponse.json({ error: "Could not load Discord config." }, { status: 500 })
  }
}
