import { cookies } from "next/headers"
import { randomBytes, createHash } from "crypto"
import bcrypt from "bcryptjs"
import { sql } from "@/lib/db"

export const SESSION_COOKIE = "session_token"
export const DEVICE_COOKIE = "device_token"

const SESSION_DAYS_DEFAULT = 1 // if "remember this device" is not checked, session lasts 1 day
const SESSION_DAYS_REMEMBERED = 30
const DEVICE_DAYS = 60

export type PublicUser = {
  id: string
  email: string
  username: string
  profile_picture_url: string | null
  two_fa_enabled: boolean
  created_at: string
}

// ---------- password hashing ----------

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12)
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash)
}

// ---------- generic token helpers ----------

function randomToken(bytes = 32) {
  return randomBytes(bytes).toString("hex")
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex")
}

// ---------- sessions ----------

export async function createSession(userId: string, remember: boolean) {
  const token = randomToken()
  const tokenHash = sha256(token)
  const days = remember ? SESSION_DAYS_REMEMBERED : SESSION_DAYS_DEFAULT
  const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000)

  await sql`
    insert into sessions (token_hash, user_id, expires_at)
    values (${tokenHash}, ${userId}, ${expiresAt.toISOString()})
  `

  const jar = await cookies()
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  })
}

export async function destroySession() {
  const jar = await cookies()
  const token = jar.get(SESSION_COOKIE)?.value
  if (token) {
    await sql`delete from sessions where token_hash = ${sha256(token)}`
  }
  jar.delete(SESSION_COOKIE)
}

export async function getCurrentUser(): Promise<PublicUser | null> {
  const jar = await cookies()
  const token = jar.get(SESSION_COOKIE)?.value
  if (!token) return null

  const rows = await sql`
    select u.id, u.email, u.username, u.profile_picture_url, u.two_fa_enabled, u.created_at
    from sessions s
    join users u on u.id = s.user_id
    where s.token_hash = ${sha256(token)} and s.expires_at > now()
  `
  if (rows.length === 0) return null
  return rows[0] as PublicUser
}

export async function requireCurrentUser(): Promise<PublicUser> {
  const user = await getCurrentUser()
  if (!user) throw new AuthError("Not authenticated", 401)
  return user
}

// ---------- trusted devices (remember this device -> skip 2FA) ----------

export async function markDeviceTrusted(userId: string) {
  const token = randomToken()
  const tokenHash = sha256(token)
  const expiresAt = new Date(Date.now() + DEVICE_DAYS * 24 * 60 * 60 * 1000)

  await sql`
    insert into trusted_devices (user_id, device_token_hash, expires_at)
    values (${userId}, ${tokenHash}, ${expiresAt.toISOString()})
    on conflict (user_id, device_token_hash) do update set expires_at = excluded.expires_at
  `

  const jar = await cookies()
  jar.set(DEVICE_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  })
}

export async function isDeviceTrusted(userId: string) {
  const jar = await cookies()
  const token = jar.get(DEVICE_COOKIE)?.value
  if (!token) return false

  const rows = await sql`
    select 1 from trusted_devices
    where user_id = ${userId} and device_token_hash = ${sha256(token)} and expires_at > now()
  `
  return rows.length > 0
}

// ---------- error helper ----------

export class AuthError extends Error {
  status: number
  constructor(message: string, status = 400) {
    super(message)
    this.status = status
  }
}
