import { sql } from "@/lib/db"
import { verifyPassword, AuthError, type PublicUser } from "@/lib/auth"
import { verifyTotpToken } from "@/lib/totp"

/**
 * Re-verifies the account's current password, and — if 2FA is enabled — a
 * fresh 2FA code, before allowing a sensitive change (username, password,
 * email). Throws AuthError (401) on any failure; callers just need to await
 * it before making the change.
 */
export async function requireReauth(user: PublicUser, body: { currentPassword?: unknown; code?: unknown }): Promise<void> {
  const password = typeof body.currentPassword === "string" ? body.currentPassword : ""
  if (!password) throw new AuthError("Enter your current password.", 401)

  const rows = await sql`select password_hash, two_fa_enabled, two_fa_secret from users where id = ${user.id}`
  const row = rows[0]
  if (!row) throw new AuthError("Account not found.", 404)

  const validPassword = await verifyPassword(password, row.password_hash as string)
  if (!validPassword) throw new AuthError("Current password is incorrect.", 401)

  if (row.two_fa_enabled) {
    const code = typeof body.code === "string" ? body.code : ""
    const secret = row.two_fa_secret as string | null
    if (!code || !secret || !verifyTotpToken(code, secret)) {
      throw new AuthError("Enter a valid 2FA code.", 401)
    }
  }
}
