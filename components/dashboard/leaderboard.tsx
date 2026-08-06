"use client"

import { useEffect, useState } from "react"
import { Trophy } from "lucide-react"

type Entry = {
  username: string
  profile_picture_url: string | null
  total_cents: number
}

const MEDALS = ["🥇", "🥈", "🥉"]

export function Leaderboard() {
  const [entries, setEntries] = useState<Entry[] | null>(null)

  useEffect(() => {
    fetch("/api/leaderboard")
      .then((r) => r.json())
      .then((data) => setEntries(data.leaderboard ?? []))
      .catch(() => setEntries([]))
  }, [])

  if (!entries) return <p className="text-xs text-muted-foreground">Loading…</p>
  if (entries.length === 0) return <p className="text-xs text-muted-foreground">No donations yet — be the first!</p>

  return (
    <ul className="flex flex-col gap-2">
      {entries.map((entry, i) => (
        <li key={entry.username} className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
          <span className="text-lg">{MEDALS[i]}</span>
          {entry.profile_picture_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={entry.profile_picture_url} alt={entry.username} className="size-8 rounded-full object-cover" />
          ) : (
            <div className="flex size-8 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-secondary-foreground">
              {entry.username.slice(0, 1).toUpperCase()}
            </div>
          )}
          <span className="flex-1 truncate text-sm font-medium text-foreground">{entry.username}</span>
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Trophy className="size-3.5" />£{(entry.total_cents / 100).toFixed(2)}
          </span>
        </li>
      ))}
    </ul>
  )
}
