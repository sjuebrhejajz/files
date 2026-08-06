import { NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireCurrentUser, AuthError } from "@/lib/auth"
import { codeSchema } from "@/lib/validators"
import { verifyTotpToken } from "@/lib/totp"

export async function POST(req: Request) {
  try {
    const user = await requireCurrentUser()
    const body = await req.json()
    const parsed = codeSchema.safeParse(body.code)
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })

    const rows = await sql`select two_fa_secret from users where id = ${user.id}`
    const secret = rows[0]?.two_fa_secret as string | null
    if (!secret) return NextResponse.json({ error: "Start 2FA setup first." }, { status: 400 })

    const valid = verifyTotpToken(parsed.data, secret)
    if (!valid) return NextResponse.json({ error: "Incorrect code." }, { status: 400 })

    await sql`update users set two_fa_enabled = true where id = ${user.id}`

    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status })
    console.error("[2fa/verify]", err)
    return NextResponse.json({ error: "Could not verify code." }, { status: 500 })
  }
}
