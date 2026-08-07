import { NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireCurrentUser, AuthError, hashPassword, verifyPassword } from "@/lib/auth"
import { usernameSchema, passwordSchema, bioSchema } from "@/lib/validators"
import { isBlacklisted } from "@/lib/blacklist"

export async function PATCH(req: Request) {
  try {
    const user = await requireCurrentUser()
    const body = await req.json()

    // ---- username ----
    if (typeof body.username === "string") {
      const parsed = usernameSchema.safeParse(body.username)
      if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })

      if (await isBlacklisted({ username: parsed.data })) {
        return NextResponse.json({ error: "This username is blacklisted." }, { status: 403 })
      }

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

    // ---- bio (no links allowed) ----
    if (typeof body.bio === "string") {
      const parsed = bioSchema.safeParse(body.bio)
      if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
      await sql`update users set bio = ${parsed.data || null} where id = ${user.id}`
    }

    // ---- "make my uploaded links public" toggle ----
    if (typeof body.linksPublic === "boolean") {
      await sql`update users set links_public = ${body.linksPublic} where id = ${user.id}`
    }

    // Note: profile pictures and banners are no longer set directly here.
    // They go through /api/user/settings/avatar-url (or banner-url) to get a
    // presigned upload, then /api/user/settings/image to enter the
    // moderation queue — see app/api/admin/moderation for the review step.

    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status })
    console.error("[user/settings]", err)
    return NextResponse.json({ error: "Could not update settings." }, { status: 500 })
  }
}
