import { UsersDirectory } from "@/components/public/users-directory"

export const metadata = { title: "Users — files.uncertain.uk" }

export default function UsersPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col px-4 py-10">
      <h1 className="mb-1 text-lg font-semibold text-foreground">Users</h1>
      <p className="mb-6 text-xs text-muted-foreground">Browse public profiles.</p>
      <UsersDirectory />
    </main>
  )
}
