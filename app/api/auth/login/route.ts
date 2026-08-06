import { NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { verifyPassword, createSession, isDeviceTrusted } from "@/lib/auth"
import { createUserCode } from "@/lib/codes"
import { sendSmsCode } from "@/lib/sms"
import { createLoginTicket } from "@/lib/ticket"

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const identifier = String(body.identifier ?? "").trim().toLowerCase()
    const password = String(body.password ?? "")
    const remember = Boolean(body.remember)

    if (!identifier || !password) {
      return NextResponse.json({ error: "Enter your email/username and password." }, { status: 400 })
    }

    const rows = await sql`
      select id, password_hash, two_fa_enabled, phone_number
      from users
      where email = ${identifier} or lower(username) = ${identifier}
    `
    const user = rows[0]

    // Generic error message on purpose — don't reveal whether the account exists.
    const invalid = () => NextResponse.json({ error: "Incorrect email/username or password." }, { status: 401 })
    if (!user) return invalid()

    const valid = await verifyPassword(password, user.password_hash)
    if (!valid) return invalid()

    if (user.two_fa_enabled) {
      const trusted = await isDeviceTrusted(user.id)
      if (!trusted) {
        const code = await createUserCode(user.id, "login_2fa")
        await sendSmsCode(user.phone_number as string, code)
        const ticket = createLoginTicket(user.id)
        return NextResponse.json({ requires2fa: true, ticket })
      }
    }

    await createSession(user.id, remember)
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("[login]", err)
    return NextResponse.json({ error: "Could not log in." }, { status: 500 })
  }
}
