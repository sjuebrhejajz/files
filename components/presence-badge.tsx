"use client"

import { useEffect, useState } from "react"

function getSessionId() {
  if (typeof window === "undefined") return ""
  const key = "presence-session-id"
  let id = sessionStorage.getItem(key)
  if (!id) {
    id = crypto.randomUUID()
    sessionStorage.setItem(key, id)
  }
  return id
}

// Counts how many browser tabs currently have this site open — regardless of
// whether the tab is focused, scrolled, or clicked. Backed by a small JSON
// heartbeat file in R2 (see lib/presence.ts); not a database, just enough for
// a live "active now" indicator on a low-traffic personal site.
export function PresenceBadge() {
  const [count, setCount] = useState<number | null>(null)

  useEffect(() => {
    const sessionId = getSessionId()
    let cancelled = false

    const ping = async () => {
      try {
        const res = await fetch("/api/presence", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId }),
        })
        const data = await res.json()
        if (!cancelled && typeof data.count === "number") setCount(data.count)
      } catch {
        // ignore transient failures
      }
    }

    ping()
    const interval = setInterval(ping, 8000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [])

  if (count === null) return null

  return (
    <div className="animate-in fade-in zoom-in-95 duration-300 inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground transition-colors">
      <span className="relative flex size-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
        <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
      </span>
      <span key={count} className="animate-in fade-in slide-in-from-bottom-0.5 duration-200">
        {count} active now
      </span>
    </div>
  )
}
