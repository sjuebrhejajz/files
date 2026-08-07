"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Search } from "lucide-react"
import { RoleBadge } from "@/components/role-badge"
import type { Role } from "@/lib/auth"

type Entry = { username: string; profile_picture_url: string | null; role: Role }

export function UsersDirectory() {
  const [query, setQuery] = useState("")
  const [users, setUsers] = useState<Entry[] | null>(null)

  useEffect(() => {
    const handle = setTimeout(() => {
      fetch(`/api/users?q=${encodeURIComponent(query)}`)
        .then((r) => r.json())
        .then((data) => setUsers(data.users ?? []))
        .catch(() => setUsers([]))
    }, 250)
    return () => clearTimeout(handle)
  }, [query])

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2">
        <Search className="size-3.5 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search usernames…"
          className="w-full bg-transparent text-sm text-foreground outline-none"
        />
      </div>

      {!users ? (
        <p className="text-xs text-muted-foreground">Loading…</p>
      ) : users.length === 0 ? (
        <p className="text-xs text-muted-foreground">No users found.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {users.map((u) => (
            <li key={u.username}>
              <Link
                href={`/users/${u.username}`}
                className="flex items-center gap-3 rounded-lg border border-border bg-card p-3 hover:border-primary/40"
              >
                {u.profile_picture_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={u.profile_picture_url} alt={u.username} className="size-8 rounded-full object-cover" />
                ) : (
                  <div className="flex size-8 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-secondary-foreground">
                    {u.username.slice(0, 1).toUpperCase()}
                  </div>
                )}
                <span className="flex flex-1 items-center gap-1.5 truncate text-sm font-medium text-foreground">
                  {u.username}
                  <RoleBadge role={u.role} />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
