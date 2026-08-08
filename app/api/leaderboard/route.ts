import { NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireCurrentUser, AuthError } from "@/lib/auth"

// SECURITY: this is auth-gated ("only visible after login") but sits outside
// /api/admin/* and /api/user/*, so it wasn't covered by the Cache-Control
// fix in middleware.ts. Explicit here since it can't rely on that broad
// prefix match. Low-sensitivity data (top donor usernames), but the "only
// after login" gate itself should actually hold regardless.
export const dynamic = "force-dynamic"

export async function GET() {
  try {
    await requireCurrentUser() // leaderboard is only visible after login

    const rows = await sql`
      select u.username, u.profile_picture_url, u.role, sum(d.amount_cents) as total_cents
      from donations d
      join users u on u.id = d.user_id
      group by u.id, u.username, u.profile_picture_url, u.role
      order by total_cents desc
      limit 3
    `
    const res = NextResponse.json({ leaderboard: rows })
    res.headers.set("Cache-Control", "no-store, private")
    return res
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status })
    console.error("[leaderboard]", err)
    return NextResponse.json({ error: "Could not load leaderboard." }, { status: 500 })
  }
}
