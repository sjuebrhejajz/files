import { NextResponse } from "next/server"
import { HeadObjectCommand } from "@aws-sdk/client-s3"
import { sql } from "@/lib/db"
import { r2, BUCKET_NAME } from "@/lib/r2"
import { requireCurrentUser, AuthError } from "@/lib/auth"

// Must match the allowlist enforced at presign time in avatar-url/banner-url
// routes. Re-declared here (not imported) because this is the actual
// server-side re-validation step — see the SECURITY note below.
const ALLOWED_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif"])

export async function GET() {
  try {
    const user = await requireCurrentUser()
    const rows = await sql`
      select kind, status, reason from image_moderation
      where user_id = ${user.id} and kind in ('avatar', 'banner')
      order by created_at desc
    `
    // Most recent row per kind — used by the settings page to show
    // "pending review" / "denied: <reason>" banners.
    const latest: Record<string, { status: string; reason: string | null }> = {}
    for (const row of rows) {
      const kind = row.kind as string
      if (!latest[kind]) latest[kind] = { status: row.status as string, reason: row.reason as string | null }
    }
    return NextResponse.json(latest)
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status })
    console.error("[user/settings/image GET]", err)
    return NextResponse.json({ error: "Could not load image status." }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireCurrentUser()
    const body = await req.json()
    const kind = body.kind === "avatar" || body.kind === "banner" ? body.kind : null
    const key = String(body.key ?? "")

    if (!kind) return NextResponse.json({ error: "Invalid image kind." }, { status: 400 })

    const prefix = kind === "avatar" ? "avatars/" : "banners/"
    if (!key.startsWith(`${prefix}${user.id}-`)) {
      return NextResponse.json({ error: "Invalid upload key." }, { status: 400 })
    }

    // SECURITY: the prefix check above only confirms the key *string* looks
    // right — it was previously the only check, meaning this endpoint fully
    // trusted a client-supplied key with no verification that anything was
    // actually uploaded there, or that it's really an approved image type.
    // The presigned PUT does check content-type, but only at the moment of
    // upload (via the request signature) — nothing re-checked it afterward,
    // so a client could request a presign for an allowed type, then upload
    // completely different bytes while just claiming that content-type
    // header, and this endpoint would accept it into moderation regardless.
    // This HEAD request re-verifies against the same live object in R2,
    // independent of whatever the client claims: the object must actually
    // exist, and its actually-stored content-type must be on the allowlist.
    let head
    try {
      head = await r2.send(new HeadObjectCommand({ Bucket: BUCKET_NAME, Key: key }))
    } catch {
      return NextResponse.json({ error: "Uploaded file not found — try uploading again." }, { status: 400 })
    }
    const actualType = (head.ContentType ?? "").split(";")[0].trim().toLowerCase()
    if (!ALLOWED_IMAGE_TYPES.has(actualType)) {
      return NextResponse.json({ error: "That file isn't a supported image type." }, { status: 400 })
    }

    // Superseding any earlier still-pending submission of the same kind keeps the
    // moderation queue from accumulating duplicates from repeated re-uploads.
    await sql`
      update image_moderation set status = 'denied', reason = 'Superseded by a newer upload'
      where user_id = ${user.id} and kind = ${kind} and status = 'pending'
    `

    const rows = await sql`
      insert into image_moderation (user_id, kind, object_key, status)
      values (${user.id}, ${kind}, ${key}, 'pending')
      returning id
    `

    return NextResponse.json({ ok: true, id: rows[0].id })
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status })
    console.error("[user/settings/image POST]", err)
    return NextResponse.json({ error: "Could not submit image for review." }, { status: 500 })
  }
}
