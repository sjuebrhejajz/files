import { NextResponse } from "next/server"
import { DeleteObjectCommand } from "@aws-sdk/client-s3"
import { sql } from "@/lib/db"
import { r2, BUCKET_NAME } from "@/lib/r2"
import { requireCurrentUser, AuthError } from "@/lib/auth"

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireCurrentUser()
    const { id } = await params

    // Ownership check happens in the WHERE clause — a user can only delete their own links.
    const rows = await sql`
      delete from uploads where id = ${id} and user_id = ${user.id} returning object_key
    `
    if (rows.length === 0) {
      return NextResponse.json({ error: "Link not found." }, { status: 404 })
    }

    await r2.send(new DeleteObjectCommand({ Bucket: BUCKET_NAME, Key: rows[0].object_key as string }))

    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status })
    console.error("[user/links/:id]", err)
    return NextResponse.json({ error: "Could not delete link." }, { status: 500 })
  }
}
