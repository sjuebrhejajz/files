import { NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireCurrentUser, AuthError } from "@/lib/auth"

export async function GET() {
  try {
    const user = await requireCurrentUser()
    const rows = await sql`select discord_username, discord_avatar_url from users where id = ${user.id}`
    const row = rows[0]
    return NextResponse.json({
      connected: Boolean(row?.discord_username),
      username: row?.discord_username ?? null,
      avatarUrl: row?.discord_avatar_url ?? null,
    })
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status })
    console.error("[user/settings/discord GET]", err)
    return NextResponse.json({ error: "Could not load Discord status." }, { status: 500 })
  }
}

export async function DELETE() {
  try {
    const user = await requireCurrentUser()
    await sql`update users set discord_id = null, discord_username = null, discord_avatar_url = null where id = ${user.id}`
    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status })
    console.error("[user/settings/discord DELETE]", err)
    return NextResponse.json({ error: "Could not disconnect Discord." }, { status: 500 })
  }
}
