import { NextResponse } from "next/server"
import { PutObjectCommand } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"
import { requireOwner, AuthError } from "@/lib/auth"
import { r2, BUCKET_NAME } from "@/lib/r2"

// SECURITY: SVG dropped — it can embed <script> and execute if ever viewed
// via direct navigation (see app/a/[...path]/route.ts and app/f/[id]/route.ts
// for the serving-side defense against this too). No reason a badge icon
// specifically needs SVG over PNG/JPEG/WebP.
const ALLOWED_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
}
const MAX_BYTES = 2 * 1024 * 1024 // 2 MB — these are small badge icons

export async function POST(req: Request) {
  try {
    // Part of the badge-creation flow, so owner-only, same as POST /api/admin/badges.
    const owner = await requireOwner()
    const body = await req.json()
    const contentType = String(body.contentType ?? "")
    const size = Number(body.size ?? 0)

    const ext = ALLOWED_TYPES[contentType]
    if (!ext) {
      return NextResponse.json({ error: "Only PNG, JPEG, or WebP images are allowed." }, { status: 400 })
    }
    if (!size || size > MAX_BYTES) {
      return NextResponse.json({ error: "Badge image must be 2 MB or smaller." }, { status: 400 })
    }

    const key = `badges/${owner.id}-${Date.now()}.${ext}`
    const uploadUrl = await getSignedUrl(
      r2,
      new PutObjectCommand({ Bucket: BUCKET_NAME, Key: key, ContentType: contentType }),
      { expiresIn: 60 * 5 },
    )

    return NextResponse.json({ uploadUrl, key })
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status })
    console.error("[admin/badges/image-url]", err)
    return NextResponse.json({ error: "Could not create upload URL." }, { status: 500 })
  }
}
