import { Uploader } from "@/components/uploader"
import { Clock, ShieldCheck, Zap } from "lucide-react"

export default function Page() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col px-4 py-10">
      <header className="mb-10 flex flex-col items-center gap-3 text-center">
        <div className="flex items-center gap-2">
          <span className="inline-flex size-2.5 rounded-full bg-primary" aria-hidden="true" />
          <h1 className="font-mono text-lg font-semibold tracking-tight text-foreground">files.uncertain.uk</h1>
        </div>
        <p className="max-w-md text-balance text-sm leading-relaxed text-muted-foreground">
          Private file hosting with instant, shareable links that embed inline in Discord. Files vanish after 24 hours.
        </p>
      </header>

      <Uploader />

      <ul className="mt-10 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Feature icon={<Zap className="size-4" />} title="Up to 250 MB" desc="Large videos and files supported." />
        <Feature icon={<Clock className="size-4" />} title="24h expiry" desc="Everything auto-deletes daily." />
        <Feature icon={<ShieldCheck className="size-4" />} title="Unlisted" desc="Only people with the link can view." />
      </ul>

      <footer className="mt-auto pt-12 text-center text-xs text-muted-foreground">
        <p>Links unfurl into playable embeds on Discord.</p>
      </footer>
    </main>
  )
}

function Feature({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <li className="flex flex-col gap-1.5 rounded-lg border border-border bg-card p-4">
      <span className="flex size-8 items-center justify-center rounded-md bg-secondary text-primary">{icon}</span>
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="text-xs leading-relaxed text-muted-foreground">{desc}</p>
    </li>
  )
}
