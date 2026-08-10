"use client"

import { useState } from "react"
import Link from "next/link"
import { ArrowLeft, Link2, Search, Settings, ShieldAlert, Trophy } from "lucide-react"
import type { ComponentType } from "react"
import type { PublicUser } from "@/lib/auth"
import { LinksList } from "@/components/dashboard/links-list"
import { Leaderboard } from "@/components/dashboard/leaderboard"
import { ConvertPromoBanner } from "@/components/convert-promo-banner"

type Category = "links" | "community"

const CATEGORIES: {
  id: Category
  label: string
  description: string
  icon: ComponentType<{ className?: string }>
  keywords: string[]
}[] = [
  {
    id: "links",
    label: "My Links",
    description: "Files you've uploaded and shared",
    icon: Link2,
    keywords: ["uploads", "files", "expire", "expiry", "extend"],
  },
  {
    id: "community",
    label: "Community",
    description: "Top donors leaderboard",
    icon: Trophy,
    keywords: ["donate", "donors", "leaderboard"],
  },
]

export function DashboardContent({ user, isStaffUser }: { user: PublicUser; isStaffUser: boolean }) {
  const [category, setCategory] = useState<Category | null>(null)

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-8">
      {/* Persistent on desktop; the welcome view below covers navigation on mobile. */}
      <nav className="hidden shrink-0 flex-col gap-1 lg:flex lg:w-56">
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setCategory(c.id)}
            className={`flex items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors ${
              category === c.id
                ? "bg-secondary text-foreground"
                : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
            }`}
          >
            <c.icon className="size-4" />
            {c.label}
          </button>
        ))}
        <div className="my-2 border-t border-border" />
        <Link
          href="/dashboard/settings"
          className="flex items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-secondary/50 hover:text-foreground"
        >
          <Settings className="size-4" /> Settings
        </Link>
        {isStaffUser && (
          <Link
            href="/dashboard/backend"
            className="flex items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-destructive transition-colors hover:bg-destructive/10"
          >
            <ShieldAlert className="size-4" /> The Backend
          </Link>
        )}
      </nav>

      <div className="min-w-0 flex-1">
        {category === null ? (
          <WelcomeView user={user} isStaffUser={isStaffUser} onSelect={setCategory} />
        ) : (
          <>
            <button
              type="button"
              onClick={() => setCategory(null)}
              className="mb-4 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary"
            >
              <ArrowLeft className="size-3.5" /> Dashboard
            </button>
            {category === "links" && (
              <section>
                <h2 className="mb-3 text-sm font-medium text-foreground">Your uploaded links</h2>
                <LinksList />
              </section>
            )}
            {category === "community" && (
              <section>
                <h2 className="mb-3 text-sm font-medium text-foreground">Top donors</h2>
                <Leaderboard />
              </section>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function WelcomeView({
  user,
  isStaffUser,
  onSelect,
}: {
  user: PublicUser
  isStaffUser: boolean
  onSelect: (c: Category) => void
}) {
  const [query, setQuery] = useState("")
  const q = query.trim().toLowerCase()
  const filtered = CATEGORIES.filter(
    (c) => q === "" || [c.label, c.description, ...c.keywords].some((s) => s.toLowerCase().includes(q)),
  )

  return (
    <div>
      <h2 className="mb-1 text-base font-semibold text-foreground">Hello, {user.username}</h2>
      <p className="mb-4 text-xs text-muted-foreground">Pick a category, or jump straight to Settings.</p>

      <div className="mb-4 flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2">
        <Search className="size-3.5 shrink-0 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search dashboard…"
          className="w-full bg-transparent text-sm text-foreground outline-none"
        />
      </div>

      {filtered.length === 0 ? (
        <p className="mb-6 text-xs text-muted-foreground">Nothing matches "{query}".</p>
      ) : (
        <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {filtered.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => onSelect(c.id)}
              className="flex flex-col items-start gap-2 rounded-xl border border-border bg-card p-4 text-left transition-colors hover:border-primary/40"
            >
              <span className="flex size-8 items-center justify-center rounded-md bg-secondary text-foreground">
                <c.icon className="size-4" />
              </span>
              <span className="text-sm font-medium text-foreground">{c.label}</span>
              <span className="text-[11px] text-muted-foreground">{c.description}</span>
            </button>
          ))}
        </div>
      )}

      <div className="mb-6 flex flex-wrap gap-2">
        <Link
          href="/dashboard/settings"
          className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs text-foreground hover:border-primary/40"
        >
          <Settings className="size-3.5" /> Settings
        </Link>
        {isStaffUser && (
          <Link
            href="/dashboard/backend"
            className="flex items-center gap-1.5 rounded-md border border-destructive/40 px-3 py-1.5 text-xs text-destructive hover:border-destructive"
          >
            <ShieldAlert className="size-3.5" /> The Backend
          </Link>
        )}
      </div>

      <ConvertPromoBanner />
    </div>
  )
}
