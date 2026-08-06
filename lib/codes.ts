import { createHash, randomInt } from "crypto"
import { sql } from "@/lib/db"

export type CodePurpose = "login_2fa" | "password_reset" | "phone_2fa" | "email_change"

const CODE_TTL_MINUTES = 10
const MAX_ATTEMPTS = 5

export function generateCode() {
  // 6-digit numeric code, zero-padded
  return String(randomInt(0, 1_000_000)).padStart(6, "0")
}

function hashCode(code: string) {
  return createHash("sha256").update(code).digest("hex")
}

/** Creates a pending registration row (email not yet a real account) and returns the plaintext code. */
export async function createRegistrationCode(email: string) {
  const code = generateCode()
  const codeHash = hashCode(code)
  const expiresAt = new Date(Date.now() + CODE_TTL_MINUTES * 60 * 1000)

  await sql`
    insert into pending_registrations (email, code_hash, expires_at, attempts)
    values (${email}, ${codeHash}, ${expiresAt.toISOString()}, 0)
    on conflict (email) do update
      set code_hash = excluded.code_hash, expires_at = excluded.expires_at, attempts = 0, created_at = now()
  `
  return code
}

export async function verifyRegistrationCode(email: string, code: string) {
  const rows = await sql`select * from pending_registrations where email = ${email}`
  const row = rows[0]
  if (!row) return { ok: false as const, reason: "No pending registration for this email." }
  if (row.attempts >= MAX_ATTEMPTS) return { ok: false as const, reason: "Too many attempts. Request a new code." }
  if (new Date(row.expires_at).getTime() < Date.now()) return { ok: false as const, reason: "Code expired. Request a new one." }

  if (row.code_hash !== hashCode(code)) {
    await sql`update pending_registrations set attempts = attempts + 1 where id = ${row.id}`
    return { ok: false as const, reason: "Incorrect code." }
  }

  return { ok: true as const }
}

export async function deleteRegistrationCode(email: string) {
  await sql`delete from pending_registrations where email = ${email}`
}

/** Creates a verification code tied to an existing user (2FA, password reset, phone verify, email change). */
export async function createUserCode(userId: string, purpose: CodePurpose, destination?: string, metadata?: Record<string, unknown>) {
  const code = generateCode()
  const codeHash = hashCode(code)
  const expiresAt = new Date(Date.now() + CODE_TTL_MINUTES * 60 * 1000)

  await sql`
    insert into verification_codes (user_id, purpose, code_hash, destination, metadata, expires_at)
    values (${userId}, ${purpose}, ${codeHash}, ${destination ?? null}, ${metadata ? JSON.stringify(metadata) : null}, ${expiresAt.toISOString()})
  `
  return code
}

/** For password reset, we don't have a user id yet from the client's perspective (they typed an email). */
export async function findUserCode(purpose: CodePurpose, userId: string) {
  const rows = await sql`
    select * from verification_codes
    where user_id = ${userId} and purpose = ${purpose} and used = false
    order by created_at desc
    limit 1
  `
  return rows[0] ?? null
}

export async function verifyUserCode(userId: string, purpose: CodePurpose, code: string) {
  const row = await findUserCode(purpose, userId)
  if (!row) return { ok: false as const, reason: "No pending code. Request a new one." }
  if (row.attempts >= MAX_ATTEMPTS) return { ok: false as const, reason: "Too many attempts. Request a new code." }
  if (new Date(row.expires_at).getTime() < Date.now()) return { ok: false as const, reason: "Code expired. Request a new one." }

  if (row.code_hash !== hashCode(code)) {
    await sql`update verification_codes set attempts = attempts + 1 where id = ${row.id}`
    return { ok: false as const, reason: "Incorrect code." }
  }

  await sql`update verification_codes set used = true where id = ${row.id}`
  return { ok: true as const, metadata: row.metadata as Record<string, unknown> | null, destination: row.destination as string | null }
}
