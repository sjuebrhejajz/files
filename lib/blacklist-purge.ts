import { sql } from "@/lib/db"
import { purgeAccount } from "@/lib/purge-account"
import { logModAction } from "@/lib/mod-log"
import type { BlacklistType } from "@/lib/blacklist"

/**
 * When a username/email/IP gets blacklisted, deletes every account tied to
 * that identifier along with their files — a username or email matches at
 * most one account, but an IP can match several (shared network, VPN,
 * household). Staff/admin accounts are skipped regardless: the blacklist
 * routes already refuse to blacklist a staff-affiliated identifier in the
 * first place, so this should never actually trigger against one, but the
 * check stays here too as defense in depth.
 *
 * Returns the usernames of accounts that were actually deleted, so the
 * caller can report it back ("also deleted: alice, bob").
 */
export async function purgeAccountsForBlacklistEntry(
  type: BlacklistType,
  value: string,
  actor: { id: string; username: string },
): Promise<string[]> {
  let targets: Record<string, any>[] = []

  if (type === "username") {
    targets = await sql`select id, username, role from users where lower(username) = ${value}`
  } else if (type === "email") {
    targets = await sql`select id, username, role from users where lower(email) = ${value}`
  } else {
    targets = await sql`
      select distinct u.id, u.username, u.role
      from user_ips ui
      join users u on u.id = ui.user_id
      where ui.ip = ${value}
    `
  }

  const purgedUsernames: string[] = []
  for (const target of targets) {
    const id = target.id as string
    const username = target.username as string
    const role = target.role as string
    const isProtected = role === "moderator" || role === "admin" || role === "owner" || username.toLowerCase() === "admin"
    if (isProtected) continue

    await purgeAccount(id)
    purgedUsernames.push(username)
    await logModAction(actor, "blacklist_cascade_delete", username, `Deleted via ${type} blacklist entry: ${value}`)
  }

  return purgedUsernames
}
