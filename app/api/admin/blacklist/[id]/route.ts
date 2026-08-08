import { NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireStaff, AuthError } from "@/lib/auth"
import { logModAction } from "@/lib/mod-log"

// SECURITY: explicit, independent of the Cache-Control header middleware.ts
// also sets on all /api/admin/* and /api/user/* routes. This stops Next.js
// from ever treating the route as cacheable in the first place. Added after
// confirming an admin-only endpoint's response was being served to a
// signed-out incognito request — nothing here previously told Next.js this
// data depends on who's asking.
export const dynamic = "force-dynamic"

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireStaff()
    const { id } = await params

    const rows = await sql`select type, value from blacklist where id = ${id}`
    const entry = rows[0]

    await sql`delete from blacklist where id = ${id}`

    if (entry) {
      await logModAction(actor, "blacklist_remove", String(entry.value), `type: ${entry.type}`)
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status })
    console.error("[admin/blacklist/:id]", err)
    return NextResponse.json({ error: "Could not remove blacklist entry." }, { status: 500 })
  }
}
