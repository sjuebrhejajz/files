import { NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireCurrentUser, AuthError } from "@/lib/auth"
import { emailSchema } from "@/lib/validators"
import { createUserCode } from "@/lib/codes"
import { sendVerificationEmail } from "@/lib/email"

export async function POST(req: Request) {
  try {
    const user = await requireCurrentUser()
    const body = await req.json()
    const parsed = emailSchema.safeParse(body.newEmail)
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })

    const taken = await sql`select id from users where email = ${parsed.data} and id != ${user.id}`
    if (taken.length > 0) return NextResponse.json({ error: "This email is already in use." }, { status: 409 })

    const code = await createUserCode(user.id, "email_change", parsed.data, { newEmail: parsed.data })
    await sendVerificationEmail(parsed.data, code, "email_change")

    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status })
    console.error("[user/settings/email]", err)
    return NextResponse.json({ error: "Could not start email change." }, { status: 500 })
  }
}
