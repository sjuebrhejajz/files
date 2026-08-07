import { NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireCurrentUser, AuthError } from "@/lib/auth"

export async function GET() {
  try {
    const user = await requireCurrentUser()
    const rows = await sql`
      select kind, status, reason from image_moderation
      where user_id = ${user.id} and kind in ('avatar', 'banner')
      order by created_at desc
    `
    // Most recent row per kind — used by the settings page to show
    // "pending review" / "denied: <reason>" banners.
    const latest: Record<string, { status: string; reason: string | null }> = {}
    for (const row of rows) {
      const kind = row.kind as string
      if (!latest[kind]) latest[kind] = { status: row.status as string, reason: row.reason as string | null }
    }
    return NextResponse.json(latest)
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status })
    console.error("[user/settings/image GET]", err)
    return NextResponse.json({ error: "Could not load image status." }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireCurrentUser()
    const body = await req.json()
    const kind = body.kind === "avatar" || body.kind === "banner" ? body.kind : null
    const key = String(body.key ?? "")

    if (!kind) return NextResponse.json({ error: "Invalid image kind." }, { status: 400 })

    const prefix = kind === "avatar" ? "avatars/" : "banners/"
    if (!key.startsWith(`${prefix}${user.id}-`)) {
      return NextResponse.json({ error: "Invalid upload key." }, { status: 400 })
    }

    // Superseding any earlier still-pending submission of the same kind keeps the
    // moderation queue from accumulating duplicates from repeated re-uploads.
    await sql`
      update image_moderation set status = 'denied', reason = 'Superseded by a newer upload'
      where user_id = ${user.id} and kind = ${kind} and status = 'pending'
    `

    const rows = await sql`
      insert into image_moderation (user_id, kind, object_key, status)
      values (${user.id}, ${kind}, ${key}, 'pending')
      returning id
    `

    return NextResponse.json({ ok: true, id: rows[0].id })
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status })
    console.error("[user/settings/image POST]", err)
    return NextResponse.json({ error: "Could not submit image for review." }, { status: 500 })
  }
}
