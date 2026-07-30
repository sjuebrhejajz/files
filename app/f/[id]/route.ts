import { list } from "@vercel/blob"
import { type NextRequest, NextResponse } from "next/server"
import { displayNameFor } from "@/lib/files"

export const dynamic = "force-dynamic"

// Serves a stored file inline so that Discord (and browsers) can embed/play it
// directly. Supports HTTP range requests, which Discord's media proxy and video
// players require for seeking and inline playback.
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  try {
    // Look up the blob by its pathname prefix (the id is the encoded pathname).
    const decoded = decodeURIComponent(id)
    const { blobs } = await list({ prefix: decoded, limit: 1 })
    const blob = blobs.find((b) => b.pathname === decoded) ?? blobs[0]

    if (!blob) {
      return new NextResponse("Not found", { status: 404 })
    }

    const range = request.headers.get("range")
    const upstream = await fetch(blob.url, {
      headers: range ? { range } : {},
    })

    if (!upstream.ok && upstream.status !== 206) {
      return new NextResponse("Not found", { status: 404 })
    }

    const displayName = displayNameFor(decoded)

    const headers = new Headers()
    const contentType = upstream.headers.get("content-type") ?? "application/octet-stream"
    headers.set("Content-Type", contentType)
    headers.set("Content-Disposition", `inline; filename="${encodeURIComponent(displayName)}"`)
    headers.set("Accept-Ranges", "bytes")
    headers.set("Cache-Control", "public, max-age=86400, immutable")

    const contentLength = upstream.headers.get("content-length")
    if (contentLength) headers.set("Content-Length", contentLength)
    const contentRange = upstream.headers.get("content-range")
    if (contentRange) headers.set("Content-Range", contentRange)

    return new NextResponse(upstream.body, {
      status: upstream.status,
      headers,
    })
  } catch (error) {
    console.error("[v0] delivery error:", error)
    return new NextResponse("Error", { status: 500 })
  }
}
