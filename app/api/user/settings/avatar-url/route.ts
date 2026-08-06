import { NextResponse } from "next/server"
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"
import { requireCurrentUser, AuthError } from "@/lib/auth"

// Reuses the same S3-compatible (R2) bucket/credentials the file uploader already uses.
const s3 = new S3Client({
  region: "auto",
  endpoint: process.env.S3_ENDPOINT, // e.g. https://<accountid>.r2.cloudflarestorage.com
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID as string,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY as string,
  },
})

const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"])

export async function POST(req: Request) {
  try {
    const user = await requireCurrentUser()
    const body = await req.json()
    const contentType = String(body.contentType ?? "")
    if (!ALLOWED_TYPES.has(contentType)) {
      return NextResponse.json({ error: "Unsupported image type." }, { status: 400 })
    }

    const ext = contentType.split("/")[1]
    const key = `avatars/${user.id}-${Date.now()}.${ext}`
    const bucket = process.env.S3_BUCKET as string

    const uploadUrl = await getSignedUrl(
      s3,
      new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: contentType }),
      { expiresIn: 60 * 5 },
    )

    const publicUrl = `${process.env.S3_PUBLIC_BASE_URL}/${key}`

    return NextResponse.json({ uploadUrl, publicUrl })
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status })
    console.error("[user/settings/avatar-url]", err)
    return NextResponse.json({ error: "Could not create upload URL." }, { status: 500 })
  }
}
