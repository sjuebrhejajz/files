import { NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { emailSchema, usernameSchema, passwordSchema, codeSchema } from "@/lib/validators"
import { verifyRegistrationCode, deleteRegistrationCode } from "@/lib/codes"
import { hashPassword, createSession } from "@/lib/auth"
import { isBlacklisted, getClientIp } from "@/lib/blacklist"

export async function POST(req: Request) {
  try {
    const body = await req.json()

    const email = emailSchema.safeParse(body.email)
    const code = codeSchema.safeParse(body.code)
    const username = usernameSchema.safeParse(body.username)
    const password = passwordSchema.safeParse(body.password)

    for (const parsed of [email, code, username, password]) {
      if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
    }
    if (!email.success || !code.success || !username.success || !password.success) {
      return NextResponse.json({ error: "Invalid input." }, { status: 400 })
    }

    const check = await verifyRegistrationCode(email.data, code.data)
    if (!check.ok) return NextResponse.json({ error: check.reason }, { status: 400 })

    const ip = getClientIp(req)
    if (await isBlacklisted({ ip, username: username.data, email: email.data })) {
      return NextResponse.json({ error: "Registration is not available for this account." }, { status: 403 })
    }

    // Re-check uniqueness right before insert (race-condition guard).
    const [emailTaken, usernameTaken] = await Promise.all([
      sql`select id from users where email = ${email.data}`,
      sql`select id from users where lower(username) = ${username.data.toLowerCase()}`,
    ])
    if (emailTaken.length > 0) return NextResponse.json({ error: "This email is already registered." }, { status: 409 })
    if (usernameTaken.length > 0) return NextResponse.json({ error: "This username is already taken." }, { status: 409 })

    const passwordHash = await hashPassword(password.data)

    const rows = await sql`
      insert into users (email, username, password_hash, email_verified)
      values (${email.data}, ${username.data}, ${passwordHash}, true)
      returning id
    `
    const userId = rows[0].id as string

    await deleteRegistrationCode(email.data)
    await createSession(userId, false)

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("[register/verify]", err)
    return NextResponse.json({ error: "Could not complete registration." }, { status: 500 })
  }
}
