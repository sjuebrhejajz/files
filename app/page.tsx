import { Uploader } from "@/components/uploader"
import { PresenceBadge } from "@/components/presence-badge"
import { DonateBox } from "@/components/donate-box"
import { Clock, ShieldCheck, Zap, Lock } from "lucide-react"

export default function Page() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col px-4 py-10">
      <header className="animate-in fade-in slide-in-from-top-2 duration-500 mb-10 flex flex-col items-center gap-3 text-center">
        <div className="flex items-center gap-2">
          <span className="relative inline-flex size-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
            <span className="relative inline-flex size-2.5 rounded-full bg-primary" />
          </span>
          <h1 className="font-mono text-lg font-semibold tracking-tight text-foreground">files.uncertain.uk</h1>
        </div>
        <p className="max-w-md text-balance text-sm leading-relaxed text-muted-foreground">
          Private file hosting with instant, shareable links that embed inline in Discord. Files vanish after 7 days.
        </p>
        <PresenceBadge />
      </header>

      <Uploader />

      <DonateBox />

      <ul className="mt-10 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Feature
          icon={<Zap className="size-4" />}
          title="Up to 250 MB"
          desc="Large videos and files supported."
          delay={0}
        />
        <Feature
          icon={<Clock className="size-4" />}
          title="7-day expiry"
          desc="Files are removed exactly 7 days after upload."
          delay={75}
        />
        <Feature
          icon={<ShieldCheck className="size-4" />}
          title="Unlisted"
          desc="Only people with the link can view."
          delay={150}
        />
        <Feature
          icon={<Lock className="size-4" />}
          title="Encrypted"
          desc="TLS in transit, AES-256 at rest on R2."
          delay={225}
        />
      </ul>

      <footer className="mt-auto pt-12 text-center text-xs text-muted-foreground">
        <p>Links unfurl into playable embeds on Discord.</p>
      </footer>
    </main>
  )
}

function Feature({
  icon,
  title,
  desc,
  delay = 0,
}: {
  icon: React.ReactNode
  title: string
  desc: string
  delay?: number
}) {
  return (
    <li
      style={{ animationDelay: `${delay}ms`, animationFillMode: "backwards" }}
      className="animate-in fade-in slide-in-from-bottom-2 duration-500 flex flex-col gap-1.5 rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary/40"
    >
      <span className="flex size-8 items-center justify-center rounded-md bg-secondary text-primary transition-transform duration-200 hover:scale-110">
        {icon}
      </span>
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="text-xs leading-relaxed text-muted-foreground">{desc}</p>
    </li>
  )
}
