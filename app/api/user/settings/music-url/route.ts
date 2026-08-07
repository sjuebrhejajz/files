import { NextResponse } from "next/server"
import { PutObjectCommand } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"
import { requireCurrentUser, AuthError } from "@/lib/auth"
import { r2, BUCKET_NAME } from "@/lib/r2"
import { hasDonatorPerks } from "@/lib/donations"
import { isBlacklisted, getClientIp } from "@/lib/blacklist"

const ALLOWED_TYPES = new Set(["audio/mpeg", "audio/mp3"])
const MAX_BYTES = 15 * 1024 * 1024 // 15 MB

export async function POST(req: Request) {
  try {
    const user = await requireCurrentUser()

    // Server-side gate — the settings UI hides this from non-donors, but that's
    // not enforcement, so check again here regardless of what the client sends.
    if (!hasDonatorPerks(user)) {
      return NextResponse.json({ error: "Donate any amount to unlock the music widget." }, { status: 403 })
    }

    const body = await req.json()
    const contentType = String(body.contentType ?? "")
    const size = Number(body.size ?? 0)

    if (!ALLOWED_TYPES.has(contentType)) {
      return NextResponse.json({ error: "Only MP3 files are allowed." }, { status: 400 })
    }
    if (!size || size > MAX_BYTES) {
      return NextResponse.json({ error: "Track must be 15 MB or smaller." }, { status: 400 })
    }

    const ip = getClientIp(req)
    if (await isBlacklisted({ ip, username: user.username, email: user.email })) {
      return NextResponse.json({ error: "Uploads are not available for this account." }, { status: 403 })
    }

    const key = `music/${user.id}-${Date.now()}.mp3`

    const uploadUrl = await getSignedUrl(
      r2,
      new PutObjectCommand({ Bucket: BUCKET_NAME, Key: key, ContentType: contentType }),
      { expiresIn: 60 * 5 },
    )

    return NextResponse.json({ uploadUrl, key })
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status })
    console.error("[user/settings/music-url]", err)
    return NextResponse.json({ error: "Could not create upload URL." }, { status: 500 })
  }
}
