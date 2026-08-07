import { NextResponse } from "next/server"
import { DeleteObjectCommand } from "@aws-sdk/client-s3"
import { sql } from "@/lib/db"
import { r2, BUCKET_NAME } from "@/lib/r2"
import { requireCurrentUser, isAdmin, AuthError } from "@/lib/auth"

export async function GET() {
  try {
    const user = await requireCurrentUser()
    const eligible = isAdmin(user)

    const rows = await sql`select video_object_key, video_enabled from users where id = ${user.id}`
    const row = rows[0]
    const key = row?.video_object_key as string | null

    return NextResponse.json({
      eligible,
      enabled: Boolean(row?.video_enabled),
      url: key ? `/a/${key}` : null,
    })
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status })
    console.error("[user/settings/video GET]", err)
    return NextResponse.json({ error: "Could not load video status." }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireCurrentUser()
    if (!isAdmin(user)) {
      return NextResponse.json({ error: "Admin access only." }, { status: 403 })
    }

    const body = await req.json()
    const rows = await sql`select video_object_key from users where id = ${user.id}`
    const currentKey = rows[0]?.video_object_key as string | null

    // ---- remove ----
    if (body.remove === true) {
      if (currentKey) {
        try {
          await r2.send(new DeleteObjectCommand({ Bucket: BUCKET_NAME, Key: currentKey }))
        } catch (e) {
          console.error("[user/settings/video] r2 delete failed:", e)
        }
      }
      await sql`update users set video_object_key = null, video_enabled = false where id = ${user.id}`
      return NextResponse.json({ ok: true })
    }

    // ---- set a newly uploaded video ----
    if (typeof body.key === "string") {
      const key = body.key
      if (!key.startsWith(`video/${user.id}-`)) {
        return NextResponse.json({ error: "Invalid upload key." }, { status: 400 })
      }
      if (currentKey && currentKey !== key) {
        try {
          await r2.send(new DeleteObjectCommand({ Bucket: BUCKET_NAME, Key: currentKey }))
        } catch (e) {
          console.error("[user/settings/video] r2 delete failed:", e)
        }
      }
      await sql`update users set video_object_key = ${key} where id = ${user.id}`
    }

    // ---- toggle visibility on the public profile ----
    if (typeof body.enabled === "boolean") {
      const hasVideo = currentKey || typeof body.key === "string"
      if (body.enabled && !hasVideo) {
        return NextResponse.json({ error: "Upload a video first." }, { status: 400 })
      }
      await sql`update users set video_enabled = ${body.enabled} where id = ${user.id}`
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status })
    console.error("[user/settings/video POST]", err)
    return NextResponse.json({ error: "Could not update video settings." }, { status: 500 })
  }
}
