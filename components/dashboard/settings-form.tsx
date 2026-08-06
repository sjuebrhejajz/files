"use client"

import { useState } from "react"
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
      <AvatarSection user={user} />
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

// ---------------- profile picture ----------------

function AvatarSection({ user }: { user: PublicUser }) {
  const [preview, setPreview] = useState(user.profile_picture_url)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onFile = async (file: File) => {
    setLoading(true)
    setError(null)
    try {
      const { uploadUrl, publicUrl } = await call("/api/user/settings/avatar-url", { contentType: file.type })
      const put = await fetch(uploadUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type } })
      if (!put.ok) throw new Error("Upload failed.")
      await call("/api/user/settings", { profilePictureUrl: publicUrl }, "PATCH")
      setPreview(publicUrl)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Section title="Profile picture">
      <Msg error={error} info={null} />
      <div className="flex items-center gap-4">
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="Profile" className="size-14 rounded-full object-cover" />
        ) : (
          <div className="flex size-14 items-center justify-center rounded-full bg-secondary text-lg font-semibold text-secondary-foreground">
            {user.username.slice(0, 1).toUpperCase()}
          </div>
        )}
        <label className="cursor-pointer text-xs font-medium text-primary hover:underline">
          {loading ? "Uploading…" : "Change picture"}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="hidden"
            disabled={loading}
            onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
          />
        </label>
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
