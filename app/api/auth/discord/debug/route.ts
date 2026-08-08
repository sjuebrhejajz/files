import { NextResponse } from "next/server"
import { requireAdmin, AuthError } from "@/lib/auth"

// SECURITY: explicit, independent of the Cache-Control header middleware.ts
// also sets on all /api/admin/* and /api/user/* routes. This stops Next.js
// from ever treating the route as cacheable in the first place. Added after
// confirming an admin-only endpoint's response was being served to a
// signed-out incognito request — nothing here previously told Next.js this
// data depends on who's asking.
export const dynamic = "force-dynamic"

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
