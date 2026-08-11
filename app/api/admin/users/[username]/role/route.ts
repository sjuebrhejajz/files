import { NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireAdmin, isOwner, AuthError } from "@/lib/auth"
import { logModAction } from "@/lib/mod-log"

// SECURITY: explicit, independent of the Cache-Control header middleware.ts
// also sets on all /api/admin/* and /api/user/* routes.
export const dynamic = "force-dynamic"

// requireAdmin() (below) lets both admin and owner through as a baseline —
// OWNER_ONLY_ACTIONS then narrows specific actions down further to owner
// only. Admin can promote/demote between user<->moderator and grant/revoke
// tester status; only owner can promote a moderator to admin (or reverse
// it), and only owner can grant/revoke donator status.
const ACTIONS = [
  "promote", // user -> moderator
  "demote", // moderator -> user
  "promote_to_admin", // moderator -> admin (owner only)
  "demote_from_admin", // admin -> moderator (owner only)
  "make_tester", // user -> tester
  "remove_tester", // tester -> user
  "make_donator", // owner only
  "remove_donator", // owner only
] as const
type Action = (typeof ACTIONS)[number]

const OWNER_ONLY_ACTIONS = new Set<Action>(["promote_to_admin", "demote_from_admin", "make_donator", "remove_donator"])

export async function POST(req: Request, { params }: { params: Promise<{ username: string }> }) {
  try {
    const actor = await requireAdmin()
    const { username } = await params
    const body = await req.json()
    const action: Action | null = ACTIONS.includes(body.action) ? body.action : null
    if (!action) return NextResponse.json({ error: "Invalid action." }, { status: 400 })

    if (OWNER_ONLY_ACTIONS.has(action) && !isOwner(actor)) {
      return NextResponse.json({ error: "Only the owner can do that." }, { status: 403 })
    }

    const rows = await sql`select id, username, role, is_donator from users where lower(username) = ${username.toLowerCase()}`
    const target = rows[0]
    if (!target) return NextResponse.json({ error: "User not found." }, { status: 404 })

    // The "admin" account specifically, and any owner account, are
    // protected from having their role changed through this route at all —
    // that needs direct database access, same as how the original admin
    // account was bootstrapped in the first place.
    if (String(target.username).toLowerCase() === "admin" || target.role === "owner") {
      return NextResponse.json({ error: "This account's role can't be changed here." }, { status: 403 })
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
    } else if (action === "promote_to_admin") {
      if (target.role !== "moderator") {
        return NextResponse.json({ error: "Only moderators can be promoted to admin." }, { status: 400 })
      }
      await sql`update users set role = 'admin' where id = ${target.id}`
    } else if (action === "demote_from_admin") {
      if (target.role !== "admin") {
        return NextResponse.json({ error: "Only admins can be demoted." }, { status: 400 })
      }
      await sql`update users set role = 'moderator' where id = ${target.id}`
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
