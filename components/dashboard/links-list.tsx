"use client"

import { useEffect, useState } from "react"
import { Trash2, Loader2, Copy, Check } from "lucide-react"
import { LinkPreview } from "@/components/link-preview"

type UploadedLink = {
  id: string
  filename: string
  url: string
  viewUrl: string
  contentType: string | null
  created_at: string
  expires_at: string
}

function origin() {
  if (typeof window !== "undefined") return window.location.origin
  return ""
}

export function LinksList() {
  const [links, setLinks] = useState<UploadedLink[] | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
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
      {links.map((link) => (
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
      ))}
    </ul>
  )
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  })
}
