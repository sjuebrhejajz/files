import { NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireCurrentUser, AuthError } from "@/lib/auth"

const MIN_AGE_DAYS = 3 // can't extend until the upload is at least this old
const EXTEND_BY_DAYS = 7 // each extension adds this many days
const COOLDOWN_DAYS = 3 // minimum gap between extensions
const MAX_LIFESPAN_DAYS = 10000 // hard ceiling from original upload — expires no matter what past this

const DAY_MS = 24 * 60 * 60 * 1000

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireCurrentUser()
    const { id } = await params

    // Ownership check happens in the WHERE clause, same pattern as DELETE on this resource.
    const rows = await sql`
      select created_at, expires_at, last_extended_at
      from uploads
      where id = ${id} and user_id = ${user.id}
    `
    const upload = rows[0]
    if (!upload) return NextResponse.json({ error: "Link not found." }, { status: 404 })

    const createdAt = new Date(upload.created_at as string)
    const expiresAt = new Date(upload.expires_at as string)
    const lastExtendedAt = upload.last_extended_at ? new Date(upload.last_extended_at as string) : null
    const now = new Date()

    if (now.getTime() - createdAt.getTime() < MIN_AGE_DAYS * DAY_MS) {
      return NextResponse.json(
        { error: `This link can be extended once it's ${MIN_AGE_DAYS} days old.` },
        { status: 400 },
      )
    }

    if (lastExtendedAt && now.getTime() - lastExtendedAt.getTime() < COOLDOWN_DAYS * DAY_MS) {
      const nextEligible = new Date(lastExtendedAt.getTime() + COOLDOWN_DAYS * DAY_MS)
      return NextResponse.json(
        { error: `You can extend this again on ${nextEligible.toLocaleDateString()}.` },
        { status: 400 },
      )
    }

    // Hard cap: no matter how many times a file gets extended, it can never
    // outlive 10,000 days from its original upload.
    const hardCap = new Date(createdAt.getTime() + MAX_LIFESPAN_DAYS * DAY_MS)
    if (expiresAt.getTime() >= hardCap.getTime()) {
      return NextResponse.json({ error: "This link has reached its maximum possible lifespan." }, { status: 400 })
    }

    const proposedExpiry = new Date(expiresAt.getTime() + EXTEND_BY_DAYS * DAY_MS)
    const newExpiry = proposedExpiry.getTime() > hardCap.getTime() ? hardCap : proposedExpiry

    await sql`
      update uploads set expires_at = ${newExpiry.toISOString()}, last_extended_at = ${now.toISOString()}
      where id = ${id}
    `

    return NextResponse.json({ ok: true, expires_at: newExpiry.toISOString(), last_extended_at: now.toISOString() })
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status })
    console.error("[user/links/:id/extend]", err)
    return NextResponse.json({ error: "Could not extend link." }, { status: 500 })
  }
}
