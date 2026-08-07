const DISCORD_API = "https://discord.com/api/v10"

// A fixed value, not derived from the incoming request. Discord requires an
// EXACT string match against what's registered in the Developer Portal, and
// behind Vercel's edge network the protocol/host Next.js sees isn't
// guaranteed to exactly match your custom domain on every request — that
// mismatch is what "Invalid OAuth2 redirect_uri" means. Set this once as an
// env var to the exact same URL registered in the Discord Developer Portal:
// https://files.uncertain.uk/api/auth/discord/callback
function redirectUri(): string {
  const uri = process.env.DISCORD_REDIRECT_URI
  if (!uri) throw new Error("DISCORD_REDIRECT_URI is not configured.")
  return uri
}

export function getDiscordAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.DISCORD_CLIENT_ID as string,
    redirect_uri: redirectUri(),
    response_type: "code",
    // "identify" is the minimum scope needed for username + avatar — no email,
    // no guild list, no other data.
    scope: "identify",
    state,
  })
  return `https://discord.com/oauth2/authorize?${params.toString()}`
}

export async function exchangeDiscordCode(code: string): Promise<{ access_token: string }> {
  const res = await fetch(`${DISCORD_API}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.DISCORD_CLIENT_ID as string,
      client_secret: process.env.DISCORD_CLIENT_SECRET as string,
      grant_type: "authorization_code",
      code,
      // Must match the redirect_uri used in the authorize step exactly, or
      // Discord rejects the token exchange too.
      redirect_uri: redirectUri(),
    }),
  })
  if (!res.ok) throw new Error("Discord token exchange failed.")
  return res.json()
}

export type DiscordIdentity = { id: string; username: string; avatarUrl: string | null }

export async function fetchDiscordUser(accessToken: string): Promise<DiscordIdentity> {
  const res = await fetch(`${DISCORD_API}/users/@me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) throw new Error("Could not fetch Discord profile.")
  const data = await res.json()

  const avatarUrl = data.avatar ? `https://cdn.discordapp.com/avatars/${data.id}/${data.avatar}.png?size=128` : null

  return {
    id: String(data.id),
    // global_name is the modern "display name" Discord shows instead of the
    // old username#0000 discriminator system; falls back to username if unset.
    username: String(data.global_name || data.username),
    avatarUrl,
  }
}
