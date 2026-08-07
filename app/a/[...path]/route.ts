import { GetObjectCommand } from "@aws-sdk/client-s3"
import { type NextRequest, NextResponse } from "next/server"
import { r2, BUCKET_NAME } from "@/lib/r2"
import { sql } from "@/lib/db"
import { getCurrentUser, isStaff } from "@/lib/auth"

export const dynamic = "force-dynamic"

// Serves avatar/banner images directly by their known object key. Unlike
// /f/[id], which resolves an opaque short id by scanning the whole bucket,
// these keys are predictable (avatars/<userId>-<timestamp>.<ext> or
// banners/<userId>-<timestamp>.<ext>) so we can fetch them directly.
export async function GET(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params
  const key = path.join("/")

  // Only ever serve objects under these prefixes through this route.
  if (!key.startsWith("avatars/") && !key.startsWith("banners/")) {
    return new NextResponse("Not found", { status: 404 })
  }

  try {
    const rows = await sql`
      select user_id, status from image_moderation where object_key = ${key} order by created_at desc limit 1
    `
    const record = rows[0]

    // No moderation row means this predates the moderation queue (a legacy
    // avatar) — keep serving it. Anything with a row must be approved,
    // unless the viewer is staff or the image's own owner (so they can
    // preview it before/while it's under review).
    const isPublic = !record || record.status === "approved"
    if (!isPublic) {
      const viewer = await getCurrentUser()
      const allowed = viewer && (viewer.id === record.user_id || isStaff(viewer))
      if (!allowed) return new NextResponse("Not found", { status: 404 })
    }

    const object = await r2.send(new GetObjectCommand({ Bucket: BUCKET_NAME, Key: key }))

    const headers = new Headers()
    headers.set("Content-Type", object.ContentType ?? "application/octet-stream")
    // Never let a shared/CDN cache hold onto an unapproved image.
    headers.set("Cache-Control", isPublic ? "public, max-age=86400, immutable" : "private, no-store")
    if (object.ContentLength) headers.set("Content-Length", String(object.ContentLength))

    return new NextResponse(object.Body as unknown as ReadableStream, { status: 200, headers })
  } catch (error) {
    console.error("[avatar] delivery error:", error)
    return new NextResponse("Not found", { status: 404 })
  }
}
