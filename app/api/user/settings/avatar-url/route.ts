import { NextResponse } from "next/server"
import { PutObjectCommand } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"
import { requireCurrentUser, isStaff, AuthError } from "@/lib/auth"
import { r2, BUCKET_NAME } from "@/lib/r2"
import { isBlacklisted, getClientIp } from "@/lib/blacklist"

// SECURITY: this used to accept any "image/*" prefix, including SVG — SVG
// files can embed <script> tags and execute as XSS if ever rendered/served
// inline, so it's excluded even though it's technically an image format.
// This is now a strict allowlist of the actually-popular raster formats
// (plus GIF) instead of a prefix check, so an unrecognized/unknown
// "image/whatever" MIME type can no longer sneak through and pick its own
// extension via the old fallback logic.
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

    // Reuses the same R2 bucket/credentials the file uploader already uses — no separate
    // S3_* env vars needed. Namespaced under avatars/ so the cleanup cron can skip these.
    const key = `avatars/${user.id}-${Date.now()}.${ext}`

    const uploadUrl = await getSignedUrl(
      r2,
      new PutObjectCommand({ Bucket: BUCKET_NAME, Key: key, ContentType: contentType }),
      { expiresIn: 60 * 5 },
    )

    // No publicUrl here on purpose: the image isn't public until staff approve it
    // via the moderation queue. The client submits this key to
    // /api/user/settings/image next, which queues it for review.
    return NextResponse.json({ uploadUrl, key })
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status })
    console.error("[user/settings/avatar-url]", err)
    return NextResponse.json({ error: "Could not create upload URL." }, { status: 500 })
  }
}
