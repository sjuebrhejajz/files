import { NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireAdmin, AuthError } from "@/lib/auth"
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
    await requireAdmin()
    const rows = await sql`select id, name, image_key, created_at from custom_badges order by created_at desc`
    return NextResponse.json({
      badges: rows.map((r) => ({ id: r.id, name: r.name, imageUrl: `/a/${r.image_key}`, createdAt: r.created_at })),
    })
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status })
    console.error("[admin/badges GET]", err)
    return NextResponse.json({ error: "Could not load badges." }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const admin = await requireAdmin()
    const body = await req.json()
    const name = String(body.name ?? "").trim().slice(0, 40)
    const key = String(body.key ?? "")

    if (!name) return NextResponse.json({ error: "Badge name is required." }, { status: 400 })
    if (!key.startsWith(`badges/${admin.id}-`)) {
      return NextResponse.json({ error: "Invalid upload key." }, { status: 400 })
    }

    const rows = await sql`
      insert into custom_badges (name, image_key, created_by)
      values (${name}, ${key}, ${admin.id})
      returning id
    `
    await logModAction(admin, "badge_create", name)
    return NextResponse.json({ ok: true, id: rows[0].id })
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status })
    console.error("[admin/badges POST]", err)
    return NextResponse.json({ error: "Could not create badge." }, { status: 500 })
  }
}
