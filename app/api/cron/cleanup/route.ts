import { del, list } from "@vercel/blob"
import { type NextRequest, NextResponse } from "next/server"

export const dynamic = "force-dynamic"

const EXPIRY_MS = 12 * 60 * 60 * 1000

// Deletes any blob older than 12h. Triggered by Vercel Cron (see vercel.json).
// Falls back to the blob's uploadedAt time if the pathname has no timestamp.
export async function GET(request: NextRequest) {
  // Vercel Cron requests include this header when CRON_SECRET is set.
  const auth = request.headers.get("authorization")
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const now = Date.now()
  let cursor: string | undefined
  const toDelete: string[] = []

  try {
    do {
      const result = await list({ cursor, limit: 1000 })
      for (const blob of result.blobs) {
        const name = blob.pathname.split("/").pop() ?? ""
        const tsMatch = name.match(/^(\d+)__/)
        const uploadedAt = tsMatch ? Number(tsMatch[1]) : new Date(blob.uploadedAt).getTime()
        if (now - uploadedAt > EXPIRY_MS) {
          toDelete.push(blob.url)
        }
      }
      cursor = result.cursor
    } while (cursor)

    if (toDelete.length > 0) {
      await del(toDelete)
    }

    console.log("[v0] cleanup removed", toDelete.length, "files")
    return NextResponse.json({ deleted: toDelete.length })
  } catch (error) {
    console.error("[v0] cleanup error:", error)
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
