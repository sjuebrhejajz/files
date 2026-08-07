import { NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireStaff, AuthError } from "@/lib/auth"

export async function GET(_req: Request, { params }: { params: Promise<{ username: string }> }) {
  try {
    await requireStaff()
    const { username } = await params

    const rows = await sql`
      select id, username, email, role, is_donator, bio, links_public, profile_picture_url, banner_url,
             two_fa_enabled, created_at
      from users
      where lower(username) = ${username.toLowerCase()}
    `
    const target = rows[0]
    if (!target) return NextResponse.json({ error: "User not found." }, { status: 404 })

    const ipRows = await sql`
      select ip, first_seen, last_seen from user_ips where user_id = ${target.id} order by last_seen desc limit 20
    `
    const ipList = ipRows.map((r) => r.ip as string)

    const [uploads, usernameEmailHits, moderation, ipHits] = await Promise.all([
      sql`
        select id, short_id, filename, content_type, size_bytes, created_at, expires_at
        from uploads where user_id = ${target.id} order by created_at desc limit 100
      `,
      sql`
        select type, value, reason from blacklist
        where (type = 'username' and value = ${String(target.username).toLowerCase()})
           or (type = 'email' and value = ${String(target.email).toLowerCase()})
      `,
      sql`
        select id, kind, object_key, status, reason, created_at
        from image_moderation where user_id = ${target.id} order by created_at desc limit 20
      `,
      // Guarded separately: binding an empty array to any() is untested with this
      // driver, so only run it when there's actually something to check.
      ipList.length > 0
        ? sql`select type, value, reason from blacklist where type = 'ip' and value = any(${ipList})`
        : Promise.resolve([]),
    ])

    return NextResponse.json({
      user: target,
      uploads: uploads.map((u) => ({
        id: u.id,
        filename: u.filename,
        contentType: u.content_type,
        sizeBytes: u.size_bytes,
        url: `/f/${u.short_id}`,
        viewUrl: `/v/${u.short_id}`,
        createdAt: u.created_at,
        expiresAt: u.expires_at,
      })),
      ips: ipRows,
      blacklistHits: [...usernameEmailHits, ...ipHits],
      moderation,
    })
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status })
    console.error("[admin/users/:username]", err)
    return NextResponse.json({ error: "Could not load user." }, { status: 500 })
  }
}
