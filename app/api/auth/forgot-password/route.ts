import { NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { emailSchema } from "@/lib/validators"
import { createUserCode } from "@/lib/codes"
import { sendVerificationEmail } from "@/lib/email"

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const parsed = emailSchema.safeParse(body.email)
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })

    const rows = await sql`select id from users where email = ${parsed.data}`
    const user = rows[0]

    // Always respond ok — don't reveal whether the email is registered.
    if (user) {
      const code = await createUserCode(user.id as string, "password_reset")
      await sendVerificationEmail(parsed.data, code, "reset")
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("[forgot-password]", err)
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 })
  }
}
