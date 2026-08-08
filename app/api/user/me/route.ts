import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"

// SECURITY: explicit, independent of the Cache-Control header middleware.ts
// also sets on /api/user/*. This is the "who's logged in" check every page
// uses — if a cached response from one session were ever served to another
// visitor, they'd see someone else's account in the header. Belt and
// suspenders alongside the middleware fix, given how sensitive this specific
// response is.
export const dynamic = "force-dynamic"

export async function GET() {
  const user = await getCurrentUser()
  const res = NextResponse.json({ user })
  res.headers.set("Cache-Control", "no-store, private")
  return res
}
