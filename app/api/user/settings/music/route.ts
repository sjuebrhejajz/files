import { NextResponse } from "next/server"
import { DeleteObjectCommand } from "@aws-sdk/client-s3"
import { sql } from "@/lib/db"
import { r2, BUCKET_NAME } from "@/lib/r2"
import { requireCurrentUser, AuthError } from "@/lib/auth"
import { hasDonatorPerks } from "@/lib/donations"

export async function GET() {
  try {
    const user = await requireCurrentUser()
    const eligible = hasDonatorPerks(user)

    const rows = await sql`select music_object_key, music_enabled from users where id = ${user.id}`
    const row = rows[0]
    const key = row?.music_object_key as string | null

    return NextResponse.json({
      eligible,
      enabled: Boolean(row?.music_enabled),
      url: key ? `/a/${key}` : null,
    })
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status })
    console.error("[user/settings/music GET]", err)
    return NextResponse.json({ error: "Could not load music status." }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireCurrentUser()
    if (!hasDonatorPerks(user)) {
      return NextResponse.json({ error: "Donate any amount to unlock the music widget." }, { status: 403 })
    }

    const body = await req.json()
    const rows = await sql`select music_object_key from users where id = ${user.id}`
    const currentKey = rows[0]?.music_object_key as string | null

    // ---- remove ----
    if (body.remove === true) {
      if (currentKey) {
        try {
          await r2.send(new DeleteObjectCommand({ Bucket: BUCKET_NAME, Key: currentKey }))
        } catch (e) {
          console.error("[user/settings/music] r2 delete failed:", e)
        }
      }
      await sql`update users set music_object_key = null, music_enabled = false where id = ${user.id}`
      return NextResponse.json({ ok: true })
    }

    // ---- set a newly uploaded track ----
    if (typeof body.key === "string") {
      const key = body.key
      if (!key.startsWith(`music/${user.id}-`)) {
        return NextResponse.json({ error: "Invalid upload key." }, { status: 400 })
      }
      // Replacing a track — clean up the old object so it doesn't linger in R2.
      if (currentKey && currentKey !== key) {
        try {
          await r2.send(new DeleteObjectCommand({ Bucket: BUCKET_NAME, Key: currentKey }))
        } catch (e) {
          console.error("[user/settings/music] r2 delete failed:", e)
        }
      }
      await sql`update users set music_object_key = ${key} where id = ${user.id}`
    }

    // ---- toggle visibility on the public profile ----
    if (typeof body.enabled === "boolean") {
      const hasTrack = currentKey || typeof body.key === "string"
      if (body.enabled && !hasTrack) {
        return NextResponse.json({ error: "Upload a track first." }, { status: 400 })
      }
      await sql`update users set music_enabled = ${body.enabled} where id = ${user.id}`
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status })
    console.error("[user/settings/music POST]", err)
    return NextResponse.json({ error: "Could not update music settings." }, { status: 500 })
  }
}
