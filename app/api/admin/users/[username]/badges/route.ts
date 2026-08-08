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

export async function GET(_req: Request, { params }: { params: Promise<{ username: string }> }) {
  try {
    await requireAdmin()
    const { username } = await params

    const rows = await sql`
      select cb.id, cb.name, cb.image_key
      from user_badges ub
      join custom_badges cb on cb.id = ub.badge_id
      join users u on u.id = ub.user_id
      where lower(u.username) = ${username.toLowerCase()}
      order by ub.granted_at asc
    `
    return NextResponse.json({ badges: rows.map((r) => ({ id: r.id, name: r.name, imageUrl: `/a/${r.image_key}` })) })
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status })
    console.error("[admin/users/:username/badges GET]", err)
    return NextResponse.json({ error: "Could not load badges." }, { status: 500 })
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ username: string }> }) {
  try {
    const admin = await requireAdmin()
    const { username } = await params
    const body = await req.json()
    const badgeId = String(body.badgeId ?? "")
    if (!badgeId) return NextResponse.json({ error: "Missing badgeId." }, { status: 400 })

    const userRows = await sql`select id from users where lower(username) = ${username.toLowerCase()}`
    const targetId = userRows[0]?.id as string | undefined
    if (!targetId) return NextResponse.json({ error: "User not found." }, { status: 404 })

    const badgeRows = await sql`select name from custom_badges where id = ${badgeId}`
    const badgeName = badgeRows[0]?.name as string | undefined

    await sql`
      insert into user_badges (user_id, badge_id, granted_by)
      values (${targetId}, ${badgeId}, ${admin.id})
      on conflict (user_id, badge_id) do nothing
    `
    await logModAction(admin, "badge_grant", username, badgeName ? `badge: ${badgeName}` : undefined)
    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status })
    console.error("[admin/users/:username/badges POST]", err)
    return NextResponse.json({ error: "Could not grant badge." }, { status: 500 })
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ username: string }> }) {
  try {
    const admin = await requireAdmin()
    const { username } = await params
    const { searchParams } = new URL(req.url)
    const badgeId = searchParams.get("badgeId")
    if (!badgeId) return NextResponse.json({ error: "Missing badgeId." }, { status: 400 })

    const userRows = await sql`select id from users where lower(username) = ${username.toLowerCase()}`
    const targetId = userRows[0]?.id as string | undefined
    if (!targetId) return NextResponse.json({ error: "User not found." }, { status: 404 })

    const badgeRows = await sql`select name from custom_badges where id = ${badgeId}`
    const badgeName = badgeRows[0]?.name as string | undefined

    await sql`delete from user_badges where user_id = ${targetId} and badge_id = ${badgeId}`
    await logModAction(admin, "badge_revoke", username, badgeName ? `badge: ${badgeName}` : undefined)
    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status })
    console.error("[admin/users/:username/badges DELETE]", err)
    return NextResponse.json({ error: "Could not revoke badge." }, { status: 500 })
  }
}
