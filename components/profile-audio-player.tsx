"use client"

import { useRef, useState } from "react"
import { Pause, Play, Volume2, VolumeX } from "lucide-react"

export function ProfileAudioPlayer({ src, title }: { src: string; title: string | null }) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)
  const [muted, setMuted] = useState(false)
  const [progress, setProgress] = useState(0)

  const toggle = () => {
    const audio = audioRef.current
    if (!audio) return
    if (audio.paused) {
      audio.play().catch(() => {
        // Autoplay-with-sound is blocked by most browsers until the visitor
        // interacts with the page — this button tap is that interaction, so
        // manual play always works even when autoplay silently didn't.
      })
    } else {
      audio.pause()
    }
  }

  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-secondary/40 px-3 py-2.5 shadow-[0_0_20px_-8px_var(--primary)]">
      <button
        type="button"
        onClick={toggle}
        className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-transform hover:scale-105"
      >
        {playing ? <Pause className="size-3.5 fill-current" /> : <Play className="ml-0.5 size-3.5 fill-current" />}
      </button>

      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium text-foreground">{title || "Profile music"}</p>
        <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-border">
          <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <button
        type="button"
        onClick={() => setMuted((m) => !m)}
        className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
      >
        {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
      </button>

      <audio
        ref={audioRef}
        src={src}
        autoPlay
        loop
        muted={muted}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onTimeUpdate={(e) => {
          const audio = e.currentTarget
          setProgress(audio.duration ? (audio.currentTime / audio.duration) * 100 : 0)
        }}
        className="hidden"
      />
    </div>
  )
}
