import { NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireStaff, AuthError } from "@/lib/auth"
import { blacklistTypeSchema } from "@/lib/validators"
import { purgeAccountsForBlacklistEntry } from "@/lib/blacklist-purge"
import { logModAction } from "@/lib/mod-log"

// SECURITY: explicit, independent of the Cache-Control header middleware.ts
// also sets on all /api/admin/* and /api/user/* routes. This stops Next.js
// from ever treating the route as cacheable in the first place. Added after
// confirming an admin-only endpoint's response was being served to a
// signed-out incognito request — nothing here previously told Next.js this
// data depends on who's asking.
export const dynamic = "force-dynamic"

export async function GET() {
  try {
    await requireStaff()
    const rows = await sql`
      select b.id, b.type, b.value, b.reason, b.created_at, u.username as created_by_username
      from blacklist b
      left join users u on u.id = b.created_by
      order by b.created_at desc
      limit 200
    `
    return NextResponse.json({ entries: rows })
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status })
    console.error("[admin/blacklist GET]", err)
    return NextResponse.json({ error: "Could not load blacklist." }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const actor = await requireStaff()
    const body = await req.json()

    const type = blacklistTypeSchema.safeParse(body.type)
    if (!type.success) return NextResponse.json({ error: "Invalid blacklist type." }, { status: 400 })

    const rawValue = String(body.value ?? "").trim()
    if (!rawValue) return NextResponse.json({ error: "Value is required." }, { status: 400 })
    const value = type.data === "ip" ? rawValue : rawValue.toLowerCase()
    const reason = typeof body.reason === "string" && body.reason.trim() ? body.reason.trim().slice(0, 500) : null

    // Whitelist protection: staff and the admin account can never be blacklisted.
    if (type.data === "username" || type.data === "email") {
      const lookupRows =
        type.data === "username"
          ? await sql`select username, role from users where lower(username) = ${value}`
          : await sql`select username, role from users where lower(email) = ${value}`
      const match = lookupRows[0]
      if (match && (match.role === "moderator" || match.role === "admin" || String(match.username).toLowerCase() === "admin")) {
        return NextResponse.json({ error: "Staff and the admin account can't be blacklisted." }, { status: 403 })
      }
    } else {
      // type.data === "ip" — block it if any staff/admin account has ever logged
      // in from this IP (tracked in user_ips), so staff can't accidentally lock
      // themselves (or each other) out.
      const staffIps = await sql`
        select 1 from user_ips ui
        join users u on u.id = ui.user_id
        where ui.ip = ${value}
          and (u.role = 'moderator' or u.role = 'admin' or lower(u.username) = 'admin')
        limit 1
      `
      if (staffIps.length > 0) {
        return NextResponse.json({ error: "Staff and the admin account can't be blacklisted." }, { status: 403 })
      }
    }

    const insertRows = await sql`
      insert into blacklist (type, value, reason, created_by)
      values (${type.data}, ${value}, ${reason}, ${actor.id})
      on conflict (type, value) do update set reason = excluded.reason
      returning id
    `

    // Blacklisting an identifier also removes every account tied to it, and
    // their files — a username/email/IP being bad enough to blacklist means
    // any account using it shouldn't keep existing either.
    const purgedUsernames = await purgeAccountsForBlacklistEntry(type.data, value, actor)
    await logModAction(actor, "blacklist_add", value, reason ?? undefined)

    return NextResponse.json({ ok: true, id: insertRows[0].id, purgedUsernames })
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status })
    console.error("[admin/blacklist POST]", err)
    return NextResponse.json({ error: "Could not add blacklist entry." }, { status: 500 })
  }
}
