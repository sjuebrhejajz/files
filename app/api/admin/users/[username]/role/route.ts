import { NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireAdmin, AuthError } from "@/lib/auth"

export async function POST(req: Request, { params }: { params: Promise<{ username: string }> }) {
  try {
    const actor = await requireAdmin()
    const { username } = await params
    const body = await req.json()
    const action = body.action === "promote" ? "promote" : body.action === "demote" ? "demote" : null
    if (!action) return NextResponse.json({ error: "Invalid action." }, { status: 400 })

    const rows = await sql`select id, username, role from users where lower(username) = ${username.toLowerCase()}`
    const target = rows[0]
    if (!target) return NextResponse.json({ error: "User not found." }, { status: 404 })

    if (target.username.toLowerCase() === "admin" || target.role === "admin") {
      return NextResponse.json({ error: "The admin account's role can't be changed." }, { status: 403 })
    }
    if (target.id === actor.id) {
      return NextResponse.json({ error: "You can't change your own role." }, { status: 400 })
    }

    if (action === "promote") {
      if (target.role !== "user") {
        return NextResponse.json({ error: "Only regular users can be promoted." }, { status: 400 })
      }
      await sql`update users set role = 'moderator' where id = ${target.id}`
    } else {
      if (target.role !== "moderator") {
        return NextResponse.json({ error: "Only moderators can be demoted." }, { status: 400 })
      }
      await sql`update users set role = 'user' where id = ${target.id}`
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status })
    console.error("[admin/users/:username/role]", err)
    return NextResponse.json({ error: "Could not update role." }, { status: 500 })
  }
}
