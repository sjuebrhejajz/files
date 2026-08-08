import { Video } from "lucide-react"

export function ConvertPromoBanner() {
  return (
    <a
      href="https://convert.uncertain.uk"
      target="_blank"
      rel="noreferrer"
      className="mt-10 flex items-center gap-3 rounded-xl border border-border bg-card p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40"
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-secondary text-primary">
        <Video className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground">Need to convert a video?</p>
        <p className="text-xs text-muted-foreground">Try convert.uncertain.uk — download YouTube videos as MP3 or MP4.</p>
      </div>
    </a>
  )
}
