"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { User, ChevronDown, LayoutDashboard, Settings, LogOut } from "lucide-react"
import { AuthModal } from "./auth-modal"
import type { PublicUser } from "@/lib/auth"

export function UserMenu() {
  const [user, setUser] = useState<PublicUser | null | "loading">("loading")
  const [modalOpen, setModalOpen] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const refreshUser = async () => {
    const res = await fetch("/api/user/me")
    const data = await res.json()
    setUser(data.user)
  }

  useEffect(() => {
    refreshUser()
  }, [])

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener("mousedown", onClickOutside)
    return () => document.removeEventListener("mousedown", onClickOutside)
  }, [])

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" })
    setUser(null)
    setDropdownOpen(false)
  }

  return (
    <div className="fixed right-3 top-3 z-40 sm:right-5 sm:top-5">
      {user === "loading" ? (
        <div className="h-9 w-9 animate-pulse rounded-full bg-secondary sm:w-24" />
      ) : user ? (
        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setDropdownOpen((v) => !v)}
            className="flex items-center gap-2 rounded-full border border-border bg-card py-1 pl-1 pr-2 text-sm text-foreground transition-colors hover:border-primary/40 sm:pr-3"
          >
            <Avatar user={user} />
            <span className="hidden max-w-[10rem] truncate font-medium sm:inline">{user.username}</span>
            <ChevronDown className="hidden size-3.5 text-muted-foreground sm:inline" />
          </button>

          {dropdownOpen && (
            <div className="absolute right-0 mt-2 w-56 overflow-hidden rounded-lg border border-border bg-card shadow-lg">
              <div className="border-b border-border px-3 py-2.5">
                <p className="text-xs text-muted-foreground">Signed in as</p>
                <p className="truncate text-sm font-medium text-foreground">{user.username}</p>
              </div>
              <nav className="flex flex-col p-1">
                <Link
                  href="/dashboard"
                  onClick={() => setDropdownOpen(false)}
                  className="flex items-center gap-2 rounded-md px-2.5 py-2 text-sm text-foreground hover:bg-secondary"
                >
                  <LayoutDashboard className="size-4" /> Dashboard
                </Link>
                <Link
                  href="/dashboard/settings"
                  onClick={() => setDropdownOpen(false)}
                  className="flex items-center gap-2 rounded-md px-2.5 py-2 text-sm text-foreground hover:bg-secondary"
                >
                  <Settings className="size-4" /> Settings
                </Link>
                <button
                  type="button"
                  onClick={logout}
                  className="flex items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm text-destructive hover:bg-secondary"
                >
                  <LogOut className="size-4" /> Log out
                </button>
              </nav>
            </div>
          )}
        </div>
      ) : (
        <>
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-1.5 rounded-full bg-primary px-3.5 py-2 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90 sm:text-sm"
          >
            <User className="size-3.5" />
            Log in
          </button>
          <AuthModal
            open={modalOpen}
            onClose={() => setModalOpen(false)}
            onAuthed={async () => {
              setModalOpen(false)
              await refreshUser()
            }}
          />
        </>
      )}
    </div>
  )
}

function Avatar({ user }: { user: PublicUser }) {
  if (user.profile_picture_url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={user.profile_picture_url} alt={user.username} className="size-7 rounded-full object-cover" />
  }
  return (
    <div className="flex size-7 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-secondary-foreground">
      {user.username.slice(0, 1).toUpperCase()}
    </div>
  )
}
