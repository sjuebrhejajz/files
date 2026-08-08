import { NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireStaff, AuthError } from "@/lib/auth"

// SECURITY: explicit, independent of the Cache-Control header middleware.ts
// also sets on all /api/admin/* and /api/user/* routes. This stops Next.js
// from ever treating the route as cacheable in the first place. Added after
// confirming an admin-only endpoint's response was being served to a
// signed-out incognito request — nothing here previously told Next.js this
// data depends on who's asking.
export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  try {
    await requireStaff()
    const { searchParams } = new URL(req.url)
    const q = (searchParams.get("q") ?? "").trim()

    const rows = q
      ? await sql`
          select u.id, u.short_id, u.filename, u.content_type, u.size_bytes, u.created_at, u.expires_at,
                 usr.username as uploader_username
          from uploads u
          left join users usr on usr.id = u.user_id
          where u.filename ilike ${"%" + q + "%"} or usr.username ilike ${"%" + q + "%"}
          order by u.created_at desc
          limit 200
        `
      : await sql`
          select u.id, u.short_id, u.filename, u.content_type, u.size_bytes, u.created_at, u.expires_at,
                 usr.username as uploader_username
          from uploads u
          left join users usr on usr.id = u.user_id
          order by u.created_at desc
          limit 200
        `

    return NextResponse.json({
      uploads: rows.map((r) => ({
        id: r.id,
        filename: r.filename,
        contentType: r.content_type,
        sizeBytes: r.size_bytes,
        uploader: r.uploader_username ?? null,
        url: `/f/${r.short_id}`,
        viewUrl: `/v/${r.short_id}`,
        createdAt: r.created_at,
        expiresAt: r.expires_at,
      })),
    })
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status })
    console.error("[admin/uploads]", err)
    return NextResponse.json({ error: "Could not load uploads." }, { status: 500 })
  }
}
