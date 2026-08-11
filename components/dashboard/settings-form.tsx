"use client"

import { useEffect, useState } from "react"
import {
  ArrowLeft,
  KeyRound,
  Link2,
  Loader2,
  Search,
  ShieldCheck,
  ShieldOff,
  Sparkles,
  User as UserIcon,
} from "lucide-react"
import type { ComponentType } from "react"
import type { PublicUser } from "@/lib/auth"

// A local, client-safe copy of lib/auth.ts's isStaff() — that file imports
// next/headers (for cookies()), and importing anything runtime from it here
// pulls the whole server-only module into the client bundle, which Next.js
// rejects at build time. This only needs the role string, so it doesn't
// need any of that.
function isStaffClient(user: Pick<PublicUser, "role">): boolean {
  return user.role === "moderator" || user.role === "admin" || user.role === "owner"
}
import { useTheme } from "@/components/theme-provider"

async function call(url: string, body: unknown, method: "POST" | "PATCH" = "POST") {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || "Something went wrong.")
  return data
}

type Category = "profile" | "perks" | "connections" | "account"

const CATEGORIES: {
  id: Category
  label: string
  description: string
  icon: ComponentType<{ className?: string }>
  keywords: string[]
}[] = [
  {
    id: "profile",
    label: "Profile",
    description: "Picture, banner, bio & public visibility",
    icon: UserIcon,
    keywords: ["avatar", "picture", "banner", "bio", "links", "public"],
  },
  {
    id: "perks",
    label: "Perks",
    description: "Music widget & custom site theme",
    icon: Sparkles,
    keywords: ["music", "theme", "color", "background", "donator"],
  },
  {
    id: "connections",
    label: "Connections",
    description: "Link your Discord account",
    icon: Link2,
    keywords: ["discord", "oauth"],
  },
  {
    id: "account",
    label: "Account",
    description: "Username, email, password & 2FA",
    icon: KeyRound,
    keywords: ["username", "email", "password", "2fa", "two-factor", "security"],
  },
]

export function SettingsForm({ user }: { user: PublicUser }) {
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
      </nav>

      <div className="min-w-0 flex-1">
        {category === null ? (
          <WelcomeView user={user} onSelect={setCategory} />
        ) : (
          <>
            <button
              type="button"
              onClick={() => setCategory(null)}
              className="mb-4 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary"
            >
              <ArrowLeft className="size-3.5" /> All settings
            </button>
            <div className="flex flex-col gap-8">
              {category === "profile" && (
                <>
                  <ImageSection user={user} kind="avatar" label="Profile picture" shape="circle" />
                  <ImageSection user={user} kind="banner" label="Banner" shape="banner" />
                  <BioSection user={user} />
                  <LinksPublicSection user={user} />
                </>
              )}
              {category === "perks" && (
                <>
                  <MusicSection user={user} />
                  <ThemeSection user={user} />
                </>
              )}
              {category === "connections" && <DiscordSection />}
              {category === "account" && (
                <>
                  <UsernameSection user={user} />
                  <EmailSection user={user} />
                  <PasswordSection user={user} />
                  <TwoFactorSection user={user} />
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function WelcomeView({ user, onSelect }: { user: PublicUser; onSelect: (c: Category) => void }) {
  const [query, setQuery] = useState("")
  const q = query.trim().toLowerCase()
  const filtered = CATEGORIES.filter(
    (c) => q === "" || [c.label, c.description, ...c.keywords].some((s) => s.toLowerCase().includes(q)),
  )

  return (
    <div>
      <h2 className="mb-1 text-base font-semibold text-foreground">Welcome, {user.username}</h2>
      <p className="mb-4 text-xs text-muted-foreground">Pick a category to manage your account.</p>
      <div className="mb-4 flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2">
        <Search className="size-3.5 shrink-0 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search settings…"
          className="w-full bg-transparent text-sm text-foreground outline-none"
        />
      </div>
      {filtered.length === 0 ? (
        <p className="text-xs text-muted-foreground">No settings match "{query}".</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <h2 className="mb-3 text-sm font-medium text-foreground">{title}</h2>
      {children}
    </section>
  )
}

function Msg({ error, info }: { error: string | null; info: string | null }) {
  return (
    <>
      {info && <p className="mb-2 rounded-md bg-secondary px-3 py-2 text-xs text-secondary-foreground">{info}</p>}
      {error && <p className="mb-2 rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>}
    </>
  )
}

function Button({ onClick, loading, label }: { onClick: () => void; loading: boolean; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className="flex items-center justify-center gap-1.5 rounded-md bg-primary px-4 py-2 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
    >
      {loading && <Loader2 className="size-3.5 animate-spin" />}
      {label}
    </button>
  )
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
    />
  )
}

// ---------------- profile picture / banner ----------------

const MAX_IMAGE_BYTES = 25 * 1024 * 1024 // 25 MB

function ImageSection({
  user,
  kind,
  label,
  shape,
}: {
  user: PublicUser
  kind: "avatar" | "banner"
  label: string
  shape: "circle" | "banner"
}) {
  const approvedUrl = kind === "avatar" ? user.profile_picture_url : user.banner_url
  const [localPreview, setLocalPreview] = useState<string | null>(null)
  const [pending, setPending] = useState<{ status: string; reason: string | null } | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch("/api/user/settings/image")
      .then((r) => r.json())
      .then((data) => setPending(data[kind] ?? null))
      .catch(() => {})
  }, [kind])

  const ALLOWED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif"]

  const onFile = async (file: File) => {
    setError(null)
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setError("Only PNG, JPEG, WebP, or GIF images are allowed.")
      return
    }
    if (!isStaffClient(user) && file.size > MAX_IMAGE_BYTES) {
      setError("Images must be 25 MB or smaller.")
      return
    }

    setLoading(true)
    try {
      const endpoint = kind === "avatar" ? "/api/user/settings/avatar-url" : "/api/user/settings/banner-url"
      const { uploadUrl, key } = await call(endpoint, { contentType: file.type, size: file.size })
      const put = await fetch(uploadUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type } })
      if (!put.ok) throw new Error("Upload failed.")
      await call("/api/user/settings/image", { kind, key })
      setLocalPreview(URL.createObjectURL(file))
      setPending({ status: "pending", reason: null })
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const displayUrl = localPreview ?? approvedUrl
  const imgClass = shape === "circle" ? "size-14 rounded-full object-cover" : "h-16 w-full max-w-xs rounded-md object-cover"

  return (
    <Section title={label}>
      <Msg error={error} info={null} />
      {pending?.status === "pending" && (
        <p className="mb-2 rounded-md bg-secondary px-3 py-2 text-xs text-secondary-foreground">
          Your new {kind} is pending staff review.
        </p>
      )}
      {pending?.status === "denied" && (
        <p className="mb-2 rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
          Your last {kind} was denied{pending.reason ? `: ${pending.reason}` : "."}
        </p>
      )}
      <div className="flex items-center gap-4">
        {displayUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={displayUrl} alt={label} className={imgClass} />
        ) : shape === "circle" ? (
          <div className="flex size-14 items-center justify-center rounded-full bg-secondary text-lg font-semibold text-secondary-foreground">
            {user.username.slice(0, 1).toUpperCase()}
          </div>
        ) : (
          <div className="flex h-16 w-full max-w-xs items-center justify-center rounded-md bg-secondary text-xs text-muted-foreground">
            No banner
          </div>
        )}
        <div className="relative inline-flex">
          <span
            aria-hidden
            className="pointer-events-none flex items-center rounded-md bg-secondary px-3 py-1.5 text-xs font-medium text-secondary-foreground"
          >
            {loading ? "Uploading…" : "Change"}
          </span>
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            disabled={loading}
            onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
            // The real file input, sized and positioned exactly over the
            // visible chip above and made fully transparent — the tap lands
            // on this native input directly. No simulated click, no label
            // delegation, no hiding technique to trust: this is the same
            // pattern most production file-upload buttons use because it's
            // the only one with zero cross-browser ambiguity.
            className="absolute inset-0 size-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
          />
        </div>
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">
        PNG, JPEG, WebP, or GIF · up to 25 MB · reviewed by staff before it's public
      </p>
    </Section>
  )
}

// ---------------- bio ----------------

function BioSection({ user }: { user: PublicUser }) {
  const [bio, setBio] = useState(user.bio ?? "")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  const save = async () => {
    setLoading(true)
    setError(null)
    setInfo(null)
    try {
      await call("/api/user/settings", { bio }, "PATCH")
      setInfo("Bio updated.")
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Section title="Bio">
      <Msg error={error} info={info} />
      <textarea
        value={bio}
        onChange={(e) => setBio(e.target.value)}
        maxLength={280}
        rows={3}
        placeholder="Tell people a bit about yourself (no links)"
        className="mb-2 w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
      />
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-muted-foreground">{bio.length}/280 · no links allowed</span>
        <Button onClick={save} loading={loading} label="Save" />
      </div>
    </Section>
  )
}

// ---------------- public links toggle ----------------

function LinksPublicSection({ user }: { user: PublicUser }) {
  const [enabled, setEnabled] = useState(user.links_public)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const toggle = async () => {
    const next = !enabled
    setLoading(true)
    setError(null)
    try {
      await call("/api/user/settings", { linksPublic: next }, "PATCH")
      setEnabled(next)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Section title="Public profile">
      <Msg error={error} info={null} />
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs text-foreground">Make my uploaded links public</p>
          <p className="text-[11px] text-muted-foreground">Shows your active links on your public profile page.</p>
        </div>
        <button
          type="button"
          onClick={toggle}
          disabled={loading}
          aria-pressed={enabled}
          className={`h-6 w-11 shrink-0 rounded-full transition-colors ${enabled ? "bg-primary" : "bg-secondary"}`}
        >
          <span
            className={`block size-5 translate-x-0.5 rounded-full bg-background transition-transform ${enabled ? "translate-x-[22px]" : ""}`}
          />
        </button>
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">
        Your public profile:{" "}
        <a href={`/users/${user.username}`} className="text-primary hover:underline">
          /users/{user.username}
        </a>
      </p>
    </Section>
  )
}

// ---------------- profile music (donation-gated) ----------------

const MAX_MUSIC_BYTES = 15 * 1024 * 1024 // 15 MB

function MusicSection({ user }: { user: PublicUser }) {
  const [status, setStatus] = useState<{ eligible: boolean; enabled: boolean; url: string | null; title: string | null } | null>(
    null,
  )
  const [titleInput, setTitleInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  useEffect(() => {
    fetch("/api/user/settings/music")
      .then((r) => r.json())
      .then((data) => {
        setStatus(data)
        setTitleInput(data.title ?? "")
      })
      .catch(() => setStatus({ eligible: false, enabled: false, url: null, title: null }))
  }, [])

  if (!status) return null

  if (!status.eligible) {
    return (
      <Section title="Profile music">
        <p className="text-xs text-muted-foreground">
          Donate any amount to unlock a music widget for your public profile.
        </p>
      </Section>
    )
  }

  const onFile = async (file: File) => {
    setError(null)
    // file.type is unreliable for MP3s on some Android browsers/pickers (often
    // comes back empty or non-standard), which was silently rejecting valid
    // files here. Extension is a much more reliable signal for this one format.
    const looksLikeMp3 = file.name.toLowerCase().endsWith(".mp3") || file.type === "audio/mpeg" || file.type === "audio/mp3"
    if (!looksLikeMp3) {
      setError("Only MP3 files are allowed.")
      return
    }
    if (!isStaffClient(user) && file.size > MAX_MUSIC_BYTES) {
      setError("Track must be 15 MB or smaller.")
      return
    }
    // Normalize to a single canonical type — used for both the presign request
    // and the actual PUT header below, so they always match.
    const contentType = "audio/mpeg"
    setLoading(true)
    try {
      const { uploadUrl, key } = await call("/api/user/settings/music-url", { contentType, size: file.size })
      const put = await fetch(uploadUrl, { method: "PUT", body: file, headers: { "Content-Type": contentType } })
      if (!put.ok) throw new Error("Upload failed.")
      await call("/api/user/settings/music", { key })
      setStatus((s) => (s ? { ...s, url: `/a/${key}` } : s))
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const toggle = async () => {
    const next = !status.enabled
    setLoading(true)
    setError(null)
    try {
      await call("/api/user/settings/music", { enabled: next })
      setStatus((s) => (s ? { ...s, enabled: next } : s))
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const remove = async () => {
    setLoading(true)
    setError(null)
    try {
      await call("/api/user/settings/music", { remove: true })
      setStatus({ eligible: true, enabled: false, url: null, title: null })
      setTitleInput("")
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const saveTitle = async () => {
    setLoading(true)
    setError(null)
    setInfo(null)
    try {
      await call("/api/user/settings/music", { title: titleInput })
      setStatus((s) => (s ? { ...s, title: titleInput.trim() || null } : s))
      setInfo("Track name updated.")
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Section title="Profile music">
      <Msg error={error} info={info} />
      <p className="mb-2 text-xs text-muted-foreground">
        Thanks for donating! Add an MP3 that plays when someone visits your profile. Hidden from your profile until
        you turn it on below.
      </p>
      {status.url ? (
        <audio controls src={status.url} className="mb-3 w-full" />
      ) : (
        <p className="mb-3 text-xs text-muted-foreground">No track uploaded yet.</p>
      )}
      {status.url && (
        <div className="mb-3 flex gap-2">
          <Input
            value={titleInput}
            onChange={(e) => setTitleInput(e.target.value)}
            placeholder="Track name (shown instead of “Profile music”)"
            maxLength={60}
          />
          <Button onClick={saveTitle} loading={loading} label="Save" />
        </div>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative inline-flex">
          <span
            aria-hidden
            className="pointer-events-none flex items-center rounded-md bg-secondary px-3 py-1.5 text-xs font-medium text-secondary-foreground"
          >
            {loading ? "Working…" : status.url ? "Replace track" : "Upload track"}
          </span>
          <input
            type="file"
            accept="audio/mpeg,audio/mp3,.mp3"
            disabled={loading}
            onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
            className="absolute inset-0 size-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
          />
        </div>
        {status.url && (
          <>
            <button type="button" onClick={toggle} disabled={loading} className="text-xs font-medium text-foreground hover:underline">
              {status.enabled ? "Turn off on profile" : "Turn on for profile"}
            </button>
            <button type="button" onClick={remove} disabled={loading} className="text-xs font-medium text-destructive hover:underline">
              Remove
            </button>
          </>
        )}
      </div>
    </Section>
  )
}

// ---------------- site theme (donator-gated) ----------------

const MAX_THEME_IMAGE_BYTES = 25 * 1024 * 1024 // 25 MB

function ThemeSection({ user }: { user: PublicUser }) {
  const { setTheme } = useTheme()
  const [status, setStatus] = useState<{
    eligible: boolean
    mode: "default" | "color" | "image"
    color: string | null
    hasImage: boolean
  } | null>(null)
  const [color, setColor] = useState("#ff00ff")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  useEffect(() => {
    fetch("/api/user/settings/theme")
      .then((r) => r.json())
      .then((data) => {
        setStatus(data)
        if (data.color) setColor(data.color)
      })
      .catch(() => setStatus({ eligible: false, mode: "default", color: null, hasImage: false }))
  }, [])

  if (!status) return null

  if (!status.eligible) {
    return (
      <Section title="Site theme">
        <p className="text-xs text-muted-foreground">
          Donate any amount to unlock a custom site theme — your own accent color or background image.
        </p>
      </Section>
    )
  }

  const setDefault = async () => {
    setLoading(true)
    setError(null)
    setInfo(null)
    try {
      await call("/api/user/settings/theme", { mode: "default" })
      setStatus((s) => (s ? { ...s, mode: "default", hasImage: false } : s))
      setTheme({ mode: "default" })
      setInfo("Reset to the default theme.")
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const saveColor = async () => {
    setLoading(true)
    setError(null)
    setInfo(null)
    try {
      await call("/api/user/settings/theme", { mode: "color", color })
      setStatus((s) => (s ? { ...s, mode: "color", color } : s))
      setTheme({ mode: "color", color })
      setInfo("Theme color updated.")
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const onFile = async (file: File) => {
    setError(null)
    if (file.type === "image/gif" || file.type.startsWith("video/")) {
      setError("GIFs and videos aren't allowed for theme backgrounds.")
      return
    }
    if (!file.type.startsWith("image/")) {
      setError("Only image files are allowed.")
      return
    }
    if (!isStaffClient(user) && file.size > MAX_THEME_IMAGE_BYTES) {
      setError("Image must be 25 MB or smaller.")
      return
    }
    setLoading(true)
    try {
      const { uploadUrl, key } = await call("/api/user/settings/theme-url", { contentType: file.type, size: file.size })
      const put = await fetch(uploadUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type } })
      if (!put.ok) throw new Error("Upload failed.")
      await call("/api/user/settings/theme", { mode: "image", key })
      setStatus((s) => (s ? { ...s, mode: "image", hasImage: true } : s))
      setTheme({ mode: "image", imageUrl: `/a/${key}` })
      setInfo("Theme background updated.")
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Section title="Site theme">
      <Msg error={error} info={info} />
      <p className="mb-3 text-xs text-muted-foreground">
        Thanks for donating! Personalize how the site looks while you&apos;re signed in — pick an accent color, or
        upload your own background (static images only, up to 25 MB — no GIFs or video). Only you ever see it.
      </p>

      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-medium text-foreground">Accent color</p>
            <p className="text-[11px] text-muted-foreground">Replaces the site&apos;s neon accent with your own color.</p>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="size-9 cursor-pointer rounded-md border border-border bg-background p-1"
            />
            <button
              type="button"
              disabled={loading}
              onClick={saveColor}
              className="rounded-md bg-secondary px-3 py-1.5 text-xs font-medium text-secondary-foreground hover:bg-accent disabled:opacity-60"
            >
              Use this color
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-medium text-foreground">Background image</p>
            <p className="text-[11px] text-muted-foreground">
              {status.hasImage ? "A custom background is set." : "No custom background set."}
            </p>
          </div>
          <div className="relative inline-flex">
            <span
              aria-hidden
              className="pointer-events-none flex items-center rounded-md bg-secondary px-3 py-1.5 text-xs font-medium text-secondary-foreground"
            >
              {loading ? "Working…" : status.hasImage ? "Replace image" : "Upload image"}
            </span>
            <input
              type="file"
              accept="image/*"
              disabled={loading}
              onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
              className="absolute inset-0 size-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
            />
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-border pt-3">
          <p className="text-[11px] text-muted-foreground">
            Currently using:{" "}
            <span className="font-medium text-foreground">
              {status.mode === "default" ? "site default" : status.mode === "color" ? "your accent color" : "your background image"}
            </span>
          </p>
          {status.mode !== "default" && (
            <button
              type="button"
              disabled={loading}
              onClick={setDefault}
              className="text-xs font-medium text-foreground hover:underline"
            >
              Reset to default
            </button>
          )}
        </div>
      </div>
    </Section>
  )
}

// ---------------- Discord linking ----------------

function DiscordSection() {
  const [status, setStatus] = useState<{ connected: boolean; username: string | null; avatarUrl: string | null } | null>(
    null,
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  useEffect(() => {
    fetch("/api/user/settings/discord")
      .then((r) => r.json())
      .then(setStatus)
      .catch(() => setStatus({ connected: false, username: null, avatarUrl: null }))
  }, [])

  useEffect(() => {
    // Plain browser API rather than Next's useSearchParams — avoids needing a
    // Suspense boundary just to read a couple of one-off redirect params.
    const params = new URLSearchParams(window.location.search)
    if (params.get("discord_connected")) {
      setInfo("Discord account connected.")
    } else if (params.get("discord_error") === "taken") {
      setError("That Discord account is already linked to another user.")
    } else if (params.get("discord_error")) {
      setError("Could not connect Discord. Please try again.")
    }
    if (params.has("discord_connected") || params.has("discord_error")) {
      window.history.replaceState({}, "", window.location.pathname)
    }
  }, [])

  const disconnect = async () => {
    setLoading(true)
    setError(null)
    setInfo(null)
    try {
      const res = await fetch("/api/user/settings/discord", { method: "DELETE" })
      if (!res.ok) throw new Error("Could not disconnect Discord.")
      setStatus({ connected: false, username: null, avatarUrl: null })
      setInfo("Discord disconnected.")
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  if (!status) return null

  return (
    <Section title="Discord">
      <Msg error={error} info={info} />
      {status.connected ? (
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {status.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={status.avatarUrl} alt="" className="size-8 rounded-full" />
            ) : (
              <div className="flex size-8 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-secondary-foreground">
                D
              </div>
            )}
            <div>
              <p className="text-xs font-medium text-foreground">{status.username}</p>
              <p className="text-[11px] text-muted-foreground">Shown on your public profile</p>
            </div>
          </div>
          <button
            type="button"
            onClick={disconnect}
            disabled={loading}
            className="text-xs font-medium text-destructive hover:underline disabled:opacity-60"
          >
            Disconnect
          </button>
        </div>
      ) : (
        <div>
          <p className="mb-2 text-xs text-muted-foreground">
            Connect your Discord account to show it on your public profile.
          </p>
          <a
            href="/api/auth/discord/start"
            className="inline-flex items-center gap-1.5 rounded-md bg-secondary px-3 py-1.5 text-xs font-medium text-secondary-foreground hover:bg-accent"
          >
            Connect Discord
          </a>
        </div>
      )}
    </Section>
  )
}

// ---------------- username ----------------

function UsernameSection({ user }: { user: PublicUser }) {
  const [username, setUsername] = useState(user.username)
  const [currentPassword, setCurrentPassword] = useState("")
  const [code, setCode] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  const save = async () => {
    setLoading(true)
    setError(null)
    setInfo(null)
    try {
      await call("/api/user/settings", { username, currentPassword, code }, "PATCH")
      setInfo("Username updated.")
      setCurrentPassword("")
      setCode("")
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Section title="Username">
      <Msg error={error} info={info} />
      <div className="flex flex-col gap-2">
        <Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Username" />
        <Input
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          type="password"
          placeholder="Current password"
        />
        {user.two_fa_enabled && (
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            inputMode="numeric"
            maxLength={6}
            placeholder="6-digit 2FA code"
          />
        )}
        <Button onClick={save} loading={loading} label="Save" />
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">
        5–20 characters, letters and numbers only. Requires your password{user.two_fa_enabled ? " and 2FA code" : ""}.
      </p>
    </Section>
  )
}

// ---------------- email ----------------

function EmailSection({ user }: { user: PublicUser }) {
  const [step, setStep] = useState<"idle" | "code">("idle")
  const [newEmail, setNewEmail] = useState("")
  const [code, setCode] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  const sendCode = async () => {
    setLoading(true)
    setError(null)
    setInfo(null)
    try {
      await call("/api/user/settings/email", { newEmail })
      setInfo(`Code sent to ${newEmail}.`)
      setStep("code")
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const confirmCode = async () => {
    setLoading(true)
    setError(null)
    try {
      await call("/api/user/settings/email/verify", { code })
      setInfo("Email updated. Refresh to see the change everywhere.")
      setStep("idle")
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Section title="Email">
      <Msg error={error} info={info} />
      <p className="mb-2 text-xs text-muted-foreground">Current: {user.email}</p>
      {step === "idle" ? (
        <div className="flex gap-2">
          <Input placeholder="New email" type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
          <Button onClick={sendCode} loading={loading} label="Send code" />
        </div>
      ) : (
        <div className="flex gap-2">
          <Input placeholder="6-digit code" inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value)} />
          <Button onClick={confirmCode} loading={loading} label="Confirm" />
        </div>
      )}
    </Section>
  )
}

// ---------------- password ----------------

function PasswordSection({ user }: { user: PublicUser }) {
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [code, setCode] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  const save = async () => {
    setLoading(true)
    setError(null)
    setInfo(null)
    try {
      await call("/api/user/settings", { currentPassword, newPassword, code }, "PATCH")
      setInfo("Password updated.")
      setCurrentPassword("")
      setNewPassword("")
      setCode("")
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Section title="Password">
      <Msg error={error} info={info} />
      <div className="flex flex-col gap-2">
        <Input
          placeholder="Current password"
          type="password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
        />
        <Input placeholder="New password" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
        {user.two_fa_enabled && (
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            inputMode="numeric"
            maxLength={6}
            placeholder="6-digit 2FA code"
          />
        )}
        <Button onClick={save} loading={loading} label="Update password" />
      </div>
    </Section>
  )
}

// ---------------- 2FA ----------------

function TwoFactorSection({ user }: { user: PublicUser }) {
  const [enabled, setEnabled] = useState(user.two_fa_enabled)
  const [step, setStep] = useState<"idle" | "code" | "disable">("idle")
  const [qrCode, setQrCode] = useState<string | null>(null)
  const [secret, setSecret] = useState<string | null>(null)
  const [code, setCode] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  const startSetup = async () => {
    setLoading(true)
    setError(null)
    setInfo(null)
    try {
      const data = await call("/api/auth/2fa/setup", {})
      setQrCode(data.qrCode)
      setSecret(data.secret)
      setStep("code")
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const confirmSetup = async () => {
    setLoading(true)
    setError(null)
    try {
      await call("/api/auth/2fa/verify", { code })
      setEnabled(true)
      setStep("idle")
      setQrCode(null)
      setSecret(null)
      setCode("")
      setInfo("Two-factor authentication enabled.")
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const disable = async () => {
    setLoading(true)
    setError(null)
    try {
      await call("/api/auth/2fa/disable", { password })
      setEnabled(false)
      setStep("idle")
      setPassword("")
      setInfo("Two-factor authentication disabled.")
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Section title="Two-factor authentication">
      <Msg error={error} info={info} />

      {enabled ? (
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-xs text-primary">
            <ShieldCheck className="size-4" /> Enabled
          </span>
          {step === "disable" ? (
            <div className="flex gap-2">
              <Input placeholder="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
              <Button onClick={disable} loading={loading} label="Confirm disable" />
            </div>
          ) : (
            <button type="button" onClick={() => setStep("disable")} className="flex items-center gap-1 text-xs text-destructive hover:underline">
              <ShieldOff className="size-3.5" /> Disable
            </button>
          )}
        </div>
      ) : step === "idle" ? (
        <div>
          <p className="mb-2 text-xs text-muted-foreground">
            Use an authenticator app (Google Authenticator, Authy, 1Password, etc.) to generate login codes.
          </p>
          <Button onClick={startSetup} loading={loading} label="Enable" />
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {qrCode && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qrCode} alt="Scan this QR code with your authenticator app" className="size-40 rounded-md border border-border" />
          )}
          {secret && (
            <p className="break-all text-xs text-muted-foreground">
              Can&apos;t scan? Enter this key manually: <span className="font-mono text-foreground">{secret}</span>
            </p>
          )}
          <div className="flex gap-2">
            <Input placeholder="6-digit code" inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value)} />
            <Button onClick={confirmSetup} loading={loading} label="Confirm" />
          </div>
        </div>
      )}
    </Section>
  )
}
