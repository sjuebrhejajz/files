import { NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireAdmin, AuthError } from "@/lib/auth"
import { logModAction } from "@/lib/mod-log"

// SECURITY: explicit, independent of the Cache-Control header middleware.ts
// also sets on all /api/admin/* and /api/user/* routes. This stops Next.js
// from ever treating the route as cacheable in the first place. Added after
// confirming an admin-only endpoint's response was being served to a
// signed-out incognito request — nothing here previously told Next.js this
// data depends on who's asking.
export const dynamic = "force-dynamic"

// This whole route requires admin (not just staff) — see requireAdmin() below —
// which is what actually enforces "moderators can't promote anyone to bug
// hunter / donator / moderator". Moderators get a 403 before any action runs.
const ACTIONS = ["promote", "demote", "make_tester", "remove_tester", "make_donator", "remove_donator"] as const
type Action = (typeof ACTIONS)[number]

export async function POST(req: Request, { params }: { params: Promise<{ username: string }> }) {
  try {
    const actor = await requireAdmin()
    const { username } = await params
    const body = await req.json()
    const action: Action | null = ACTIONS.includes(body.action) ? body.action : null
    if (!action) return NextResponse.json({ error: "Invalid action." }, { status: 400 })

    const rows = await sql`select id, username, role, is_donator from users where lower(username) = ${username.toLowerCase()}`
    const target = rows[0]
    if (!target) return NextResponse.json({ error: "User not found." }, { status: 404 })

    if (target.username.toLowerCase() === "admin" || target.role === "admin") {
      return NextResponse.json({ error: "The admin account's role can't be changed." }, { status: 403 })
    }
    if (target.id === actor.id) {
      return NextResponse.json({ error: "You can't change your own role." }, { status: 400 })
    }

    if (action === "promote") {
      if (target.role !== "user") {
        return NextResponse.json({ error: "Only regular users can be promoted." }, { status: 400 })
      }
      await sql`update users set role = 'moderator' where id = ${target.id}`
    } else if (action === "demote") {
      if (target.role !== "moderator") {
        return NextResponse.json({ error: "Only moderators can be demoted." }, { status: 400 })
      }
      await sql`update users set role = 'user' where id = ${target.id}`
    } else if (action === "make_tester") {
      if (target.role !== "user") {
        return NextResponse.json({ error: "Only regular users can be made testers." }, { status: 400 })
      }
      await sql`update users set role = 'tester' where id = ${target.id}`
    } else if (action === "remove_tester") {
      if (target.role !== "tester") {
        return NextResponse.json({ error: "This user isn't a tester." }, { status: 400 })
      }
      await sql`update users set role = 'user' where id = ${target.id}`
    } else if (action === "make_donator") {
      if (target.is_donator) {
        return NextResponse.json({ error: "This user is already a donator." }, { status: 400 })
      }
      await sql`update users set is_donator = true where id = ${target.id}`
    } else {
      // remove_donator
      if (!target.is_donator) {
        return NextResponse.json({ error: "This user isn't a donator." }, { status: 400 })
      }
      await sql`update users set is_donator = false where id = ${target.id}`
    }

    await logModAction(actor, action, target.username)

    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status })
    console.error("[admin/users/:username/role]", err)
    return NextResponse.json({ error: "Could not update role." }, { status: 500 })
  }
}
