import { NextResponse } from "next/server"
import { sql } from "@/lib/db"

// Public, unauthenticated directory search — backs /users. Deliberately not
// linked from any nav, but reachable by anyone who knows the URL. Ordered
// admin -> moderators -> everyone else, so the client can render it as a
// simple hierarchy (see components/public/users-directory.tsx).
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const q = (searchParams.get("q") ?? "").trim()

    const rows = q
      ? await sql`
          select username, profile_picture_url, role, is_donator
          from users
          where username ilike ${"%" + q + "%"}
          order by case role when 'admin' then 0 when 'moderator' then 1 when 'tester' then 2 else 3 end, username asc
          limit 40
        `
      : await sql`
          select username, profile_picture_url, role, is_donator
          from users
          order by case role when 'admin' then 0 when 'moderator' then 1 when 'tester' then 2 else 3 end, username asc
          limit 40
        `

    return NextResponse.json({ users: rows })
  } catch (err) {
    console.error("[users]", err)
    return NextResponse.json({ error: "Could not load users." }, { status: 500 })
  }
}
