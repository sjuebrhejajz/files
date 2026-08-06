"use client"

import { useEffect, useState } from "react"
import { Trash2, Loader2, Link2 } from "lucide-react"

type UploadedLink = {
  id: string
  filename: string
  url: string
  created_at: string
  expires_at: string
}

export function LinksList() {
  const [links, setLinks] = useState<UploadedLink[] | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
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

  if (error) return <p className="text-xs text-destructive">{error}</p>
  if (!links) return <p className="text-xs text-muted-foreground">Loading…</p>
  if (links.length === 0) return <p className="text-xs text-muted-foreground">You haven't uploaded anything yet.</p>

  return (
    <ul className="flex flex-col gap-2">
      {links.map((link) => (
        <li
          key={link.id}
          className="flex items-center gap-3 rounded-lg border border-border bg-card p-3 text-sm"
        >
          <Link2 className="size-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <a href={link.url} target="_blank" rel="noreferrer" className="block truncate font-medium text-foreground hover:text-primary">
              {link.filename}
            </a>
            <p className="text-xs text-muted-foreground">
              Uploaded {formatDateTime(link.created_at)} · Expires {formatDateTime(link.expires_at)}
            </p>
          </div>
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
