import { NextResponse } from "next/server"
import { PutObjectCommand } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"
import { requireCurrentUser, AuthError } from "@/lib/auth"
import { r2, BUCKET_NAME } from "@/lib/r2"

// Any image/* content type is accepted (png, jpeg, webp, gif, svg, heic, avif, etc).
// Anything that isn't an image — video, audio, whatever — is rejected outright.
const EXT_BY_TYPE: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/svg+xml": "svg",
  "image/bmp": "bmp",
  "image/x-icon": "ico",
  "image/heic": "heic",
  "image/heif": "heif",
  "image/avif": "avif",
  "image/tiff": "tiff",
}

export async function POST(req: Request) {
  try {
    const user = await requireCurrentUser()
    const body = await req.json()
    const contentType = String(body.contentType ?? "")

    if (!contentType.startsWith("image/")) {
      return NextResponse.json({ error: "Only image files are allowed." }, { status: 400 })
    }

    const ext = EXT_BY_TYPE[contentType] ?? contentType.split("/")[1]?.replace(/[^a-z0-9]/gi, "") ?? "bin"
    // Reuses the same R2 bucket/credentials the file uploader already uses — no separate
    // S3_* env vars needed. Namespaced under avatars/ so the cleanup cron can skip these.
    const key = `avatars/${user.id}-${Date.now()}.${ext}`

    const uploadUrl = await getSignedUrl(
      r2,
      new PutObjectCommand({ Bucket: BUCKET_NAME, Key: key, ContentType: contentType }),
      { expiresIn: 60 * 5 },
    )

    // Served through our own proxy route since the bucket is private (same reason
    // uploaded files go through /f/[id] instead of a public bucket URL).
    const publicUrl = `/a/${key}`

    return NextResponse.json({ uploadUrl, publicUrl })
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status })
    console.error("[user/settings/avatar-url]", err)
    return NextResponse.json({ error: "Could not create upload URL." }, { status: 500 })
  }
}
