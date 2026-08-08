import Link from "next/link"
import { redirect } from "next/navigation"
import { Settings, ArrowLeft, ShieldAlert } from "lucide-react"
import { getCurrentUser, isStaff } from "@/lib/auth"
import { LinksList } from "@/components/dashboard/links-list"
import { Leaderboard } from "@/components/dashboard/leaderboard"
import { ConvertPromoBanner } from "@/components/convert-promo-banner"

export default async function DashboardPage() {
  const user = await getCurrentUser()
  if (!user) redirect("/")

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col px-4 py-10">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground">Welcome back</p>
          <h1 className="text-lg font-semibold text-foreground">Hello, {user.username}</h1>
        </div>
        <div className="flex items-center gap-2">
          {isStaff(user) && (
            <Link
              href="/dashboard/backend"
              className="flex items-center gap-1.5 rounded-md border border-destructive/40 px-3 py-1.5 text-xs text-destructive hover:border-destructive"
            >
              <ShieldAlert className="size-3.5" /> The Backend
            </Link>
          )}
          <Link
            href="/dashboard/settings"
            className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs text-foreground hover:border-primary/40"
          >
            <Settings className="size-3.5" /> Settings
          </Link>
        </div>
      </header>

      <Link href="/" className="mb-8 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary">
        <ArrowLeft className="size-3.5" /> Back to main site
      </Link>

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-medium text-foreground">Your uploaded links</h2>
        <LinksList />
      </section>

      <section>
        <h2 className="mb-3 text-sm font-medium text-foreground">Top donors</h2>
        <Leaderboard />
      </section>

      <ConvertPromoBanner />
    </main>
  )
}
