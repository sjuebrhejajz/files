import { Uploader } from "@/components/uploader"
import { PresenceBadge } from "@/components/presence-badge"
import { DonateBox } from "@/components/donate-box"
import { UserMenu } from "@/components/auth/user-menu"
import { Clock, ShieldCheck, Zap, Lock, Users as UsersIcon, HardDrive, Coins } from "lucide-react"
import { sql } from "@/lib/db"
import { neonFont } from "@/lib/fonts"

async function getSiteStats() {
  const [userRows, fileRows, donationRows] = await Promise.all([
    sql`select count(*)::int as count from users`,
    sql`select count(*)::int as count from uploads where expires_at > now()`,
    sql`select coalesce(sum(amount_cents), 0)::int as total from donations`,
  ])
  return {
    users: (userRows[0]?.count as number) ?? 0,
    activeFiles: (fileRows[0]?.count as number) ?? 0,
    totalCents: (donationRows[0]?.total as number) ?? 0,
  }
}

// Reads live counts straight from the database with no cookies()/headers()
// call anywhere on this page, so Next.js had no signal to treat it as
// per-request — it was caching the rendered stats indefinitely instead of
// refreshing them.
export const dynamic = "force-dynamic"

export default async function Page() {
  const stats = await getSiteStats()

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col px-4 py-10 lg:max-w-5xl">
      <UserMenu />

      {/* Single column on mobile; on desktop this widens into a main column
          plus a sidebar so the page doesn't end up mostly empty space next
          to a narrow, centered card. */}
      <div className="lg:grid lg:grid-cols-[1fr_280px] lg:items-start lg:gap-8">
        <div className="flex flex-col">
          <header className="animate-in fade-in slide-in-from-top-2 duration-500 mb-10 flex flex-col items-center gap-3 text-center">
            <div className="flex items-center gap-2">
              <span className="relative inline-flex size-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
                <span className="relative inline-flex size-2.5 rounded-full bg-primary" />
              </span>
              <h1 className={`${neonFont.className} text-lg tracking-wide text-foreground [text-shadow:0_0_16px_var(--primary)]`}>
                files.uncertain.uk
              </h1>
            </div>
            <p className="max-w-md text-balance text-sm leading-relaxed text-muted-foreground">
              Private file hosting with instant, shareable links that embed inline in Discord. Files vanish after 7
              days.
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

          <footer className="mt-auto pt-12 text-center text-xs text-muted-foreground lg:hidden">
            <p>Links unfurl into playable embeds on Discord.</p>
          </footer>
        </div>

        <aside className="hidden flex-col gap-4 lg:flex">
          <div className="rounded-xl border border-border bg-card p-4">
            <h2 className="mb-3 text-xs font-medium text-foreground">Site stats</h2>
            <dl className="flex flex-col gap-2.5 text-xs text-muted-foreground">
              <div className="flex items-center justify-between gap-3">
                <dt className="flex items-center gap-1.5">
                  <UsersIcon className="size-3.5" /> Members
                </dt>
                <dd className="text-foreground">{stats.users.toLocaleString()}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="flex items-center gap-1.5">
                  <HardDrive className="size-3.5" /> Files hosted now
                </dt>
                <dd className="text-foreground">{stats.activeFiles.toLocaleString()}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="flex items-center gap-1.5">
                  <Coins className="size-3.5" /> Raised so far
                </dt>
                <dd className="text-foreground">£{(stats.totalCents / 100).toFixed(2)}</dd>
              </div>
            </dl>
          </div>

          <a
            href="/users"
            className="rounded-xl border border-border bg-card p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40"
          >
            <h2 className="mb-1 text-xs font-medium text-foreground">Community</h2>
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              Browse public profiles — see who&apos;s active, who&apos;s staff, and who&apos;s supporting the site.
            </p>
          </a>

          <div className="rounded-xl border border-border bg-card p-4 text-[11px] leading-relaxed text-muted-foreground">
            <p>Links unfurl into playable embeds on Discord.</p>
          </div>
        </aside>
      </div>
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
      className="animate-in fade-in slide-in-from-bottom-2 duration-500 flex flex-col gap-1.5 rounded-lg border border-border bg-card p-4 transition-all hover:-translate-y-0.5 hover:border-primary/40"
    >
      <span className="flex size-8 items-center justify-center rounded-md bg-secondary text-primary transition-transform duration-200 hover:scale-110">
        {icon}
      </span>
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="text-xs leading-relaxed text-muted-foreground">{desc}</p>
    </li>
  )
}
