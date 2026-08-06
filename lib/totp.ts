import { authenticator } from "otplib"
import QRCode from "qrcode"

const ISSUER = "Files"

/** Generates a new base32 TOTP secret for a user setting up 2FA. */
export function generateTotpSecret() {
  return authenticator.generateSecret()
}

/** Checks a 6-digit code from the user's authenticator app against their stored secret. */
export function verifyTotpToken(token: string, secret: string) {
  try {
    return authenticator.verify({ token, secret })
  } catch {
    return false
  }
}

/** Builds a scannable QR code (as a data URL) for adding the account to an authenticator app. */
export async function generateTotpQrCode(accountLabel: string, secret: string) {
  const otpauthUrl = authenticator.keyuri(accountLabel, ISSUER, secret)
  return QRCode.toDataURL(otpauthUrl)
}
