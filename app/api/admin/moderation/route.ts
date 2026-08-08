import { NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireStaff, AuthError } from "@/lib/auth"

// SECURITY: explicit, independent of the Cache-Control header middleware.ts
// also sets on all /api/admin/* and /api/user/* routes. This stops Next.js
// from ever treating the route as cacheable in the first place. Added after
// confirming an admin-only endpoint's response was being served to a
// signed-out incognito request — nothing here previously told Next.js this
// data depends on who's asking.
export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  try {
    await requireStaff()
    const { searchParams } = new URL(req.url)
    const status = searchParams.get("status") ?? "pending"

    const rows = await sql`
      select m.id, m.kind, m.object_key, m.status, m.reason, m.created_at,
             u.username, u.id as user_id
      from image_moderation m
      join users u on u.id = m.user_id
      where m.status = ${status}
      order by m.created_at asc
      limit 100
    `

    return NextResponse.json({
      items: rows.map((r) => ({
        id: r.id,
        kind: r.kind,
        previewUrl: `/a/${r.object_key}`,
        status: r.status,
        reason: r.reason,
        createdAt: r.created_at,
        username: r.username,
        userId: r.user_id,
      })),
    })
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status })
    console.error("[admin/moderation GET]", err)
    return NextResponse.json({ error: "Could not load moderation queue." }, { status: 500 })
  }
}
