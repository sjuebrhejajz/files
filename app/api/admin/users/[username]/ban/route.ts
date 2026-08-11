import { NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireStaff, AuthError } from "@/lib/auth"
import { purgeAccount } from "@/lib/purge-account"
import { logModAction } from "@/lib/mod-log"

// SECURITY: explicit, independent of the Cache-Control header middleware.ts
// also sets on all /api/admin/* and /api/user/* routes. This stops Next.js
// from ever treating the route as cacheable in the first place. Added after
// confirming an admin-only endpoint's response was being served to a
// signed-out incognito request — nothing here previously told Next.js this
// data depends on who's asking.
export const dynamic = "force-dynamic"

export async function POST(req: Request, { params }: { params: Promise<{ username: string }> }) {
  try {
    const actor = await requireStaff()
    const { username } = await params
    const body = await req.json().catch(() => ({}))
    const reason = typeof body.reason === "string" && body.reason.trim() ? body.reason.trim().slice(0, 500) : null

    const rows = await sql`
      select id, username, email, role from users where lower(username) = ${username.toLowerCase()}
    `
    const target = rows[0]
    if (!target) return NextResponse.json({ error: "User not found." }, { status: 404 })

    const targetIsStaff =
      target.role === "moderator" ||
      target.role === "admin" ||
      target.role === "owner" ||
      String(target.username).toLowerCase() === "admin"
    if (targetIsStaff) {
      return NextResponse.json({ error: "Staff and the admin account can't be banned." }, { status: 403 })
    }

    // Grab known IPs before the account (and everything cascading from it,
    // including user_ips) is gone — used for the IP-blacklist follow-up prompt.
    const ipRows = await sql`select ip from user_ips where user_id = ${target.id}`

    const banReason = reason ?? "Banned via admin panel"
    await sql`
      insert into blacklist (type, value, reason, created_by)
      values ('username', ${String(target.username).toLowerCase()}, ${banReason}, ${actor.id})
      on conflict (type, value) do nothing
    `
    await sql`
      insert into blacklist (type, value, reason, created_by)
      values ('email', ${String(target.email).toLowerCase()}, ${banReason}, ${actor.id})
      on conflict (type, value) do nothing
    `

    await purgeAccount(target.id)
    await logModAction(actor, "ban_user", target.username, reason ?? undefined)

    return NextResponse.json({ ok: true, ips: ipRows.map((r) => r.ip as string) })
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status })
    console.error("[admin/users/:username/ban]", err)
    return NextResponse.json({ error: "Could not ban user." }, { status: 500 })
  }
}
