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

    const check = await verifyUserCode(user.id, "phone_2fa", parsed.data)
    if (!check.ok) return NextResponse.json({ error: check.reason }, { status: 400 })

    const phoneNumber = (check.metadata?.phoneNumber as string | undefined) ?? check.destination
    if (!phoneNumber) return NextResponse.json({ error: "Missing phone number, restart setup." }, { status: 400 })

    await sql`
      update users
      set phone_number = ${phoneNumber}, phone_verified = true, two_fa_enabled = true
      where id = ${user.id}
    `

    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status })
    console.error("[2fa/verify]", err)
    return NextResponse.json({ error: "Could not verify code." }, { status: 500 })
  }
}
