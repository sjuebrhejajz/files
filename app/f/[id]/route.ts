import { GetObjectCommand } from "@aws-sdk/client-s3"
import { type NextRequest, NextResponse } from "next/server"
import { displayNameFor, findKeyByShortId } from "@/lib/files"
import { r2, BUCKET_NAME } from "@/lib/r2"

export const dynamic = "force-dynamic"

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
    const object = await r2.send(
      new GetObjectCommand({ Bucket: BUCKET_NAME, Key: key, Range: range }),
    )

    const displayName = displayNameFor(key)

    const headers = new Headers()
    headers.set("Content-Type", object.ContentType ?? "application/octet-stream")
    headers.set("Content-Disposition", `inline; filename="${encodeURIComponent(displayName)}"`)
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
