"use client"

import { useEffect, useState } from "react"
import { Loader2, ShieldCheck, ShieldOff } from "lucide-react"
import type { PublicUser } from "@/lib/auth"

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

export function SettingsForm({ user }: { user: PublicUser }) {
  return (
    <div className="flex flex-col gap-8">
      <ImageSection user={user} kind="avatar" label="Profile picture" shape="circle" />
      <ImageSection user={user} kind="banner" label="Banner" shape="banner" />
      <BioSection user={user} />
      <LinksPublicSection user={user} />
      <MusicSection />
      <ThemeSection />
      <UsernameSection user={user} />
      <EmailSection user={user} />
      <PasswordSection />
      <TwoFactorSection user={user} />
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

  const onFile = async (file: File) => {
    setError(null)
    if (!file.type.startsWith("image/")) {
      setError("Only image files are allowed.")
      return
    }
    if (file.size > MAX_IMAGE_BYTES) {
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
        <label className="cursor-pointer text-xs font-medium text-primary hover:underline">
          {loading ? "Uploading…" : "Change"}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            disabled={loading}
            onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
          />
        </label>
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">
        Images only (GIF ok, no video) · up to 25 MB · reviewed by staff before it's public
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

function MusicSection() {
  const [status, setStatus] = useState<{ eligible: boolean; enabled: boolean; url: string | null } | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch("/api/user/settings/music")
      .then((r) => r.json())
      .then(setStatus)
      .catch(() => setStatus({ eligible: false, enabled: false, url: null }))
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
    if (file.type !== "audio/mpeg" && file.type !== "audio/mp3") {
      setError("Only MP3 files are allowed.")
      return
    }
    if (file.size > MAX_MUSIC_BYTES) {
      setError("Track must be 15 MB or smaller.")
      return
    }
    setLoading(true)
    try {
      const { uploadUrl, key } = await call("/api/user/settings/music-url", { contentType: file.type, size: file.size })
      const put = await fetch(uploadUrl, { method: "PUT", body: file, headers: { "Content-Type": "audio/mpeg" } })
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
      setStatus({ eligible: true, enabled: false, url: null })
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Section title="Profile music">
      <Msg error={error} info={null} />
      <p className="mb-2 text-xs text-muted-foreground">
        Thanks for donating! Add an MP3 that plays when someone visits your profile. Hidden from your profile until
        you turn it on below.
      </p>
      {status.url ? (
        <audio controls src={status.url} className="mb-3 w-full" />
      ) : (
        <p className="mb-3 text-xs text-muted-foreground">No track uploaded yet.</p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <label className="cursor-pointer text-xs font-medium text-primary hover:underline">
          {loading ? "Working…" : status.url ? "Replace track" : "Upload track"}
          <input
            type="file"
            accept="audio/mpeg,audio/mp3"
            className="hidden"
            disabled={loading}
            onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
          />
        </label>
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

function ThemeSection() {
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
    if (file.size > MAX_THEME_IMAGE_BYTES) {
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
          <label className="cursor-pointer rounded-md bg-secondary px-3 py-1.5 text-xs font-medium text-secondary-foreground hover:bg-accent">
            {loading ? "Working…" : status.hasImage ? "Replace image" : "Upload image"}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              disabled={loading}
              onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
            />
          </label>
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

// ---------------- username ----------------

function UsernameSection({ user }: { user: PublicUser }) {
  const [username, setUsername] = useState(user.username)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  const save = async () => {
    setLoading(true)
    setError(null)
    setInfo(null)
    try {
      await call("/api/user/settings", { username }, "PATCH")
      setInfo("Username updated.")
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Section title="Username">
      <Msg error={error} info={info} />
      <div className="flex gap-2">
        <Input value={username} onChange={(e) => setUsername(e.target.value)} />
        <Button onClick={save} loading={loading} label="Save" />
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">5–20 characters, letters and numbers only.</p>
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

function PasswordSection() {
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  const save = async () => {
    setLoading(true)
    setError(null)
    setInfo(null)
    try {
      await call("/api/user/settings", { currentPassword, newPassword }, "PATCH")
      setInfo("Password updated.")
      setCurrentPassword("")
      setNewPassword("")
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
