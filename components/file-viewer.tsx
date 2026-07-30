"use client"

import Link from "next/link"
import { Download, ArrowLeft } from "lucide-react"
import type { ResolvedFile } from "@/lib/files"

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

export function FileViewer({ file, rawUrl }: { file: ResolvedFile; rawUrl: string }) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-6 px-4 py-8">
      <div className="flex items-center justify-between">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          files.uncertain.uk
        </Link>
        <a
          href={rawUrl}
          download={file.displayName}
          className="inline-flex items-center gap-2 rounded-md bg-secondary px-3 py-1.5 text-sm font-medium text-secondary-foreground transition-colors hover:bg-accent"
        >
          <Download className="size-4" />
          Download
        </a>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="flex items-center justify-center bg-black/40 p-2">
          {file.kind === "video" && (
            <video
              controls
              playsInline
              preload="metadata"
              className="max-h-[70vh] w-full rounded-md"
              src={rawUrl}
            >
              <track kind="captions" />
            </video>
          )}
          {file.kind === "image" && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={rawUrl || "/placeholder.svg"} alt={file.displayName} className="max-h-[70vh] w-auto rounded-md" />
          )}
          {file.kind === "audio" && (
            <div className="w-full p-8">
              <audio controls className="w-full" src={rawUrl} />
            </div>
          )}
          {file.kind === "other" && (
            <div className="p-12 text-center text-muted-foreground">
              <p className="text-sm">No inline preview available for this file type.</p>
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-3">
          <p className="truncate font-mono text-sm text-foreground" title={file.displayName}>
            {file.displayName}
          </p>
          <span className="shrink-0 text-xs text-muted-foreground">{formatSize(file.size)}</span>
        </div>
      </div>

      <p className="text-center text-xs text-muted-foreground">This file is automatically deleted 12 hours after upload.</p>
    </main>
  )
}
