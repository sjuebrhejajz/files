import { NextResponse } from "next/server"
import { DeleteObjectCommand } from "@aws-sdk/client-s3"
import { sql } from "@/lib/db"
import { r2, BUCKET_NAME } from "@/lib/r2"
import { requireStaff, AuthError } from "@/lib/auth"

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
      item.role === "moderator" || item.role === "admin" || String(item.username).toLowerCase() === "admin"

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
    } else if (action === "deny") {
      await sql`
        update image_moderation set status = 'denied', reason = ${reason}, reviewed_by = ${actor.id}, reviewed_at = now()
        where id = ${id}
      `
    } else {
      // ban: mark the image banned, remove the object from storage, and blacklist
      // the account's username + email so they can't re-register, log in, or upload.
      await sql`
        update image_moderation set status = 'banned', reason = ${reason}, reviewed_by = ${actor.id}, reviewed_at = now()
        where id = ${id}
      `
      try {
        await r2.send(new DeleteObjectCommand({ Bucket: BUCKET_NAME, Key: item.object_key }))
      } catch (e) {
        console.error("[admin/moderation] r2 delete failed:", e)
      }
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
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status })
    console.error("[admin/moderation/:id]", err)
    return NextResponse.json({ error: "Could not update moderation item." }, { status: 500 })
  }
}
