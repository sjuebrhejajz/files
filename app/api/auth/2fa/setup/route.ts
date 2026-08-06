import { NextResponse } from "next/server"
import { requireCurrentUser, AuthError } from "@/lib/auth"
import { phoneSchema } from "@/lib/validators"
import { createUserCode } from "@/lib/codes"
import { sendSmsCode } from "@/lib/sms"

export async function POST(req: Request) {
  try {
    const user = await requireCurrentUser()
    const body = await req.json()
    const parsed = phoneSchema.safeParse(body.phoneNumber)
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })

    const code = await createUserCode(user.id, "phone_2fa", parsed.data, { phoneNumber: parsed.data })
    await sendSmsCode(parsed.data, code)

    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status })
    console.error("[2fa/setup]", err)
    return NextResponse.json({ error: "Could not send code." }, { status: 500 })
  }
}
