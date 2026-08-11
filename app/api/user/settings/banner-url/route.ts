import { NextResponse } from "next/server"
import { PutObjectCommand } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"
import { requireCurrentUser, isStaff, AuthError } from "@/lib/auth"
import { r2, BUCKET_NAME } from "@/lib/r2"
import { isBlacklisted, getClientIp } from "@/lib/blacklist"

// SECURITY: same fix as avatar-url/route.ts — strict allowlist instead of an
// "image/*" prefix check. SVG is deliberately excluded (it can embed
// <script> and execute as XSS if ever rendered/served inline), and an
// unrecognized MIME type can no longer pick its own extension via a fallback.
const ALLOWED_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
}

const MAX_BYTES = 25 * 1024 * 1024 // 25 MB — waived entirely for staff (mod/admin/owner)

export async function POST(req: Request) {
  try {
    const user = await requireCurrentUser()
    const body = await req.json()
    const contentType = String(body.contentType ?? "")
    const size = Number(body.size ?? 0)

    const ext = ALLOWED_TYPES[contentType]
    if (!ext) {
      return NextResponse.json({ error: "Only PNG, JPEG, WebP, or GIF images are allowed." }, { status: 400 })
    }
    if (!size || (!isStaff(user) && size > MAX_BYTES)) {
      return NextResponse.json({ error: "Images must be 25 MB or smaller." }, { status: 400 })
    }

    const ip = getClientIp(req)
    if (await isBlacklisted({ ip, username: user.username, email: user.email })) {
      return NextResponse.json({ error: "Uploads are not available for this account." }, { status: 403 })
    }

    // Namespaced under banners/ (parallel to avatars/) so the cleanup cron skips these too.
    const key = `banners/${user.id}-${Date.now()}.${ext}`

    const uploadUrl = await getSignedUrl(
      r2,
      new PutObjectCommand({ Bucket: BUCKET_NAME, Key: key, ContentType: contentType }),
      { expiresIn: 60 * 5 },
    )

    return NextResponse.json({ uploadUrl, key })
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status })
    console.error("[user/settings/banner-url]", err)
    return NextResponse.json({ error: "Could not create upload URL." }, { status: 500 })
  }
}
