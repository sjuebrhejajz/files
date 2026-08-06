import { NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireCurrentUser, AuthError, verifyPassword } from "@/lib/auth"

export async function POST(req: Request) {
  try {
    const user = await requireCurrentUser()
    const body = await req.json()
    const password = String(body.password ?? "")

    const rows = await sql`select password_hash from users where id = ${user.id}`
    const valid = await verifyPassword(password, rows[0].password_hash)
    if (!valid) return NextResponse.json({ error: "Incorrect password." }, { status: 401 })

    await sql`update users set two_fa_enabled = false where id = ${user.id}`
    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status })
    console.error("[2fa/disable]", err)
    return NextResponse.json({ error: "Could not disable 2FA." }, { status: 500 })
  }
}
