import { NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { emailSchema, codeSchema, passwordSchema } from "@/lib/validators"
import { verifyUserCode } from "@/lib/codes"
import { hashPassword } from "@/lib/auth"

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const email = emailSchema.safeParse(body.email)
    const code = codeSchema.safeParse(body.code)
    const password = passwordSchema.safeParse(body.newPassword)

    for (const parsed of [email, code, password]) {
      if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
    }
    if (!email.success || !code.success || !password.success) {
      return NextResponse.json({ error: "Invalid input." }, { status: 400 })
    }

    const rows = await sql`select id from users where email = ${email.data}`
    const user = rows[0]
    if (!user) return NextResponse.json({ error: "Invalid code." }, { status: 400 })

    const check = await verifyUserCode(user.id as string, "password_reset", code.data)
    if (!check.ok) return NextResponse.json({ error: check.reason }, { status: 400 })

    const passwordHash = await hashPassword(password.data)
    await sql`update users set password_hash = ${passwordHash} where id = ${user.id}`
    // Invalidate all existing sessions on password reset, for safety.
    await sql`delete from sessions where user_id = ${user.id}`

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("[reset-password]", err)
    return NextResponse.json({ error: "Could not reset password." }, { status: 500 })
  }
}
