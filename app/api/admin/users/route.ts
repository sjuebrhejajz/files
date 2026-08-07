import { NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireStaff, AuthError } from "@/lib/auth"

export async function GET(req: Request) {
  try {
    await requireStaff()
    const { searchParams } = new URL(req.url)
    const q = (searchParams.get("q") ?? "").trim()

    const rows = q
      ? await sql`
          select id, username, email, role, two_fa_enabled, created_at
          from users
          where username ilike ${"%" + q + "%"} or email ilike ${"%" + q + "%"}
          order by created_at desc
          limit 100
        `
      : await sql`
          select id, username, email, role, two_fa_enabled, created_at
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
