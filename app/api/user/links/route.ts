import { NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireCurrentUser, AuthError } from "@/lib/auth"

export async function GET() {
  try {
    const user = await requireCurrentUser()
    const rows = await sql`
      select id, short_id, filename, content_type, created_at, expires_at
      from uploads
      where user_id = ${user.id}
      order by created_at desc
    `
    const links = rows.map((r) => ({
      id: r.id,
      filename: r.filename,
      url: `/f/${r.short_id}`,
      viewUrl: `/v/${r.short_id}`,
      contentType: r.content_type as string | null,
      created_at: r.created_at,
      expires_at: r.expires_at,
    }))
    return NextResponse.json({ links })
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status })
    console.error("[user/links]", err)
    return NextResponse.json({ error: "Could not load your links." }, { status: 500 })
  }
}
