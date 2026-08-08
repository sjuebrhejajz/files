"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Creepster } from "next/font/google"
import {
  ArrowLeft,
  Award,
  Ban,
  Bug,
  CircleDollarSign,
  Crown,
  ExternalLink,
  Loader2,
  Search,
  ShieldCheck,
  ShieldX,
  Trash2,
  UserMinus,
} from "lucide-react"
import type { PublicUser, Role } from "@/lib/auth"
import { RoleBadge } from "@/components/role-badge"
import { DonatorBadge } from "@/components/donator-badge"
import { CustomBadge } from "@/components/custom-badge"

const spooky = Creepster({ subsets: ["latin"], weight: "400" })

type Tab = "users" | "blacklist" | "moderation" | "uploads" | "badges" | "logs"

type UserRow = {
  id: string
  username: string
  email: string
  role: Role
  is_donator: boolean
  two_fa_enabled: boolean
  created_at: string
}

type BlacklistEntry = {
  id: string
  type: "ip" | "username" | "email"
  value: string
  reason: string | null
  created_at: string
  created_by_username: string | null
}

type ModerationItem = {
  id: string
  kind: "avatar" | "banner"
  previewUrl: string
  status: string
  reason: string | null
  createdAt: string
  username: string
  userId: string
}

type IpRow = { ip: string; first_seen: string; last_seen: string }

type UserDetailData = {
  user: UserRow & {
    bio: string | null
    links_public: boolean
    profile_picture_url: string | null
    banner_url: string | null
  }
  uploads: { id: string; filename: string; url: string; viewUrl: string; createdAt: string }[]
  ips: IpRow[]
  blacklistHits: { type: string; value: string; reason: string | null }[]
  moderation: { id: string; kind: string; status: string; reason: string | null; createdAt: string }[]
}

async function call(url: string, body?: unknown, method: "GET" | "POST" | "DELETE" = "POST") {
  const res = await fetch(url, {
    method,
    headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || "Something went wrong.")
  return data
}

export function BackendPanel({ currentUser }: { currentUser: PublicUser }) {
  const [tab, setTab] = useState<Tab>("users")
  const isAdmin = currentUser.role === "admin"

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col px-4 py-10">
      <Link href="/dashboard" className="mb-6 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary">
        <ArrowLeft className="size-3.5" /> Back to dashboard
      </Link>

      <h1 className={`${spooky.className} mb-1 text-5xl leading-none text-destructive`}>The Backend</h1>
      <p className="mb-8 text-xs text-muted-foreground">
        Staff tools · signed in as {currentUser.username} ({currentUser.role})
      </p>

      <div className="mb-6 flex gap-1 border-b border-border">
        {(
          ["users", "blacklist", "moderation", "uploads", "logs", ...(isAdmin ? (["badges"] as Tab[]) : [])] as Tab[]
        ).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`px-3 py-2 text-xs font-medium capitalize transition-colors ${
              tab === t ? "border-b-2 border-primary text-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t === "moderation" ? "Moderation Queue" : t === "uploads" ? "All Uploads" : t}
          </button>
        ))}
      </div>

      {tab === "users" && <UsersTab isAdmin={isAdmin} currentUser={currentUser} />}
      {tab === "blacklist" && <BlacklistTab />}
      {tab === "moderation" && <ModerationTab />}
      {tab === "uploads" && <UploadsTab />}
      {tab === "logs" && <LogsTab isAdmin={isAdmin} />}
      {tab === "badges" && isAdmin && <BadgesTab />}
    </main>
  )
}

// ==================== Users tab ====================

function UsersTab({ isAdmin, currentUser }: { isAdmin: boolean; currentUser: PublicUser }) {
  const [query, setQuery] = useState("")
  const [users, setUsers] = useState<UserRow[] | null>(null)
  const [selected, setSelected] = useState<string | null>(null)

  const load = useCallback(() => {
    call(`/api/admin/users?q=${encodeURIComponent(query)}`, undefined, "GET")
      .then((data) => setUsers(data.users))
      .catch(() => setUsers([]))
  }, [query])

  useEffect(() => {
    const handle = setTimeout(load, 250)
    return () => clearTimeout(handle)
  }, [load])

  if (selected) {
    return (
      <UserDetail
        username={selected}
        isAdmin={isAdmin}
        currentUser={currentUser}
        onBack={() => {
          setSelected(null)
          load()
        }}
      />
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2">
        <Search className="size-3.5 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by username or email…"
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
            <li key={u.id}>
              <button
                type="button"
                onClick={() => setSelected(u.username)}
                className="flex w-full items-center gap-3 rounded-lg border border-border bg-card p-3 text-left hover:border-primary/40"
              >
                <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-secondary-foreground">
                  {u.username.slice(0, 1).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 truncate text-sm font-medium text-foreground">
                    {u.username}
                    <RoleBadge role={u.role} />
                    {u.is_donator && <DonatorBadge />}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                </div>
                <span className="shrink-0 text-[11px] capitalize text-muted-foreground">{u.role}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function UserDetail({
  username,
  isAdmin,
  currentUser,
  onBack,
}: {
  username: string
  isAdmin: boolean
  currentUser: PublicUser
  onBack: () => void
}) {
  const [data, setData] = useState<UserDetailData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [banReason, setBanReason] = useState("")
  const [newUsername, setNewUsername] = useState("")

  const load = useCallback(() => {
    call(`/api/admin/users/${encodeURIComponent(username)}`, undefined, "GET")
      .then((result: UserDetailData) => setData(result))
      .catch((err) => setError((err as Error).message))
  }, [username])

  useEffect(() => {
    load()
  }, [load])

  if (error) return <p className="text-xs text-destructive">{error}</p>
  if (!data) return <p className="text-xs text-muted-foreground">Loading…</p>

  const target = data.user
  const isTargetAdmin = target.username.toLowerCase() === "admin"
  const targetIsStaff = target.role === "moderator" || target.role === "admin" || isTargetAdmin
  const isSelf = target.id === currentUser.id
  const canRename = !isTargetAdmin && (!targetIsStaff || isAdmin)

  const doRole = async (
    action: "promote" | "demote" | "make_tester" | "remove_tester" | "make_donator" | "remove_donator",
  ) => {
    setActionLoading(true)
    setError(null)
    try {
      await call(`/api/admin/users/${encodeURIComponent(username)}/role`, { action })
      load()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setActionLoading(false)
    }
  }

  const forceRename = async () => {
    if (!newUsername.trim()) return
    setActionLoading(true)
    setError(null)
    try {
      await call(`/api/admin/users/${encodeURIComponent(username)}/username`, { username: newUsername })
      setNewUsername("")
      // The old username is now stale (it just changed), so bounce back to the
      // list — a fresh lookup by the new name isn't wired up on this screen.
      onBack()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setActionLoading(false)
    }
  }

  const banUser = async () => {
    const confirmed = window.confirm(
      `Ban ${target.username}? This permanently deletes their account and all uploaded links. This can't be undone.`,
    )
    if (!confirmed) return

    setActionLoading(true)
    setError(null)
    try {
      const result = await call(`/api/admin/users/${encodeURIComponent(username)}/ban`, { reason: banReason })
      const ips = (result.ips as string[]) ?? []
      const addIps = window.confirm("User has been banned from platform. Would you also like to add them as an IP blacklist?")
      if (addIps) {
        for (const ip of ips) {
          try {
            await call("/api/admin/blacklist", { type: "ip", value: ip, reason: banReason || "Banned via admin panel" })
          } catch {
            // best-effort — one failed IP shouldn't block the rest
          }
        }
      }
      onBack()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setActionLoading(false)
    }
  }

  const blacklistIp = async (ip: string) => {
    setActionLoading(true)
    setError(null)
    try {
      const result = await call("/api/admin/blacklist", {
        type: "ip",
        value: ip,
        reason: `From ${target.username}'s known IPs`,
      })
      const purged = (result.purgedUsernames as string[]) ?? []
      if (purged.length > 0) {
        window.alert(`Also deleted ${purged.length} account(s) tied to this IP: ${purged.join(", ")}`)
      }
      load()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setActionLoading(false)
    }
  }

  const removeBlacklistHit = async (type: string, value: string) => {
    setActionLoading(true)
    setError(null)
    try {
      const list = await call("/api/admin/blacklist", undefined, "GET")
      const match = (list.entries as BlacklistEntry[]).find((e) => e.type === type && e.value === value)
      if (match) await call(`/api/admin/blacklist/${match.id}`, undefined, "DELETE")
      load()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setActionLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <button type="button" onClick={onBack} className="flex w-fit items-center gap-1.5 text-xs text-muted-foreground hover:text-primary">
        <ArrowLeft className="size-3.5" /> Back to users
      </button>

      {error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>}

      <div className="rounded-xl border border-border bg-card p-4">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-base font-semibold text-foreground">
              {target.username}
              <RoleBadge role={target.role} />
              {target.is_donator && <DonatorBadge />}
            </p>
            <p className="truncate text-xs text-muted-foreground">{target.email}</p>
          </div>
          <span className="shrink-0 text-[11px] capitalize text-muted-foreground">
            {target.role} · joined {new Date(target.created_at).toLocaleDateString()}
          </span>
        </div>

        {target.bio && <p className="mb-3 text-xs text-foreground">{target.bio}</p>}

        <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
          <span>2FA: {target.two_fa_enabled ? "enabled" : "disabled"}</span>
          <span>Links public: {target.links_public ? "yes" : "no"}</span>
        </div>

        {isAdmin && target.role === "user" && !isSelf && (
          <button
            type="button"
            disabled={actionLoading}
            onClick={() => doRole("promote")}
            className="mt-3 mr-2 inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
          >
            <Crown className="size-3.5" /> Promote to moderator
          </button>
        )}
        {isAdmin && target.role === "moderator" && !isSelf && (
          <button
            type="button"
            disabled={actionLoading}
            onClick={() => doRole("demote")}
            className="mt-3 mr-2 inline-flex items-center gap-1.5 rounded-md bg-secondary px-3 py-1.5 text-xs font-medium text-secondary-foreground hover:bg-accent disabled:opacity-60"
          >
            <UserMinus className="size-3.5" /> Demote to user
          </button>
        )}
        {isAdmin && target.role === "user" && !isSelf && (
          <button
            type="button"
            disabled={actionLoading}
            onClick={() => doRole("make_tester")}
            className="mt-3 mr-2 inline-flex items-center gap-1.5 rounded-md bg-secondary px-3 py-1.5 text-xs font-medium text-secondary-foreground hover:bg-accent disabled:opacity-60"
          >
            <Bug className="size-3.5" /> Make tester
          </button>
        )}
        {isAdmin && target.role === "tester" && !isSelf && (
          <button
            type="button"
            disabled={actionLoading}
            onClick={() => doRole("remove_tester")}
            className="mt-3 mr-2 inline-flex items-center gap-1.5 rounded-md bg-secondary px-3 py-1.5 text-xs font-medium text-secondary-foreground hover:bg-accent disabled:opacity-60"
          >
            <UserMinus className="size-3.5" /> Remove tester
          </button>
        )}
        {isAdmin && !target.is_donator && !isSelf && (
          <button
            type="button"
            disabled={actionLoading}
            onClick={() => doRole("make_donator")}
            className="mt-3 mr-2 inline-flex items-center gap-1.5 rounded-md bg-secondary px-3 py-1.5 text-xs font-medium text-secondary-foreground hover:bg-accent disabled:opacity-60"
          >
            <CircleDollarSign className="size-3.5" /> Make donator
          </button>
        )}
        {isAdmin && target.is_donator && !isSelf && (
          <button
            type="button"
            disabled={actionLoading}
            onClick={() => doRole("remove_donator")}
            className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-secondary px-3 py-1.5 text-xs font-medium text-secondary-foreground hover:bg-accent disabled:opacity-60"
          >
            <UserMinus className="size-3.5" /> Remove donator
          </button>
        )}
      </div>

      {isAdmin && !isSelf && <UserBadgesSection username={target.username} />}

      {canRename && (
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="mb-3 text-sm font-medium text-foreground">Force rename</h3>
          <div className="flex gap-2">
            <input
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value)}
              placeholder="New username"
              className="min-w-0 flex-1 rounded-md border border-border bg-background px-2 py-1.5 text-xs text-foreground outline-none focus:border-primary"
            />
            <button
              type="button"
              disabled={actionLoading}
              onClick={forceRename}
              className="shrink-0 rounded-md bg-secondary px-3 py-1.5 text-xs font-medium text-secondary-foreground hover:bg-accent disabled:opacity-60"
            >
              Rename
            </button>
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Same rules as normal signup apply: 5–20 characters, letters and numbers only, no blacklisted or banned words.
          </p>
        </div>
      )}

      <div className="rounded-xl border border-border bg-card p-4">
        <h3 className="mb-3 text-sm font-medium text-foreground">Uploaded files ({data.uploads.length})</h3>
        {data.uploads.length === 0 ? (
          <p className="text-xs text-muted-foreground">No files.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {data.uploads.map((f) => (
              <li key={f.id} className="flex items-center justify-between gap-2 rounded-md border border-border p-2 text-xs">
                <span className="truncate text-foreground">{f.filename}</span>
                <a href={f.viewUrl} target="_blank" rel="noreferrer" className="flex shrink-0 items-center gap-1 text-primary hover:underline">
                  Preview <ExternalLink className="size-3" />
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <h3 className="mb-3 text-sm font-medium text-foreground">Known IP addresses</h3>
        {data.ips.length === 0 ? (
          <p className="text-xs text-muted-foreground">No recorded IPs yet — only logged from logins after this update.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {data.ips.map((row) => (
              <li key={row.ip} className="flex items-center justify-between gap-2 rounded-md border border-border p-2 text-xs">
                <div className="min-w-0">
                  <p className="truncate font-mono text-foreground">{row.ip}</p>
                  <p className="text-[11px] text-muted-foreground">last seen {new Date(row.last_seen).toLocaleString()}</p>
                </div>
                {!targetIsStaff && (
                  <button
                    type="button"
                    disabled={actionLoading}
                    onClick={() => blacklistIp(row.ip)}
                    className="flex shrink-0 items-center gap-1 rounded-md bg-destructive/10 px-2 py-1 text-[11px] font-medium text-destructive hover:bg-destructive/20 disabled:opacity-60"
                  >
                    <Ban className="size-3" /> Blacklist
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <h3 className="mb-3 text-sm font-medium text-foreground">Ban</h3>

        {data.blacklistHits.length > 0 && (
          <ul className="mb-3 flex flex-col gap-2">
            {data.blacklistHits.map((hit) => (
              <li
                key={`${hit.type}-${hit.value}`}
                className="flex items-center justify-between gap-2 rounded-md bg-destructive/10 px-2.5 py-1.5 text-xs text-destructive"
              >
                <span className="truncate">
                  {hit.type}: {hit.value}
                  {hit.reason ? ` — ${hit.reason}` : ""}
                </span>
                <button type="button" onClick={() => removeBlacklistHit(hit.type, hit.value)} className="shrink-0 hover:underline">
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}

        {targetIsStaff ? (
          <p className="text-xs text-muted-foreground">Staff and the admin account can&apos;t be banned.</p>
        ) : (
          <div className="flex flex-col gap-2">
            <input
              value={banReason}
              onChange={(e) => setBanReason(e.target.value)}
              placeholder="Reason (optional)"
              className="rounded-md border border-border bg-background px-2 py-1.5 text-xs text-foreground outline-none focus:border-primary"
            />
            <button
              type="button"
              disabled={actionLoading}
              onClick={banUser}
              className="flex w-fit items-center gap-1.5 rounded-md bg-destructive/10 px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/20 disabled:opacity-60"
            >
              <Ban className="size-3.5" /> Ban user
            </button>
            <p className="text-[11px] text-muted-foreground">
              Deletes their account and all uploaded links, and blacklists their username and email. This can&apos;t be undone.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

// ==================== Per-user badge assignment ====================

type BadgeItem = { id: string; name: string; imageUrl: string }

function UserBadgesSection({ username }: { username: string }) {
  const [allBadges, setAllBadges] = useState<BadgeItem[] | null>(null)
  const [assigned, setAssigned] = useState<BadgeItem[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    Promise.all([
      call("/api/admin/badges", undefined, "GET"),
      call(`/api/admin/users/${encodeURIComponent(username)}/badges`, undefined, "GET"),
    ])
      .then(([all, mine]) => {
        setAllBadges(all.badges)
        setAssigned(mine.badges)
      })
      .catch((err) => setError((err as Error).message))
  }, [username])

  useEffect(() => {
    load()
  }, [load])

  const grant = async (badgeId: string) => {
    setLoading(true)
    setError(null)
    try {
      await call(`/api/admin/users/${encodeURIComponent(username)}/badges`, { badgeId })
      load()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const revoke = async (badgeId: string) => {
    setLoading(true)
    setError(null)
    try {
      await call(`/api/admin/users/${encodeURIComponent(username)}/badges?badgeId=${badgeId}`, undefined, "DELETE")
      load()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  if (!allBadges || !assigned) return null

  const assignedIds = new Set(assigned.map((b) => b.id))
  const available = allBadges.filter((b) => !assignedIds.has(b.id))

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <h3 className="mb-3 text-sm font-medium text-foreground">Badges</h3>
      {error && <p className="mb-2 rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>}

      {assigned.length > 0 && (
        <ul className="mb-3 flex flex-wrap gap-2">
          {assigned.map((b) => (
            <li key={b.id} className="flex items-center gap-1.5 rounded-full border border-border bg-secondary/60 px-2.5 py-1 text-xs">
              <CustomBadge name={b.name} imageUrl={b.imageUrl} />
              {b.name}
              <button type="button" disabled={loading} onClick={() => revoke(b.id)} className="text-muted-foreground hover:text-destructive">
                <Trash2 className="size-3" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {available.length === 0 ? (
        allBadges.length === 0 ? (
          <p className="text-xs text-muted-foreground">No badge types created yet — add one in the Badges tab.</p>
        ) : (
          <p className="text-xs text-muted-foreground">All existing badges are already assigned.</p>
        )
      ) : (
        <div className="flex flex-wrap gap-2">
          {available.map((b) => (
            <button
              key={b.id}
              type="button"
              disabled={loading}
              onClick={() => grant(b.id)}
              className="flex items-center gap-1.5 rounded-full border border-dashed border-border px-2.5 py-1 text-xs text-muted-foreground hover:border-primary/40 hover:text-foreground disabled:opacity-60"
            >
              <CustomBadge name={b.name} imageUrl={b.imageUrl} />
              + {b.name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ==================== Blacklist tab ====================


function BlacklistTab() {
  const [entries, setEntries] = useState<BlacklistEntry[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [type, setType] = useState<"ip" | "username" | "email">("ip")
  const [value, setValue] = useState("")
  const [reason, setReason] = useState("")
  const [loading, setLoading] = useState(false)

  const load = useCallback(() => {
    call("/api/admin/blacklist", undefined, "GET")
      .then((data) => setEntries(data.entries))
      .catch((err) => setError((err as Error).message))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const add = async () => {
    if (!value.trim()) return
    setLoading(true)
    setError(null)
    try {
      const result = await call("/api/admin/blacklist", { type, value, reason })
      const purged = (result.purgedUsernames as string[]) ?? []
      if (purged.length > 0) {
        window.alert(`Also deleted ${purged.length} account(s) tied to this ${type}: ${purged.join(", ")}`)
      }
      setValue("")
      setReason("")
      load()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const remove = async (id: string) => {
    setLoading(true)
    setError(null)
    try {
      await call(`/api/admin/blacklist/${id}`, undefined, "DELETE")
      load()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>}

      <div className="rounded-xl border border-border bg-card p-4">
        <h3 className="mb-3 text-sm font-medium text-foreground">Add entry</h3>
        <p className="mb-3 text-[11px] text-destructive">
          Blacklisting also permanently deletes any account (and its files) tied to this value — not just future
          signups.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <select
            value={type}
            onChange={(e) => setType(e.target.value as "ip" | "username" | "email")}
            className="rounded-md border border-border bg-background px-2 py-1.5 text-xs text-foreground outline-none"
          >
            <option value="ip">IP</option>
            <option value="username">Username</option>
            <option value="email">Email</option>
          </select>
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Value"
            className="min-w-0 flex-1 rounded-md border border-border bg-background px-2 py-1.5 text-xs text-foreground outline-none focus:border-primary"
          />
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason (optional)"
            className="min-w-0 flex-1 rounded-md border border-border bg-background px-2 py-1.5 text-xs text-foreground outline-none focus:border-primary"
          />
          <button
            type="button"
            disabled={loading}
            onClick={add}
            className="flex shrink-0 items-center justify-center gap-1.5 rounded-md bg-destructive/10 px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/20 disabled:opacity-60"
          >
            {loading ? <Loader2 className="size-3.5 animate-spin" /> : <Ban className="size-3.5" />} Add
          </button>
        </div>
      </div>

      {!entries ? (
        <p className="text-xs text-muted-foreground">Loading…</p>
      ) : entries.length === 0 ? (
        <p className="text-xs text-muted-foreground">Blacklist is empty.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {entries.map((e) => (
            <li key={e.id} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-3">
              <div className="min-w-0">
                <p className="text-xs font-medium text-foreground">
                  <span className="uppercase text-muted-foreground">{e.type}</span> {e.value}
                </p>
                <p className="truncate text-[11px] text-muted-foreground">
                  {e.reason || "No reason given"} · added by {e.created_by_username ?? "unknown"}
                </p>
              </div>
              <button type="button" onClick={() => remove(e.id)} className="shrink-0 text-muted-foreground hover:text-destructive">
                <Trash2 className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ==================== Moderation Queue tab ====================

function ModerationTab() {
  const [items, setItems] = useState<ModerationItem[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loadingId, setLoadingId] = useState<string | null>(null)

  const load = useCallback(() => {
    call("/api/admin/moderation", undefined, "GET")
      .then((data) => setItems(data.items))
      .catch((err) => setError((err as Error).message))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const act = async (id: string, action: "approve" | "deny" | "ban") => {
    let reason: string | null = null
    if (action !== "approve") {
      reason = window.prompt(`Reason for ${action} (optional):`) || null
    }
    setLoadingId(id)
    setError(null)
    try {
      await call(`/api/admin/moderation/${id}`, { action, reason })
      load()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoadingId(null)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>}

      {!items ? (
        <p className="text-xs text-muted-foreground">Loading…</p>
      ) : items.length === 0 ? (
        <p className="text-xs text-muted-foreground">Nothing pending review.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((item) => (
            <li key={item.id} className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3 sm:flex-row sm:items-center">
              <div className="flex items-center gap-3">
                <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-md bg-secondary">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={item.previewUrl} alt="" className="size-full object-cover" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">
                    {item.username} <span className="text-xs capitalize text-muted-foreground">· {item.kind}</span>
                  </p>
                  <p className="text-[11px] text-muted-foreground">{new Date(item.createdAt).toLocaleString()}</p>
                </div>
              </div>
              <div className="flex shrink-0 gap-1.5 sm:ml-auto">
                <button
                  type="button"
                  disabled={loadingId === item.id}
                  onClick={() => act(item.id, "approve")}
                  className="flex items-center gap-1 rounded-md bg-primary px-2.5 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
                >
                  <ShieldCheck className="size-3.5" /> Approve
                </button>
                <button
                  type="button"
                  disabled={loadingId === item.id}
                  onClick={() => act(item.id, "deny")}
                  className="flex items-center gap-1 rounded-md bg-secondary px-2.5 py-1.5 text-xs font-medium text-secondary-foreground hover:bg-accent disabled:opacity-60"
                >
                  <ShieldX className="size-3.5" /> Deny
                </button>
                <button
                  type="button"
                  disabled={loadingId === item.id}
                  onClick={() => act(item.id, "ban")}
                  className="flex items-center gap-1 rounded-md bg-destructive/10 px-2.5 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/20 disabled:opacity-60"
                >
                  <Ban className="size-3.5" /> Ban
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ==================== All Uploads tab ====================

type UploadRow = {
  id: string
  filename: string
  uploader: string | null
  url: string
  viewUrl: string
  createdAt: string
  expiresAt: string
}

function UploadsTab() {
  const [query, setQuery] = useState("")
  const [uploads, setUploads] = useState<UploadRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const load = useCallback(() => {
    call(`/api/admin/uploads?q=${encodeURIComponent(query)}`, undefined, "GET")
      .then((data) => setUploads(data.uploads))
      .catch((err) => setError((err as Error).message))
  }, [query])

  useEffect(() => {
    const handle = setTimeout(load, 250)
    return () => clearTimeout(handle)
  }, [load])

  const remove = async (upload: UploadRow) => {
    if (!window.confirm(`Delete "${upload.filename}"? This can't be undone.`)) return
    setDeletingId(upload.id)
    setError(null)
    try {
      await call(`/api/admin/uploads/${upload.id}`, undefined, "DELETE")
      setUploads((list) => (list ? list.filter((u) => u.id !== upload.id) : list))
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>}

      <div className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2">
        <Search className="size-3.5 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by filename or uploader…"
          className="w-full bg-transparent text-sm text-foreground outline-none"
        />
      </div>

      {!uploads ? (
        <p className="text-xs text-muted-foreground">Loading…</p>
      ) : uploads.length === 0 ? (
        <p className="text-xs text-muted-foreground">No uploads found.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {uploads.map((f) => (
            <li key={f.id} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">{f.filename}</p>
                <p className="truncate text-[11px] text-muted-foreground">
                  {f.uploader ?? "anonymous"} · {new Date(f.createdAt).toLocaleString()}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <a
                  href={f.viewUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  Preview <ExternalLink className="size-3" />
                </a>
                <button
                  type="button"
                  disabled={deletingId === f.id}
                  onClick={() => remove(f)}
                  className="text-muted-foreground hover:text-destructive disabled:opacity-60"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ==================== Badges tab (admin only) ====================

function BadgesTab() {
  const [badges, setBadges] = useState<BadgeItem[] | null>(null)
  const [name, setName] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const load = useCallback(() => {
    call("/api/admin/badges", undefined, "GET")
      .then((data) => setBadges(data.badges))
      .catch((err) => setError((err as Error).message))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const onFile = async (file: File) => {
    setError(null)
    if (!name.trim()) {
      setError("Give the badge a name first.")
      return
    }
    const allowed = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"]
    if (!allowed.includes(file.type)) {
      setError("Only PNG, JPEG, WebP, or SVG images are allowed.")
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      setError("Badge image must be 2 MB or smaller.")
      return
    }
    setLoading(true)
    try {
      const { uploadUrl, key } = await call("/api/admin/badges/image-url", { contentType: file.type, size: file.size })
      const put = await fetch(uploadUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type } })
      if (!put.ok) throw new Error("Upload failed.")
      await call("/api/admin/badges", { name: name.trim(), key })
      setName("")
      load()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const remove = async (id: string) => {
    setLoading(true)
    setError(null)
    try {
      await call(`/api/admin/badges/${id}`, undefined, "DELETE")
      load()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>}

      <div className="rounded-xl border border-border bg-card p-4">
        <h3 className="mb-3 text-sm font-medium text-foreground">Create a badge</h3>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Badge name (e.g. Beta Tester)"
            maxLength={40}
            className="min-w-0 flex-1 rounded-md border border-border bg-background px-2 py-1.5 text-xs text-foreground outline-none focus:border-primary"
          />
          <div className="relative inline-flex shrink-0">
            <span
              aria-hidden
              className="pointer-events-none flex items-center gap-1.5 rounded-md bg-secondary px-3 py-1.5 text-xs font-medium text-secondary-foreground"
            >
              <Award className="size-3.5" /> {loading ? "Working…" : "Upload image"}
            </span>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              disabled={loading}
              onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
              className="absolute inset-0 size-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
            />
          </div>
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">PNG, JPEG, WebP, or SVG · up to 2 MB · always public</p>
      </div>

      {!badges ? (
        <p className="text-xs text-muted-foreground">Loading…</p>
      ) : badges.length === 0 ? (
        <p className="text-xs text-muted-foreground">No badges created yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {badges.map((b) => (
            <li key={b.id} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-3">
              <div className="flex items-center gap-2">
                <CustomBadge name={b.name} imageUrl={b.imageUrl} />
                <span className="text-sm text-foreground">{b.name}</span>
              </div>
              <button type="button" disabled={loading} onClick={() => remove(b.id)} className="text-muted-foreground hover:text-destructive">
                <Trash2 className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ==================== Moderation Logs tab ====================

type LogEntry = {
  id: string
  actor_username: string
  action: string
  target: string | null
  details: string | null
  created_at: string
}

function LogsTab({ isAdmin }: { isAdmin: boolean }) {
  const [logs, setLogs] = useState<LogEntry[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const load = useCallback(() => {
    call("/api/admin/logs", undefined, "GET")
      .then((data) => setLogs(data.logs))
      .catch((err) => setError((err as Error).message))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const clearOne = async (id: string) => {
    setLoading(true)
    setError(null)
    try {
      await call(`/api/admin/logs?id=${id}`, undefined, "DELETE")
      load()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const clearAll = async () => {
    if (!window.confirm("Clear the entire moderation log? This can't be undone.")) return
    setLoading(true)
    setError(null)
    try {
      await call("/api/admin/logs", undefined, "DELETE")
      load()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>}

      {isAdmin && logs && logs.length > 0 && (
        <button
          type="button"
          disabled={loading}
          onClick={clearAll}
          className="flex w-fit items-center gap-1.5 rounded-md bg-destructive/10 px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/20 disabled:opacity-60"
        >
          <Trash2 className="size-3.5" /> Clear all logs
        </button>
      )}

      {!logs ? (
        <p className="text-xs text-muted-foreground">Loading…</p>
      ) : logs.length === 0 ? (
        <p className="text-xs text-muted-foreground">No moderation actions logged yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {logs.map((entry) => (
            <li key={entry.id} className="flex items-start justify-between gap-3 rounded-lg border border-border bg-card p-3">
              <div className="min-w-0">
                <p className="text-xs text-foreground">
                  <span className="font-medium">{entry.actor_username}</span>{" "}
                  <span className="text-muted-foreground">{entry.action.replace(/_/g, " ")}</span>
                  {entry.target && <span className="font-medium"> {entry.target}</span>}
                </p>
                {entry.details && <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{entry.details}</p>}
                <p className="mt-0.5 text-[11px] text-muted-foreground">{new Date(entry.created_at).toLocaleString()}</p>
              </div>
              {isAdmin && (
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => clearOne(entry.id)}
                  className="shrink-0 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="size-3.5" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
