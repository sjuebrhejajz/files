import Link from "next/link"
import { redirect } from "next/navigation"
import { Settings, ArrowLeft } from "lucide-react"
import { getCurrentUser } from "@/lib/auth"
import { LinksList } from "@/components/dashboard/links-list"
import { Leaderboard } from "@/components/dashboard/leaderboard"

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
        <Link
          href="/dashboard/settings"
          className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs text-foreground hover:border-primary/40"
        >
          <Settings className="size-3.5" /> Settings
        </Link>
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
    </main>
  )
}
