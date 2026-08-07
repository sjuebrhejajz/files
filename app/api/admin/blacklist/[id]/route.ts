import { NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireStaff, AuthError } from "@/lib/auth"

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireStaff()
    const { id } = await params
    await sql`delete from blacklist where id = ${id}`
    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status })
    console.error("[admin/blacklist/:id]", err)
    return NextResponse.json({ error: "Could not remove blacklist entry." }, { status: 500 })
  }
}
