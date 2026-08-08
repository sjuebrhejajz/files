import { GetObjectCommand } from "@aws-sdk/client-s3"
import { type NextRequest, NextResponse } from "next/server"
import { displayNameFor, findKeyByShortId } from "@/lib/files"
import { r2, BUCKET_NAME } from "@/lib/r2"

export const dynamic = "force-dynamic"

// SECURITY: this used to be a blacklist (block a few known-dangerous types,
// allow everything else inline) — that's the wrong default for exactly the
// reason it sounds: it only blocks what's specifically been thought of, so
// anything not on the list (e.g. XML, which some browsers will run an
// XSLT stylesheet transform on and generate live HTML from) sails through
// unblocked. This is now an allowlist instead: only actual renderable media
// (images minus SVG, video, audio, PDF) is ever served inline. Everything
// else — every text/* and application/* type, every unrecognized type, with
// no exceptions — is force-downloaded by default. This still doesn't
// restrict what can be uploaded or shared; .exe, .zip, .svg, .html, .xml can
// all still be uploaded and linked, they just can't execute when visited.
const SAFE_INLINE_PREFIXES = ["image/", "video/", "audio/"]
const SAFE_INLINE_EXACT_TYPES = new Set(["application/pdf"])
// SVG matches the "image/" prefix above but is excluded — it can embed
// <script> and execute as a full page on this origin if rendered directly,
// exactly like the "lol.svg" upload that prompted this fix.
const UNSAFE_INLINE_EXCEPTIONS = new Set(["image/svg+xml"])

function isSafeToRenderInline(rawContentType: string): boolean {
  const type = rawContentType.split(";")[0].trim().toLowerCase()
  if (UNSAFE_INLINE_EXCEPTIONS.has(type)) return false
  if (SAFE_INLINE_EXACT_TYPES.has(type)) return true
  return SAFE_INLINE_PREFIXES.some((prefix) => type.startsWith(prefix))
}

// Serves a stored file inline so that Discord (and browsers) can embed/play it
// directly. Supports HTTP range requests, which Discord's media proxy and video
// players require for seeking and inline playback.
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  try {
    const key = await findKeyByShortId(decodeURIComponent(id))
    if (!key) {
      return new NextResponse("Not found", { status: 404 })
    }

    const range = request.headers.get("range") ?? undefined
    const object = await r2.send(new GetObjectCommand({ Bucket: BUCKET_NAME, Key: key, Range: range }))

    const displayName = displayNameFor(key)
    const rawContentType = object.ContentType ?? "application/octet-stream"
    const safeInline = isSafeToRenderInline(rawContentType)

    const headers = new Headers()
    headers.set("Content-Type", safeInline ? rawContentType : "application/octet-stream")
    headers.set(
      "Content-Disposition",
      `${safeInline ? "inline" : "attachment"}; filename="${encodeURIComponent(displayName)}"`,
    )
    // Belt and suspenders: tells the browser not to try to guess/"sniff" a
    // more specific type than what's declared, closing off MIME-confusion
    // tricks even for types this allowlist doesn't explicitly know about.
    headers.set("X-Content-Type-Options", "nosniff")
    headers.set("Accept-Ranges", "bytes")
    headers.set("Cache-Control", "public, max-age=86400, immutable")
    if (object.ContentLength) headers.set("Content-Length", String(object.ContentLength))
    if (object.ContentRange) headers.set("Content-Range", object.ContentRange)

    return new NextResponse(object.Body as unknown as ReadableStream, {
      status: range ? 206 : 200,
      headers,
    })
  } catch (error) {
    console.error("[v0] delivery error:", error)
    return new NextResponse("Error", { status: 500 })
  }
}
