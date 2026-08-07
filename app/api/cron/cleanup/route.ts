import { ListObjectsV2Command, DeleteObjectsCommand } from "@aws-sdk/client-s3"
import { type NextRequest, NextResponse } from "next/server"
import { r2, BUCKET_NAME } from "@/lib/r2"
import { sql } from "@/lib/db"

export const dynamic = "force-dynamic"

const EXPIRY_MS = 7 * 24 * 60 * 60 * 1000

// Deletes any object older than 7 days. Triggered by Vercel Cron (see vercel.json).
// Falls back to the object's LastModified time if the key has no timestamp.
export async function GET(request: NextRequest) {
  // Vercel Cron requests include this header when CRON_SECRET is set.
  const auth = request.headers.get("authorization")
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const now = Date.now()
  let ContinuationToken: string | undefined
  const toDelete: { Key: string }[] = []

  try {
    do {
      const result = await r2.send(
        new ListObjectsV2Command({ Bucket: BUCKET_NAME, ContinuationToken }),
      )
      for (const obj of result.Contents ?? []) {
        if (!obj.Key) continue
        // Profile pictures, banners, music tracks, and theme backgrounds don't expire — only files uploaded through the main uploader do.
        if (
          obj.Key.startsWith("avatars/") ||
          obj.Key.startsWith("banners/") ||
          obj.Key.startsWith("music/") ||
          obj.Key.startsWith("themes/")
        )
          continue
        const name = obj.Key.split("/").pop() ?? ""
        const tsMatch = name.match(/^(\d+)__/)
        const uploadedAt = tsMatch ? Number(tsMatch[1]) : (obj.LastModified?.getTime() ?? now)
        if (now - uploadedAt > EXPIRY_MS) {
          toDelete.push({ Key: obj.Key })
        }
      }
      ContinuationToken = result.IsTruncated ? result.NextContinuationToken : undefined
    } while (ContinuationToken)

    // S3 batch delete accepts up to 1000 keys per request.
    for (let i = 0; i < toDelete.length; i += 1000) {
      const batch = toDelete.slice(i, i + 1000)
      await r2.send(
        new DeleteObjectsCommand({
          Bucket: BUCKET_NAME,
          Delete: { Objects: batch },
        }),
      )
    }

    // Keep the "uploads" table (used by each user's dashboard) in sync with what's
    // actually still in the bucket.
    if (toDelete.length > 0) {
      const keys = toDelete.map((o) => o.Key)
      await sql`delete from uploads where object_key = any(${keys})`
    }

    console.log("[v0] cleanup removed", toDelete.length, "files")
    return NextResponse.json({ deleted: toDelete.length })
  } catch (error) {
    console.error("[v0] cleanup error:", error)
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
