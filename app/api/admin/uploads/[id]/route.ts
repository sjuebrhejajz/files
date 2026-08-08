import { NextResponse } from "next/server"
import { DeleteObjectCommand } from "@aws-sdk/client-s3"
import { sql } from "@/lib/db"
import { r2, BUCKET_NAME } from "@/lib/r2"
import { requireStaff, AuthError } from "@/lib/auth"
import { logModAction } from "@/lib/mod-log"

// SECURITY: explicit, independent of the Cache-Control header middleware.ts
// also sets on all /api/admin/* and /api/user/* routes.
export const dynamic = "force-dynamic"

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireStaff()
    const { id } = await params

    const rows = await sql`
      select u.object_key, u.filename, usr.username as uploader_username
      from uploads u
      left join users usr on usr.id = u.user_id
      where u.id = ${id}
    `
    const upload = rows[0]
    if (!upload) return NextResponse.json({ error: "Upload not found." }, { status: 404 })

    try {
      await r2.send(new DeleteObjectCommand({ Bucket: BUCKET_NAME, Key: upload.object_key as string }))
    } catch (e) {
      console.error("[admin/uploads/:id] r2 delete failed:", e)
    }

    await sql`delete from uploads where id = ${id}`
    await logModAction(
      actor,
      "upload_delete",
      String(upload.filename),
      upload.uploader_username ? `uploader: ${upload.uploader_username}` : "uploader: anonymous",
    )

    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status })
    console.error("[admin/uploads/:id DELETE]", err)
    return NextResponse.json({ error: "Could not delete upload." }, { status: 500 })
  }
}
