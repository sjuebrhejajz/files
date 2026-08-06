import { createHmac, timingSafeEqual } from "crypto"

const SECRET = process.env.AUTH_SECRET
if (!SECRET) {
  throw new Error("AUTH_SECRET is not set. Add a long random string in your Vercel env vars.")
}

const TICKET_TTL_MS = 10 * 60 * 1000 // 10 minutes, matches the verification code TTL

/** Creates a signed, tamper-proof, short-lived ticket carrying a userId — used between "login" and "verify 2FA code". */
export function createLoginTicket(userId: string) {
  const payload = JSON.stringify({ userId, exp: Date.now() + TICKET_TTL_MS })
  const encoded = Buffer.from(payload).toString("base64url")
  const sig = createHmac("sha256", SECRET as string).update(encoded).digest("base64url")
  return `${encoded}.${sig}`
}

export function verifyLoginTicket(ticket: string): { userId: string } | null {
  const [encoded, sig] = ticket.split(".")
  if (!encoded || !sig) return null

  const expectedSig = createHmac("sha256", SECRET as string).update(encoded).digest("base64url")
  const a = Buffer.from(sig)
  const b = Buffer.from(expectedSig)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null

  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"))
    if (typeof payload.userId !== "string" || typeof payload.exp !== "number") return null
    if (Date.now() > payload.exp) return null
    return { userId: payload.userId }
  } catch {
    return null
  }
}
