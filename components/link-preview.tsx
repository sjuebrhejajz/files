"use client"

import { FileIcon, Play } from "lucide-react"

export function LinkPreview({ url, contentType }: { url: string; contentType: string | null }) {
  const isImage = contentType?.startsWith("image/") ?? false
  const isVideo = contentType?.startsWith("video/") ?? false

  if (isImage) {
    return (
      <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-md bg-secondary">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url || "/placeholder.svg"} alt="" className="size-full object-cover" />
      </div>
    )
  }

  if (isVideo) {
    return (
      <div className="relative flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-md bg-secondary">
        {/* preload="metadata" only grabs a frame for the thumbnail — it never
            autoplays here, so a page with many video links doesn't turn into
            several videos playing at once. */}
        <video src={url} muted playsInline preload="metadata" className="size-full object-cover" />
        <span className="absolute inset-0 flex items-center justify-center bg-black/30">
          <Play className="size-3.5 fill-white text-white" />
        </span>
      </div>
    )
  }

  return (
    <div className="flex size-12 shrink-0 items-center justify-center rounded-md bg-secondary">
      <FileIcon className="size-4 text-muted-foreground" />
    </div>
  )
}
