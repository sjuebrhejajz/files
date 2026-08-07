import { sql } from "@/lib/db"

/** Upserts a (user, ip) pair, bumping last_seen if it's already known. Call after a successful login. */
export async function recordUserIp(userId: string, ip: string | null) {
  if (!ip) return
  await sql`
    insert into user_ips (user_id, ip)
    values (${userId}, ${ip})
    on conflict (user_id, ip) do update set last_seen = now()
  `
}
