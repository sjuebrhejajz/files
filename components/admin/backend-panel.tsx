"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Creepster } from "next/font/google"
import {
  ArrowLeft,
  Ban,
  Crown,
  ExternalLink,
  Loader2,
  Search,
  ShieldCheck,
  ShieldX,
  Trash2,
  UserMinus,
} from "lucide-react"
import type { PublicUser } from "@/lib/auth"
import { RoleBadge } from "@/components/role-badge"

const spooky = Creepster({ subsets: ["latin"], weight: "400" })

type Tab = "users" | "blacklist" | "moderation"

type UserRow = {
  id: string
  username: string
  email: string
  role: "user" | "moderator" | "admin"
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

type UserDetailData = {
  user: UserRow & {
    bio: string | null
    links_public: boolean
    profile_picture_url: string | null
    banner_url: string | null
  }
  uploads: { id: string; filename: string; url: string; viewUrl: string; createdAt: string }[]
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
        {(["users", "blacklist", "moderation"] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`px-3 py-2 text-xs font-medium capitalize transition-colors ${
              tab === t ? "border-b-2 border-primary text-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t === "moderation" ? "Moderation Queue" : t}
          </button>
        ))}
      </div>

      {tab === "users" && <UsersTab isAdmin={isAdmin} currentUser={currentUser} />}
      {tab === "blacklist" && <BlacklistTab />}
      {tab === "moderation" && <ModerationTab />}
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
  const [blacklistValue, setBlacklistValue] = useState("")
  const [blacklistType, setBlacklistType] = useState<"ip" | "username" | "email">("username")
  const [blacklistReason, setBlacklistReason] = useState("")

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
  const targetIsStaff = target.role === "moderator" || target.role === "admin" || target.username.toLowerCase() === "admin"
  const isSelf = target.id === currentUser.id

  const doRole = async (action: "promote" | "demote") => {
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

  const addBlacklist = async () => {
    const value = blacklistType === "username" ? target.username : blacklistType === "email" ? target.email : blacklistValue
    if (!value.trim()) return
    setActionLoading(true)
    setError(null)
    try {
      await call("/api/admin/blacklist", { type: blacklistType, value, reason: blacklistReason })
      setBlacklistValue("")
      setBlacklistReason("")
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

        {isAdmin && !targetIsStaff && !isSelf && (
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
            className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-secondary px-3 py-1.5 text-xs font-medium text-secondary-foreground hover:bg-accent disabled:opacity-60"
          >
            <UserMinus className="size-3.5" /> Demote to user
          </button>
        )}
      </div>

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
        <h3 className="mb-3 text-sm font-medium text-foreground">Blacklist</h3>

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
          <p className="text-xs text-muted-foreground">Staff and the admin account can&apos;t be blacklisted.</p>
        ) : (
          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              <select
                value={blacklistType}
                onChange={(e) => setBlacklistType(e.target.value as "ip" | "username" | "email")}
                className="rounded-md border border-border bg-background px-2 py-1.5 text-xs text-foreground outline-none"
              >
                <option value="username">Username</option>
                <option value="email">Email</option>
                <option value="ip">IP</option>
              </select>
              <input
                value={blacklistType === "username" ? target.username : blacklistType === "email" ? target.email : blacklistValue}
                onChange={(e) => setBlacklistValue(e.target.value)}
                disabled={blacklistType !== "ip"}
                placeholder={blacklistType === "ip" ? "IP address" : "Value"}
                className="min-w-0 flex-1 rounded-md border border-border bg-background px-2 py-1.5 text-xs text-foreground outline-none focus:border-primary disabled:opacity-70"
              />
            </div>
            <input
              value={blacklistReason}
              onChange={(e) => setBlacklistReason(e.target.value)}
              placeholder="Reason (optional)"
              className="rounded-md border border-border bg-background px-2 py-1.5 text-xs text-foreground outline-none focus:border-primary"
            />
            <button
              type="button"
              disabled={actionLoading}
              onClick={addBlacklist}
              className="flex w-fit items-center gap-1.5 rounded-md bg-destructive/10 px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/20 disabled:opacity-60"
            >
              <Ban className="size-3.5" /> Add to blacklist
            </button>
          </div>
        )}
      </div>
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
      await call("/api/admin/blacklist", { type, value, reason })
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
