import { NextResponse } from "next/server"
import { DeleteObjectCommand } from "@aws-sdk/client-s3"
import { sql } from "@/lib/db"
import { r2, BUCKET_NAME } from "@/lib/r2"
import { requireStaff, AuthError } from "@/lib/auth"

export async function POST(req: Request, { params }: { params: Promise<{ username: string }> }) {
  try {
    const actor = await requireStaff()
    const { username } = await params
    const body = await req.json().catch(() => ({}))
    const reason = typeof body.reason === "string" && body.reason.trim() ? body.reason.trim().slice(0, 500) : null

    const rows = await sql`
      select id, username, email, role, music_object_key, theme_image_key from users
      where lower(username) = ${username.toLowerCase()}
    `
    const target = rows[0]
    if (!target) return NextResponse.json({ error: "User not found." }, { status: 404 })

    const targetIsStaff =
      target.role === "moderator" || target.role === "admin" || String(target.username).toLowerCase() === "admin"
    if (targetIsStaff) {
      return NextResponse.json({ error: "Staff and the admin account can't be banned." }, { status: 403 })
    }

    // Grab everything needed for cleanup / the IP-blacklist prompt before the
    // account row (and everything that cascades from it) is gone.
    const [uploads, images, ipRows] = await Promise.all([
      sql`select object_key from uploads where user_id = ${target.id}`,
      sql`select object_key from image_moderation where user_id = ${target.id}`,
      sql`select ip from user_ips where user_id = ${target.id}`,
    ])

    const keysToDelete = [
      ...uploads.map((u) => u.object_key as string),
      ...images.map((i) => i.object_key as string),
    ]
    if (target.music_object_key) keysToDelete.push(target.music_object_key as string)
    if (target.theme_image_key) keysToDelete.push(target.theme_image_key as string)

    for (const key of keysToDelete) {
      try {
        await r2.send(new DeleteObjectCommand({ Bucket: BUCKET_NAME, Key: key }))
      } catch (e) {
        console.error("[admin/ban] r2 delete failed:", key, e)
      }
    }

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

    // uploads.user_id is ON DELETE SET NULL (not cascade), so their links have to
    // be removed explicitly — otherwise the rows would survive as orphaned entries.
    await sql`delete from uploads where user_id = ${target.id}`

    // Deletes the account itself — cascades to sessions, trusted_devices,
    // verification_codes, image_moderation, and user_ips via their FK
    // constraints. Donations are kept (their user_id just becomes null) so
    // past leaderboard totals aren't silently rewritten.
    await sql`delete from users where id = ${target.id}`

    return NextResponse.json({ ok: true, ips: ipRows.map((r) => r.ip as string) })
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status })
    console.error("[admin/users/:username/ban]", err)
    return NextResponse.json({ error: "Could not ban user." }, { status: 500 })
  }
}
