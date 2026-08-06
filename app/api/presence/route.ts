import { type NextRequest, NextResponse } from "next/server"
import { heartbeat, activeCount } from "@/lib/presence"

export const dynamic = "force-dynamic"

// Called periodically by any open tab (visible or not) to register presence.
export async function POST(request: NextRequest) {
  try {
    const { sessionId } = (await request.json()) as { sessionId: string }
    if (!sessionId) return NextResponse.json({ error: "Missing sessionId" }, { status: 400 })
    const count = await heartbeat(sessionId)
    return NextResponse.json({ count })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}

export async function GET() {
  try {
    const count = await activeCount()
    return NextResponse.json({ count })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
