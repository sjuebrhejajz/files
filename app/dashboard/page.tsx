import { redirect } from "next/navigation"
import { getCurrentUser, isStaff } from "@/lib/auth"
import { DashboardContent } from "@/components/dashboard/dashboard-content"

export default async function DashboardPage() {
  const user = await getCurrentUser()
  if (!user) redirect("/")

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-lg flex-col px-4 py-10 lg:max-w-3xl">
      <DashboardContent user={user} isStaffUser={isStaff(user)} />
    </main>
  )
}
