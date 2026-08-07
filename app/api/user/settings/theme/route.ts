import { NextResponse } from "next/server"
import { DeleteObjectCommand } from "@aws-sdk/client-s3"
import { sql } from "@/lib/db"
import { r2, BUCKET_NAME } from "@/lib/r2"
import { requireCurrentUser, AuthError } from "@/lib/auth"
import { HEX_COLOR_PATTERN } from "@/lib/theme"
import { hasDonatorPerks } from "@/lib/donations"

export async function GET() {
  try {
    const user = await requireCurrentUser()

    const rows = await sql`select theme_mode, theme_color, theme_image_key from users where id = ${user.id}`
    const row = rows[0]

    return NextResponse.json({
      eligible: hasDonatorPerks(user),
      mode: row?.theme_mode ?? "default",
      color: row?.theme_color ?? null,
      hasImage: Boolean(row?.theme_image_key),
    })
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status })
    console.error("[user/settings/theme GET]", err)
    return NextResponse.json({ error: "Could not load theme status." }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireCurrentUser()
    if (!hasDonatorPerks(user)) {
      return NextResponse.json({ error: "Donate any amount to unlock custom themes." }, { status: 403 })
    }

    const body = await req.json()
    const rows = await sql`select theme_image_key from users where id = ${user.id}`
    const currentImageKey = rows[0]?.theme_image_key as string | null

    // ---- reset to the site default ----
    if (body.mode === "default") {
      if (currentImageKey) {
        try {
          await r2.send(new DeleteObjectCommand({ Bucket: BUCKET_NAME, Key: currentImageKey }))
        } catch (e) {
          console.error("[user/settings/theme] r2 delete failed:", e)
        }
      }
      await sql`update users set theme_mode = 'default', theme_color = null, theme_image_key = null where id = ${user.id}`
      return NextResponse.json({ ok: true })
    }

    // ---- solid color ----
    if (body.mode === "color") {
      const color = String(body.color ?? "")
      if (!HEX_COLOR_PATTERN.test(color)) {
        return NextResponse.json({ error: "Enter a valid color (e.g. #ff00ff)." }, { status: 400 })
      }
      if (currentImageKey) {
        try {
          await r2.send(new DeleteObjectCommand({ Bucket: BUCKET_NAME, Key: currentImageKey }))
        } catch (e) {
          console.error("[user/settings/theme] r2 delete failed:", e)
        }
      }
      await sql`update users set theme_mode = 'color', theme_color = ${color}, theme_image_key = null where id = ${user.id}`
      return NextResponse.json({ ok: true })
    }

    // ---- finalize an uploaded background image ----
    if (body.mode === "image") {
      const key = String(body.key ?? "")
      if (!key.startsWith(`themes/${user.id}-`)) {
        return NextResponse.json({ error: "Invalid upload key." }, { status: 400 })
      }
      if (currentImageKey && currentImageKey !== key) {
        try {
          await r2.send(new DeleteObjectCommand({ Bucket: BUCKET_NAME, Key: currentImageKey }))
        } catch (e) {
          console.error("[user/settings/theme] r2 delete failed:", e)
        }
      }
      await sql`update users set theme_mode = 'image', theme_color = null, theme_image_key = ${key} where id = ${user.id}`
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: "Invalid theme mode." }, { status: 400 })
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status })
    console.error("[user/settings/theme POST]", err)
    return NextResponse.json({ error: "Could not update theme." }, { status: 500 })
  }
}
