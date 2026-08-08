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
    const q = (searchParams.get("q") ?? "").trim()

    const rows = q
      ? await sql`
          select id, username, email, role, is_donator, two_fa_enabled, created_at
          from users
          where username ilike ${"%" + q + "%"} or email ilike ${"%" + q + "%"}
          order by created_at desc
          limit 100
        `
      : await sql`
          select id, username, email, role, is_donator, two_fa_enabled, created_at
          from users
          order by created_at desc
          limit 100
        `

    return NextResponse.json({ users: rows })
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status })
    console.error("[admin/users]", err)
    return NextResponse.json({ error: "Could not load users." }, { status: 500 })
  }
}
