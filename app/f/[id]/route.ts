import { GetObjectCommand } from "@aws-sdk/client-s3"
import { type NextRequest, NextResponse } from "next/server"
import { displayNameFor, findKeyByShortId } from "@/lib/files"
import { r2, BUCKET_NAME } from "@/lib/r2"

export const dynamic = "force-dynamic"

// SECURITY: HTML and SVG can both embed <script> and, if served inline
// (Content-Disposition: inline) with their real content type, execute as a
// live, full page on this site's own origin when someone navigates directly
// to the URL — not just render as a picture. That's exactly what a reported
// "lol.svg" upload was: a stored-XSS payload. Since script execution
// happens in this origin, it can piggyback on whoever's session clicks the
// link — most dangerously an admin's — to call authenticated APIs and
// exfiltrate whatever comes back, without ever touching real credentials.
// These specific types are force-downloaded instead of rendered, and their
// declared type is overridden so a browser won't try to render them as
// anything other than an opaque download. This intentionally does NOT
// restrict what can be uploaded or shared — .exe, .zip, .svg, .html can
// still be uploaded and linked, they just can't execute when visited.
const DANGEROUS_INLINE_TYPES = new Set(["text/html", "application/xhtml+xml", "image/svg+xml"])

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
    const isDangerous = DANGEROUS_INLINE_TYPES.has(rawContentType.split(";")[0].trim().toLowerCase())

    const headers = new Headers()
    headers.set("Content-Type", isDangerous ? "application/octet-stream" : rawContentType)
    headers.set(
      "Content-Disposition",
      `${isDangerous ? "attachment" : "inline"}; filename="${encodeURIComponent(displayName)}"`,
    )
    // Belt and suspenders: tells the browser not to try to guess/"sniff" a
    // more specific type than what's declared, closing off MIME-confusion
    // tricks even for types not in the list above.
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
