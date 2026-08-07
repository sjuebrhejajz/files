import Link from "next/link"
import { redirect } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { getCurrentUser } from "@/lib/auth"
import { SettingsForm } from "@/components/dashboard/settings-form"

export default async function SettingsPage() {
  const user = await getCurrentUser()
  if (!user) redirect("/")

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-lg flex-col px-4 py-10 lg:max-w-3xl">
      <Link href="/dashboard" className="mb-8 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary">
        <ArrowLeft className="size-3.5" /> Back to dashboard
      </Link>
      <h1 className="mb-6 text-lg font-semibold text-foreground">Settings</h1>
      <SettingsForm user={user} />
    </main>
  )
}
