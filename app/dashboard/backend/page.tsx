import { redirect } from "next/navigation"
import { getCurrentUser, isStaff } from "@/lib/auth"
import { BackendPanel } from "@/components/admin/backend-panel"

export default async function BackendPage() {
  const user = await getCurrentUser()
  if (!user) redirect("/")
  if (!isStaff(user)) redirect("/dashboard")

  return <BackendPanel currentUser={user} />
}
