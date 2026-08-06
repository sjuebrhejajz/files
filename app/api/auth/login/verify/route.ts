import { NextResponse } from "next/server"
import { codeSchema } from "@/lib/validators"
import { verifyUserCode } from "@/lib/codes"
import { createSession, markDeviceTrusted } from "@/lib/auth"
import { verifyLoginTicket } from "@/lib/ticket"

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const code = codeSchema.safeParse(body.code)
    const ticket = String(body.ticket ?? "")
    const remember = Boolean(body.remember)

    if (!code.success) return NextResponse.json({ error: code.error.issues[0].message }, { status: 400 })

    const claim = verifyLoginTicket(ticket)
    if (!claim) return NextResponse.json({ error: "This login attempt expired. Please log in again." }, { status: 401 })

    const check = await verifyUserCode(claim.userId, "login_2fa", code.data)
    if (!check.ok) return NextResponse.json({ error: check.reason }, { status: 400 })

    await createSession(claim.userId, remember)
    if (remember) await markDeviceTrusted(claim.userId)

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("[login/verify]", err)
    return NextResponse.json({ error: "Could not verify code." }, { status: 500 })
  }
}
