import { PutObjectCommand } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"
import { type NextRequest, NextResponse } from "next/server"
import { r2, BUCKET_NAME } from "@/lib/r2"
import { sql } from "@/lib/db"
import { getCurrentUser } from "@/lib/auth"

// 250 MB per file
const MAX_BYTES = 250 * 1024 * 1024
const EXPIRY_MS = 7 * 24 * 60 * 60 * 1000

// Issues a short-lived presigned PUT URL so the browser can upload directly
// to R2. Files up to 250MB can't be routed through a Vercel serverless
// function (hard body-size limits), so the actual bytes never touch Vercel.
export async function POST(request: NextRequest) {
  try {
    const { filename, contentType, size } = (await request.json()) as {
      filename: string
      contentType?: string
      size: number
    }

    if (!filename || typeof size !== "number") {
      return NextResponse.json({ error: "Missing filename or size" }, { status: 400 })
    }

    if (size > MAX_BYTES) {
      return NextResponse.json({ error: "Exceeds 250 MB limit" }, { status: 400 })
    }

    const shortId = crypto.randomUUID().replace(/-/g, "").slice(0, 8)
    const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "_")
    // Timestamp + shortId + safe name so the cleanup cron can expire it after 7 days.
    const key = `${Date.now()}__f__${shortId}__${safeName}`

    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      ContentType: contentType || "application/octet-stream",
    })

    const url = await getSignedUrl(r2, command, { expiresIn: 600 })

    // Record the upload so it's attributable to an account (if logged in) and
    // so the dashboard can list/delete it without scanning the whole bucket.
    // This row is written optimistically at presign time, before the browser's
    // PUT actually completes — same assumption the cleanup cron already makes
    // by trusting the timestamp embedded in the object key.
    const user = await getCurrentUser()
    const expiresAt = new Date(Date.now() + EXPIRY_MS)
    await sql`
      insert into uploads (user_id, short_id, object_key, filename, content_type, size_bytes, expires_at)
      values (${user?.id ?? null}, ${shortId}, ${key}, ${filename}, ${contentType ?? null}, ${size}, ${expiresAt.toISOString()})
    `

    return NextResponse.json({ url, key, shortId })
  } catch (error) {
    console.error("[v0] presign error:", error)
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
