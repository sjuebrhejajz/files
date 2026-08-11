"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Search } from "lucide-react"
import { RoleBadge } from "@/components/role-badge"
import { DonatorBadge } from "@/components/donator-badge"
import type { Role } from "@/lib/auth"

type Entry = { username: string; profile_picture_url: string | null; role: Role; is_donator: boolean }

const GROUP_LABELS: Record<Role, string> = {
  owner: "Owner",
  admin: "Administrator",
  moderator: "Moderators",
  tester: "Testers",
  user: "Users",
}

// Groups consecutive entries by role into sections with dividers. The API
// already orders admin -> moderator -> user, so a single pass is enough —
// no need to re-sort or bucket from scratch here.
function groupByRole(users: Entry[]) {
  const groups: { role: Role; items: Entry[] }[] = []
  for (const u of users) {
    const last = groups[groups.length - 1]
    if (last && last.role === u.role) last.items.push(u)
    else groups.push({ role: u.role, items: [u] })
  }
  return groups
}

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
        <div className="flex flex-col gap-5">
          {groupByRole(users).map((group, i) => (
            <div key={`${group.role}-${i}`} className="flex flex-col gap-2">
              {i > 0 && <div className="border-t border-border" />}
              <p className="px-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {GROUP_LABELS[group.role]}
              </p>
              <ul className="flex flex-col gap-2">
                {group.items.map((u) => (
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
                        {u.is_donator && <DonatorBadge />}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
