"use client"

import { useState } from "react"

// Always rendered muted — this is a silent, looping background layer only.
// Any audible sound on the profile comes from the separate <ProfileAudioPlayer />
// music widget, never from this element, regardless of what the source file contains.
export function ProfileVideoBackground({ src, debug }: { src: string; debug?: boolean }) {
  const [error, setError] = useState<string | null>(null)

  const ERROR_MESSAGES: Record<number, string> = {
    1: "Loading was aborted",
    2: "Network error while loading",
    3: "Couldn't decode this file (unsupported format or codec)",
    4: "Source not found or not supported — likely a 404 from the server",
  }

  return (
    <div className="fixed inset-0 -z-10 overflow-hidden">
      <video
        src={src}
        autoPlay
        loop
        muted
        playsInline
        // Belt-and-suspenders: some browsers briefly unmute autoplaying video
        // if a user later interacts with the element directly.
        onVolumeChange={(e) => {
          const v = e.currentTarget
          if (!v.muted) v.muted = true
        }}
        onError={(e) => {
          const video = e.currentTarget
          const code = video.error?.code
          setError(code ? (ERROR_MESSAGES[code] ?? `Error code ${code}`) : "Unknown video error")
          console.error("[ProfileVideoBackground] failed to load:", src, video.error)
        }}
        className="size-full object-cover"
      />
      <div className="absolute inset-0 bg-background/40" />
      {debug && error && (
        <div className="absolute left-3 top-3 z-10 max-w-xs rounded-md border border-destructive/40 bg-background/90 px-3 py-2 text-[11px] text-destructive">
          Background video failed to load: {error}
        </div>
      )}
    </div>
  )
}
