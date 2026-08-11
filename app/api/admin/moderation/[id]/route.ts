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

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireStaff()
    const { id } = await params
    const body = await req.json()
    const action = body.action
    if (action !== "approve" && action !== "deny" && action !== "ban") {
      return NextResponse.json({ error: "Invalid action." }, { status: 400 })
    }
    const reason = typeof body.reason === "string" && body.reason.trim() ? body.reason.trim().slice(0, 500) : null

    const rows = await sql`
      select m.id, m.kind, m.object_key, m.user_id, u.username, u.email, u.role
      from image_moderation m
      join users u on u.id = m.user_id
      where m.id = ${id}
    `
    const item = rows[0]
    if (!item) return NextResponse.json({ error: "Not found." }, { status: 404 })

    const targetIsStaff =
      item.role === "moderator" || item.role === "admin" || item.role === "owner" || String(item.username).toLowerCase() === "admin"

    // Whitelist protection: staff and the admin account can never be banned this way.
    // (Approve/deny are non-punitive and stay allowed regardless.)
    if (action === "ban" && targetIsStaff) {
      return NextResponse.json({ error: "Staff and the admin account can't be banned." }, { status: 403 })
    }

    if (action === "approve") {
      await sql`
        update image_moderation set status = 'approved', reason = null, reviewed_by = ${actor.id}, reviewed_at = now()
        where id = ${id}
      `
      // Supersede any other approved submission of the same kind for this user
      // so the queue/history doesn't carry two "approved" rows at once.
      await sql`
        update image_moderation set status = 'denied', reason = 'Superseded by a newer approval'
        where user_id = ${item.user_id} and kind = ${item.kind} and status = 'approved' and id != ${id}
      `
      const url = `/a/${item.object_key}`
      if (item.kind === "avatar") {
        await sql`update users set profile_picture_url = ${url} where id = ${item.user_id}`
      } else {
        await sql`update users set banner_url = ${url} where id = ${item.user_id}`
      }
      await logModAction(actor, "image_approve", item.username as string, `kind: ${item.kind}`)
    } else if (action === "deny") {
      await sql`
        update image_moderation set status = 'denied', reason = ${reason}, reviewed_by = ${actor.id}, reviewed_at = now()
        where id = ${id}
      `
      await logModAction(actor, "image_deny", item.username as string, reason ?? `kind: ${item.kind}`)
    } else {
      // ban: blacklisting the account now also purges it entirely (files +
      // account row) — see lib/purge-account.ts — so this isn't just "deny
      // this one image" anymore, it removes the whole account.
      const banReason = reason ?? "Banned via moderation queue"
      await sql`
        insert into blacklist (type, value, reason, created_by)
        values ('username', ${String(item.username).toLowerCase()}, ${banReason}, ${actor.id})
        on conflict (type, value) do nothing
      `
      await sql`
        insert into blacklist (type, value, reason, created_by)
        values ('email', ${String(item.email).toLowerCase()}, ${banReason}, ${actor.id})
        on conflict (type, value) do nothing
      `
      const bannedUsername = item.username as string
      await purgeAccount(item.user_id as string)
      await logModAction(actor, "ban_user", bannedUsername, `via moderation queue — ${banReason}`)
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status })
    console.error("[admin/moderation/:id]", err)
    return NextResponse.json({ error: "Could not update moderation item." }, { status: 500 })
  }
}
