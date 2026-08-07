import { NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireStaff, isAdmin, AuthError } from "@/lib/auth"
import { usernameSchema } from "@/lib/validators"
import { isBlacklisted } from "@/lib/blacklist"

export async function POST(req: Request, { params }: { params: Promise<{ username: string }> }) {
  try {
    const actor = await requireStaff()
    const { username } = await params
    const body = await req.json()

    const parsed = usernameSchema.safeParse(body.username)
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
    const newUsername = parsed.data

    const rows = await sql`select id, username, role from users where lower(username) = ${username.toLowerCase()}`
    const target = rows[0]
    if (!target) return NextResponse.json({ error: "User not found." }, { status: 404 })

    if (String(target.username).toLowerCase() === "admin") {
      return NextResponse.json({ error: "The admin account's username can't be changed." }, { status: 403 })
    }
    // Moderators can rename regular users; only an admin can rename another staff account.
    if (target.role !== "user" && !isAdmin(actor)) {
      return NextResponse.json({ error: "Only admins can rename staff accounts." }, { status: 403 })
    }

    if (await isBlacklisted({ username: newUsername })) {
      return NextResponse.json({ error: "This username is blacklisted." }, { status: 403 })
    }

    const taken = await sql`select id from users where lower(username) = ${newUsername.toLowerCase()} and id != ${target.id}`
    if (taken.length > 0) return NextResponse.json({ error: "This username is already taken." }, { status: 409 })

    await sql`update users set username = ${newUsername} where id = ${target.id}`

    return NextResponse.json({ ok: true, username: newUsername })
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status })
    console.error("[admin/users/:username/username]", err)
    return NextResponse.json({ error: "Could not rename user." }, { status: 500 })
  }
}
