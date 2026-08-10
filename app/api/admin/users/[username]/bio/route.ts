import { NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireStaff, AuthError } from "@/lib/auth"
import { bioSchemaUnfiltered } from "@/lib/validators"
import { logModAction } from "@/lib/mod-log"

// SECURITY: explicit, independent of the Cache-Control header middleware.ts
// also sets on all /api/admin/* and /api/user/* routes.
export const dynamic = "force-dynamic"

export async function POST(req: Request, { params }: { params: Promise<{ username: string }> }) {
  try {
    const actor = await requireStaff()
    const { username } = await params
    const body = await req.json()

    // No content-word filter here on purpose — this is staff deliberately
    // overriding a user's bio, not the user setting their own.
    const parsed = bioSchemaUnfiltered.safeParse(body.bio ?? "")
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })

    const rows = await sql`select id, bio from users where lower(username) = ${username.toLowerCase()}`
    const target = rows[0]
    if (!target) return NextResponse.json({ error: "User not found." }, { status: 404 })

    await sql`update users set bio = ${parsed.data || null} where id = ${target.id}`
    await logModAction(actor, "force_bio_edit", username, parsed.data ? undefined : "cleared")

    return NextResponse.json({ ok: true, bio: parsed.data || null })
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status })
    console.error("[admin/users/:username/bio]", err)
    return NextResponse.json({ error: "Could not update bio." }, { status: 500 })
  }
}
