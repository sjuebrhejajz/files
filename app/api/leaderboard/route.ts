import { NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireCurrentUser, AuthError } from "@/lib/auth"

export async function GET() {
  try {
    await requireCurrentUser() // leaderboard is only visible after login

    const rows = await sql`
      select u.username, u.profile_picture_url, sum(d.amount_cents) as total_cents
      from donations d
      join users u on u.id = d.user_id
      group by u.id, u.username, u.profile_picture_url
      order by total_cents desc
      limit 3
    `
    return NextResponse.json({ leaderboard: rows })
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status })
    console.error("[leaderboard]", err)
    return NextResponse.json({ error: "Could not load leaderboard." }, { status: 500 })
  }
}
