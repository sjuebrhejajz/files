import { NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireCurrentUser, AuthError, hashPassword, verifyPassword } from "@/lib/auth"
import { usernameSchema, passwordSchema } from "@/lib/validators"

export async function PATCH(req: Request) {
  try {
    const user = await requireCurrentUser()
    const body = await req.json()

    // ---- username ----
    if (typeof body.username === "string") {
      const parsed = usernameSchema.safeParse(body.username)
      if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })

      const taken = await sql`
        select id from users where lower(username) = ${parsed.data.toLowerCase()} and id != ${user.id}
      `
      if (taken.length > 0) return NextResponse.json({ error: "This username is already taken." }, { status: 409 })

      await sql`update users set username = ${parsed.data} where id = ${user.id}`
    }

    // ---- password ----
    if (typeof body.newPassword === "string") {
      const parsed = passwordSchema.safeParse(body.newPassword)
      if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })

      const rows = await sql`select password_hash from users where id = ${user.id}`
      const valid = await verifyPassword(String(body.currentPassword ?? ""), rows[0].password_hash)
      if (!valid) return NextResponse.json({ error: "Current password is incorrect." }, { status: 401 })

      const passwordHash = await hashPassword(parsed.data)
      await sql`update users set password_hash = ${passwordHash} where id = ${user.id}`
    }

    // ---- profile picture ----
    if (typeof body.profilePictureUrl === "string") {
      await sql`update users set profile_picture_url = ${body.profilePictureUrl} where id = ${user.id}`
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status })
    console.error("[user/settings]", err)
    return NextResponse.json({ error: "Could not update settings." }, { status: 500 })
  }
}
