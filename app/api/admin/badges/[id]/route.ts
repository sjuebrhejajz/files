import { NextResponse } from "next/server"
import { DeleteObjectCommand } from "@aws-sdk/client-s3"
import { sql } from "@/lib/db"
import { r2, BUCKET_NAME } from "@/lib/r2"
import { requireAdmin, AuthError } from "@/lib/auth"
import { logModAction } from "@/lib/mod-log"

// SECURITY: explicit, independent of the Cache-Control header middleware.ts
// also sets on all /api/admin/* and /api/user/* routes.
export const dynamic = "force-dynamic"

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Deleting/moderating existing badges stays available to admin — only
    // creating new ones is owner-exclusive.
    const admin = await requireAdmin()
    const { id } = await params

    const rows = await sql`select name, image_key from custom_badges where id = ${id}`
    const badge = rows[0]
    const key = badge?.image_key as string | undefined
    if (key) {
      try {
        await r2.send(new DeleteObjectCommand({ Bucket: BUCKET_NAME, Key: key }))
      } catch (e) {
        console.error("[admin/badges/:id] r2 delete failed:", e)
      }
    }

    // Cascades to user_badges automatically (on delete cascade), so removing
    // the badge type also removes it from everyone who had it.
    await sql`delete from custom_badges where id = ${id}`
    if (badge) await logModAction(admin, "badge_delete", String(badge.name))
    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status })
    console.error("[admin/badges/:id DELETE]", err)
    return NextResponse.json({ error: "Could not delete badge." }, { status: 500 })
  }
}
