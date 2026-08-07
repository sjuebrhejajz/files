import { NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { emailSchema } from "@/lib/validators"
import { createRegistrationCode } from "@/lib/codes"
import { sendVerificationEmail } from "@/lib/email"
import { isBlacklisted, getClientIp } from "@/lib/blacklist"

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const parsed = emailSchema.safeParse(body.email)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
    }
    const email = parsed.data

    const ip = getClientIp(req)
    if (await isBlacklisted({ ip, email })) {
      return NextResponse.json({ error: "Registration is not available for this account." }, { status: 403 })
    }

    const existing = await sql`select id from users where email = ${email}`
    if (existing.length > 0) {
      return NextResponse.json({ error: "An account with this email already exists." }, { status: 409 })
    }

    const code = await createRegistrationCode(email)
    await sendVerificationEmail(email, code, "register")

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("[register/start]", err)
    return NextResponse.json({ error: "Could not start registration." }, { status: 500 })
  }
}
