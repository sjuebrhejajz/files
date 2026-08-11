"use client"

import type React from "react"

import { useCallback, useEffect, useRef, useState } from "react"
import { UploadCloud, Copy, Check, X, FileIcon, Loader2, ExternalLink } from "lucide-react"

const MAX_BYTES = 250 * 1024 * 1024

type UploadItem = {
  id: string
  name: string
  size: number
  status: "uploading" | "done" | "error"
  progress: number
  rawUrl?: string
  viewUrl?: string
  error?: string
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

function origin() {
  if (typeof window !== "undefined") return window.location.origin
  return ""
}

export function Uploader() {
  const [items, setItems] = useState<UploadItem[]>([])
  const [dragging, setDragging] = useState(false)
  const [isStaffUser, setIsStaffUser] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Staff (moderator/admin/owner) have no upload size limit — the server
  // enforces this authoritatively (see app/api/upload/route.ts), this is
  // just so staff don't see a client-side "exceeds limit" error before the
  // request ever reaches the server.
  useEffect(() => {
    fetch("/api/user/me")
      .then((r) => r.json())
      .then((data) => {
        const role = data?.user?.role
        setIsStaffUser(role === "moderator" || role === "admin" || role === "owner")
      })
      .catch(() => setIsStaffUser(false))
  }, [])

  const startUpload = useCallback(
    async (file: File) => {
      const id = crypto.randomUUID()

      if (!isStaffUser && file.size > MAX_BYTES) {
        setItems((prev) => [
          { id, name: file.name, size: file.size, status: "error", progress: 0, error: "Exceeds 250 MB limit" },
          ...prev,
        ])
      return
    }

    setItems((prev) => [{ id, name: file.name, size: file.size, status: "uploading", progress: 0 }, ...prev])

    try {
      // Ask our API for a short-lived presigned PUT URL. The actual file
      // bytes go straight from the browser to R2, never through Vercel —
      // needed since files up to 250MB exceed Vercel's function body limits.
      const presignRes = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: file.name, contentType: file.type, size: file.size }),
      })

      if (!presignRes.ok) {
        const { error } = await presignRes.json().catch(() => ({ error: "Upload failed" }))
        throw new Error(error || "Upload failed")
      }

      const { url, shortId } = (await presignRes.json()) as { url: string; shortId: string }

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhr.open("PUT", url)
        xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream")
        xhr.upload.onprogress = (e) => {
          if (!e.lengthComputable) return
          const percentage = (e.loaded / e.total) * 100
          setItems((prev) => prev.map((it) => (it.id === id ? { ...it, progress: percentage } : it)))
        }
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve()
          else reject(new Error(`Upload failed (${xhr.status})`))
        }
        xhr.onerror = () => reject(new Error("Upload failed"))
        xhr.send(file)
      })

      const rawUrl = `${origin()}/f/${shortId}`
      const viewUrl = `${origin()}/v/${shortId}`
      setItems((prev) =>
        prev.map((it) => (it.id === id ? { ...it, status: "done", progress: 100, rawUrl, viewUrl } : it)),
      )
    } catch (err) {
      console.log("[v0] upload failed:", err)
      setItems((prev) =>
        prev.map((it) =>
          it.id === id ? { ...it, status: "error", error: (err as Error).message || "Upload failed" } : it,
        ),
      )
    }
  }, [isStaffUser])

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files) return
      Array.from(files).forEach(startUpload)
    },
    [startUpload],
  )

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragging(false)
      handleFiles(e.dataTransfer.files)
    },
    [handleFiles],
  )

  return (
    <div className="flex w-full flex-col gap-6">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`group flex w-full flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-14 text-center transition-colors ${
          dragging
            ? "border-primary bg-primary/5"
            : "border-border bg-card hover:border-primary/60 hover:bg-accent/40"
        }`}
      >
        <div className="flex size-14 items-center justify-center rounded-full bg-secondary text-primary transition-transform group-hover:scale-105">
          <UploadCloud className="size-7" />
        </div>
        <div className="space-y-1">
          <p className="text-base font-medium text-foreground">Drop files here or click to upload</p>
          <p className="text-sm text-muted-foreground">Up to 250 MB per file &middot; auto-deleted after 7 days</p>
        </div>
        <input
          ref={inputRef}
          type="file"
          multiple
          className="sr-only"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </button>

      {items.length > 0 && (
        <ul className="flex flex-col gap-3">
          {items.map((item) => (
            <UploadRow key={item.id} item={item} onRemove={() => setItems((p) => p.filter((i) => i.id !== item.id))} />
          ))}
        </ul>
      )}
    </div>
  )
}

function UploadRow({ item, onRemove }: { item: UploadItem; onRemove: () => void }) {
  const [copied, setCopied] = useState(false)

  const copy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // ignore
    }
  }

  return (
    <li className="animate-in fade-in slide-in-from-top-2 duration-300 rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-secondary text-muted-foreground">
          {item.status === "uploading" ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <FileIcon className="size-4" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground" title={item.name}>
            {item.name}
          </p>
          <p className="text-xs text-muted-foreground">
            {formatSize(item.size)}
            {item.status === "uploading" && ` · ${Math.round(item.progress)}%`}
            {item.status === "error" && ` · ${item.error}`}
          </p>
        </div>
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remove"
          className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <X className="size-4" />
        </button>
      </div>

      {item.status === "uploading" && (
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full rounded-full bg-primary transition-all duration-200"
            style={{ width: `${item.progress}%` }}
          />
        </div>
      )}

      {item.status === "done" && item.rawUrl && (
        <div className="animate-in fade-in slide-in-from-top-1 duration-300 mt-3 flex items-center gap-2">
          <input
            readOnly
            value={item.rawUrl}
            onFocus={(e) => e.currentTarget.select()}
            className="min-w-0 flex-1 rounded-md border border-border bg-background px-3 py-1.5 font-mono text-xs text-foreground outline-none focus:border-primary"
          />
          <button
            type="button"
            onClick={() => copy(item.rawUrl!)}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
            {copied ? "Copied" : "Copy"}
          </button>
          <a
            href={item.viewUrl}
            target="_blank"
            rel="noreferrer"
            aria-label="Open file"
            className="inline-flex shrink-0 items-center justify-center rounded-md bg-secondary px-2.5 py-1.5 text-secondary-foreground transition-colors hover:bg-accent"
          >
            <ExternalLink className="size-3.5" />
          </a>
        </div>
      )}
    </li>
  )
}
