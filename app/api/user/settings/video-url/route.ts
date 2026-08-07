import { NextResponse } from "next/server"
import { PutObjectCommand } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"
import { requireCurrentUser, isAdmin, AuthError } from "@/lib/auth"
import { r2, BUCKET_NAME } from "@/lib/r2"
import { isBlacklisted, getClientIp } from "@/lib/blacklist"

const ALLOWED_TYPES = new Set(["video/mp4", "video/webm"])
const MAX_BYTES = 100 * 1024 * 1024 // 100 MB

export async function POST(req: Request) {
  try {
    const user = await requireCurrentUser()

    // Server-side gate — this is an admin-only perk, not a donator one, and
    // the settings UI hiding the section from everyone else isn't enforcement.
    if (!isAdmin(user)) {
      return NextResponse.json({ error: "Admin access only." }, { status: 403 })
    }

    const body = await req.json()
    const contentType = String(body.contentType ?? "")
    const size = Number(body.size ?? 0)

    if (!ALLOWED_TYPES.has(contentType)) {
      return NextResponse.json({ error: "Only MP4 or WebM files are allowed." }, { status: 400 })
    }
    if (!size || size > MAX_BYTES) {
      return NextResponse.json({ error: "Video must be 100 MB or smaller." }, { status: 400 })
    }

    const ip = getClientIp(req)
    if (await isBlacklisted({ ip, username: user.username, email: user.email })) {
      return NextResponse.json({ error: "Uploads are not available for this account." }, { status: 403 })
    }

    const ext = contentType === "video/webm" ? "webm" : "mp4"
    const key = `video/${user.id}-${Date.now()}.${ext}`

    const uploadUrl = await getSignedUrl(
      r2,
      new PutObjectCommand({ Bucket: BUCKET_NAME, Key: key, ContentType: contentType }),
      { expiresIn: 60 * 5 },
    )

    return NextResponse.json({ uploadUrl, key })
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status })
    console.error("[user/settings/video-url]", err)
    return NextResponse.json({ error: "Could not create upload URL." }, { status: 500 })
  }
}
