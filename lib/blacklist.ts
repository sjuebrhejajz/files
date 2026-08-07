import { sql } from "@/lib/db"

export type BlacklistType = "ip" | "username" | "email"

// x-forwarded-for is set by Vercel's edge network; not spoofable by the client
// since Vercel overwrites it at the edge. Same helper logic as middleware.ts.
export function getClientIp(request: Request): string | null {
  const header = request.headers.get("x-forwarded-for")
  if (!header) return null
  return header.split(",")[0]?.trim() || null
}

/** True if any of the given identifiers match a blacklist entry. */
export async function isBlacklisted(input: {
  ip?: string | null
  username?: string | null
  email?: string | null
}): Promise<boolean> {
  const checks: { type: BlacklistType; value: string }[] = []
  if (input.ip) checks.push({ type: "ip", value: input.ip })
  if (input.username) checks.push({ type: "username", value: input.username.toLowerCase() })
  if (input.email) checks.push({ type: "email", value: input.email.toLowerCase() })
  if (checks.length === 0) return false

  for (const check of checks) {
    const rows = await sql`select 1 from blacklist where type = ${check.type} and value = ${check.value} limit 1`
    if (rows.length > 0) return true
  }
  return false
}

/** Staff (moderator/admin) accounts and the admin account itself can never be blacklisted or banned. */
export function isProtectedFromBlacklist(target: { username: string; role: string }): boolean {
  return target.role === "moderator" || target.role === "admin" || target.username.toLowerCase() === "admin"
}
