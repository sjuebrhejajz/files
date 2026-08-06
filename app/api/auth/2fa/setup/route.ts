import { NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireCurrentUser, AuthError } from "@/lib/auth"
import { generateTotpSecret, generateTotpQrCode } from "@/lib/totp"

export async function POST() {
  try {
    const user = await requireCurrentUser()
    const secret = generateTotpSecret()

    // Store the secret but leave 2FA disabled until the user confirms a code from their app.
    await sql`update users set two_fa_secret = ${secret}, two_fa_enabled = false where id = ${user.id}`

    const qrCode = await generateTotpQrCode(user.email, secret)

    return NextResponse.json({ ok: true, qrCode, secret })
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status })
    console.error("[2fa/setup]", err)
    return NextResponse.json({ error: "Could not start 2FA setup." }, { status: 500 })
  }
}
