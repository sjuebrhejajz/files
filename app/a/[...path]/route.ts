import { GetObjectCommand } from "@aws-sdk/client-s3"
import { type NextRequest, NextResponse } from "next/server"
import { r2, BUCKET_NAME } from "@/lib/r2"
import { sql } from "@/lib/db"
import { getCurrentUser, isStaff } from "@/lib/auth"

export const dynamic = "force-dynamic"

// SECURITY: this route never set Content-Disposition, which means a browser
// navigating directly to a URL it serves falls back to its own default —
// inline rendering for any content type it recognizes, including
// image/svg+xml. SVG can embed <script> and execute on this origin if
// rendered that way (see app/f/[id]/route.ts for the same issue, confirmed
// via an actual malicious upload). Every current upload path into this
// route is already restricted to safe raster formats at upload time
// (avatars/banners/badges: PNG/JPEG/WebP/GIF, no SVG), but this is enforced
// here too as a safety net — so a future feature added to this route can't
// reintroduce the same hole just by forgetting to exclude SVG at upload time.
const DANGEROUS_INLINE_TYPES = new Set(["text/html", "application/xhtml+xml", "image/svg+xml"])

// Serves avatar/banner/music/theme/video/badge files directly by their known
// object key. Unlike /f/[id], which resolves an opaque short id by scanning
// the whole bucket, these keys are predictable (avatars/<userId>-<ts>.<ext>,
// banners/<userId>-<ts>.<ext>, music/<userId>-<ts>.mp3, themes/<userId>-<ts>.<ext>,
// video/<userId>-<ts>.<ext>, or badges/<adminId>-<ts>.<ext>) so we can fetch
// them directly.
export async function GET(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params
  const key = path.join("/")

  const isImage = key.startsWith("avatars/") || key.startsWith("banners/")
  const isMusic = key.startsWith("music/")
  const isTheme = key.startsWith("themes/")
  const isVideo = key.startsWith("video/")
  const isBadge = key.startsWith("badges/")

  // Only ever serve objects under these prefixes through this route.
  if (!isImage && !isMusic && !isTheme && !isVideo && !isBadge) {
    return new NextResponse("Not found", { status: 404 })
  }

  try {
    let isPublic: boolean
    let ownerId: string | null = null

    if (isBadge) {
      // Admin-uploaded and admin-controlled — never gated by moderation or
      // ownership, always public once created.
      isPublic = true
    } else if (isImage) {
      const rows = await sql`
        select user_id, status from image_moderation where object_key = ${key} order by created_at desc limit 1
      `
      const record = rows[0]
      // No moderation row means this predates the moderation queue (a legacy
      // avatar) — keep serving it. Anything with a row must be approved,
      // unless the viewer is staff or the image's own owner (so they can
      // preview it before/while it's under review).
      isPublic = !record || record.status === "approved"
      ownerId = record ? (record.user_id as string) : null
    } else if (isMusic) {
      const rows = await sql`select id, music_enabled from users where music_object_key = ${key}`
      const record = rows[0]
      if (!record) return new NextResponse("Not found", { status: 404 })
      isPublic = Boolean(record.music_enabled)
      ownerId = record.id as string
    } else if (isVideo) {
      const rows = await sql`select id, video_enabled from users where video_object_key = ${key}`
      const record = rows[0]
      if (!record) return new NextResponse("Not found", { status: 404 })
      isPublic = Boolean(record.video_enabled)
      ownerId = record.id as string
    } else {
      // themes/ — a personal site background, never shown to anyone but its
      // owner (applied only while they're logged in). No public toggle exists
      // for this one, unlike music.
      const rows = await sql`select id from users where theme_image_key = ${key}`
      const record = rows[0]
      if (!record) return new NextResponse("Not found", { status: 404 })
      isPublic = false
      ownerId = record.id as string
    }

    if (!isPublic) {
      const viewer = await getCurrentUser()
      const allowed = viewer && (viewer.id === ownerId || isStaff(viewer))
      if (!allowed) return new NextResponse("Not found", { status: 404 })
    }

    const object = await r2.send(new GetObjectCommand({ Bucket: BUCKET_NAME, Key: key }))

    const rawContentType = object.ContentType ?? "application/octet-stream"
    const isDangerous = DANGEROUS_INLINE_TYPES.has(rawContentType.split(";")[0].trim().toLowerCase())

    const headers = new Headers()
    headers.set("Content-Type", isDangerous ? "application/octet-stream" : rawContentType)
    if (isDangerous) headers.set("Content-Disposition", "attachment")
    headers.set("X-Content-Type-Options", "nosniff")
    // Never let a shared/CDN cache hold onto an unapproved image, a disabled
    // track, or a private theme background.
    headers.set("Cache-Control", isPublic ? "public, max-age=86400, immutable" : "private, no-store")
    if (object.ContentLength) headers.set("Content-Length", String(object.ContentLength))

    return new NextResponse(object.Body as unknown as ReadableStream, { status: 200, headers })
  } catch (error) {
    console.error("[a] delivery error:", error)
    return new NextResponse("Not found", { status: 404 })
  }
}
