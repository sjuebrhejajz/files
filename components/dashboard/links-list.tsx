"use client"

import { useEffect, useState } from "react"
import { Trash2, Loader2, Copy, Check, CalendarPlus } from "lucide-react"
import { LinkPreview } from "@/components/link-preview"

type UploadedLink = {
  id: string
  filename: string
  url: string
  viewUrl: string
  contentType: string | null
  created_at: string
  expires_at: string
  last_extended_at: string | null
}

const DAY_MS = 24 * 60 * 60 * 1000
const MIN_AGE_DAYS = 3
const COOLDOWN_DAYS = 3
const MAX_LIFESPAN_DAYS = 10000

function origin() {
  if (typeof window !== "undefined") return window.location.origin
  return ""
}

// Mirrors the server-side eligibility check in
// app/api/user/links/[id]/extend/route.ts — this is only for showing the
// right button/label, the server re-checks everything independently before
// actually extending anything.
function extendEligibility(link: UploadedLink): { eligible: boolean; reason: string } {
  const now = Date.now()
  const createdAt = new Date(link.created_at).getTime()
  const expiresAt = new Date(link.expires_at).getTime()
  const lastExtendedAt = link.last_extended_at ? new Date(link.last_extended_at).getTime() : null

  const hardCap = createdAt + MAX_LIFESPAN_DAYS * DAY_MS
  if (expiresAt >= hardCap) {
    return { eligible: false, reason: "Maximum lifespan reached" }
  }

  if (now - createdAt < MIN_AGE_DAYS * DAY_MS) {
    const eligibleOn = new Date(createdAt + MIN_AGE_DAYS * DAY_MS)
    return { eligible: false, reason: `Extendable from ${eligibleOn.toLocaleDateString()}` }
  }

  if (lastExtendedAt && now - lastExtendedAt < COOLDOWN_DAYS * DAY_MS) {
    const eligibleOn = new Date(lastExtendedAt + COOLDOWN_DAYS * DAY_MS)
    return { eligible: false, reason: `Extend again from ${eligibleOn.toLocaleDateString()}` }
  }

  return { eligible: true, reason: "Extend by 7 days" }
}

export function LinksList() {
  const [links, setLinks] = useState<UploadedLink[] | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [extendingId, setExtendingId] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch("/api/user/links")
      .then((r) => r.json())
      .then((data) => setLinks(data.links ?? []))
      .catch(() => setError("Could not load your links."))
  }, [])

  const remove = async (id: string) => {
    setDeletingId(id)
    try {
      const res = await fetch(`/api/user/links/${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error()
      setLinks((prev) => prev?.filter((l) => l.id !== id) ?? null)
    } catch {
      setError("Could not delete that link.")
    } finally {
      setDeletingId(null)
    }
  }

  const extend = async (link: UploadedLink) => {
    setExtendingId(link.id)
    setError(null)
    try {
      const res = await fetch(`/api/user/links/${link.id}/extend`, { method: "POST" })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Could not extend that link.")
      setLinks(
        (prev) =>
          prev?.map((l) =>
            l.id === link.id ? { ...l, expires_at: data.expires_at, last_extended_at: data.last_extended_at } : l,
          ) ?? null,
      )
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setExtendingId(null)
    }
  }

  // Copies the same full share URL the uploader hands you right after a
  // fresh upload — so re-copying from this list is indistinguishable from
  // copying it the first time.
  const copy = async (link: UploadedLink) => {
    const fullUrl = `${origin()}${link.url}`
    try {
      await navigator.clipboard.writeText(fullUrl)
      setCopiedId(link.id)
      setTimeout(() => setCopiedId((id) => (id === link.id ? null : id)), 1500)
    } catch {
      setError("Could not copy that link.")
    }
  }

  if (error) return <p className="text-xs text-destructive">{error}</p>
  if (!links) return <p className="text-xs text-muted-foreground">Loading…</p>
  if (links.length === 0) return <p className="text-xs text-muted-foreground">You haven't uploaded anything yet.</p>

  return (
    <ul className="flex flex-col gap-2">
      {links.map((link) => {
        const { eligible, reason } = extendEligibility(link)
        return (
          <li key={link.id} className="flex items-center gap-3 rounded-lg border border-border bg-card p-2.5 text-sm">
            <a href={link.viewUrl} className="shrink-0">
              <LinkPreview url={link.url} contentType={link.contentType} />
            </a>
            <a href={link.viewUrl} className="min-w-0 flex-1">
              <p className="truncate font-medium text-foreground hover:text-primary">{link.filename}</p>
              <p className="text-xs text-muted-foreground">
                Uploaded {formatDateTime(link.created_at)} · Expires {formatDateTime(link.expires_at)}
              </p>
            </a>
            <button
              type="button"
              onClick={() => extend(link)}
              disabled={!eligible || extendingId === link.id}
              title={reason}
              className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground disabled:opacity-30"
              aria-label={reason}
            >
              {extendingId === link.id ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <CalendarPlus className="size-4" />
              )}
            </button>
            <button
              type="button"
              onClick={() => copy(link)}
              className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground"
              aria-label="Copy link"
              title="Copy link"
            >
              {copiedId === link.id ? <Check className="size-4 text-primary" /> : <Copy className="size-4" />}
            </button>
            <button
              type="button"
              onClick={() => remove(link.id)}
              disabled={deletingId === link.id}
              className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-60"
              aria-label="Remove link"
            >
              {deletingId === link.id ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
            </button>
          </li>
        )
      })}
    </ul>
  )
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  })
}
