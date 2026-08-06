import { NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireCurrentUser, AuthError } from "@/lib/auth"
import { codeSchema } from "@/lib/validators"
import { verifyUserCode } from "@/lib/codes"

export async function POST(req: Request) {
  try {
    const user = await requireCurrentUser()
    const body = await req.json()
    const parsed = codeSchema.safeParse(body.code)
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })

    const check = await verifyUserCode(user.id, "email_change", parsed.data)
    if (!check.ok) return NextResponse.json({ error: check.reason }, { status: 400 })

    const newEmail = (check.metadata?.newEmail as string | undefined) ?? check.destination
    if (!newEmail) return NextResponse.json({ error: "Missing new email, restart the change." }, { status: 400 })

    const taken = await sql`select id from users where email = ${newEmail} and id != ${user.id}`
    if (taken.length > 0) return NextResponse.json({ error: "This email is already in use." }, { status: 409 })

    await sql`update users set email = ${newEmail} where id = ${user.id}`
    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status })
    console.error("[user/settings/email/verify]", err)
    return NextResponse.json({ error: "Could not confirm email change." }, { status: 500 })
  }
}
