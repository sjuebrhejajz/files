import { GetObjectCommand } from "@aws-sdk/client-s3"
import { type NextRequest, NextResponse } from "next/server"
import { r2, BUCKET_NAME } from "@/lib/r2"

export const dynamic = "force-dynamic"

// Serves avatar images directly by their known object key. Unlike /f/[id], which
// resolves an opaque short id by scanning the whole bucket, avatar keys are
// predictable (avatars/<userId>-<timestamp>.<ext>) so we can fetch them directly.
export async function GET(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params
  const key = path.join("/")

  // Only ever serve objects under the avatars/ prefix through this route.
  if (!key.startsWith("avatars/")) {
    return new NextResponse("Not found", { status: 404 })
  }

  try {
    const object = await r2.send(new GetObjectCommand({ Bucket: BUCKET_NAME, Key: key }))

    const headers = new Headers()
    headers.set("Content-Type", object.ContentType ?? "application/octet-stream")
    headers.set("Cache-Control", "public, max-age=86400, immutable")
    if (object.ContentLength) headers.set("Content-Length", String(object.ContentLength))

    return new NextResponse(object.Body as unknown as ReadableStream, { status: 200, headers })
  } catch (error) {
    console.error("[avatar] delivery error:", error)
    return new NextResponse("Not found", { status: 404 })
  }
}
