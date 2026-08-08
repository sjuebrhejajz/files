import { NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireStaff, requireAdmin, AuthError } from "@/lib/auth"

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
      select id, actor_username, action, target, details, created_at
      from moderation_logs
      order by created_at desc
      limit 300
    `
    return NextResponse.json({ logs: rows })
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status })
    console.error("[admin/logs GET]", err)
    return NextResponse.json({ error: "Could not load logs." }, { status: 500 })
  }
}

// Admin-only clear — either a single entry (?id=...) or the whole log (no
// query param). Deliberately not itself logged: clearing the log is the one
// action that shouldn't recreate the thing it just removed.
export async function DELETE(req: Request) {
  try {
    await requireAdmin()
    const { searchParams } = new URL(req.url)
    const id = searchParams.get("id")

    if (id) {
      await sql`delete from moderation_logs where id = ${id}`
    } else {
      await sql`delete from moderation_logs`
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status })
    console.error("[admin/logs DELETE]", err)
    return NextResponse.json({ error: "Could not clear logs." }, { status: 500 })
  }
}
