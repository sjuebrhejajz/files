"use client"

import { useState } from "react"
import { X, Loader2 } from "lucide-react"

type Mode = "login" | "login-2fa" | "register-start" | "register-verify" | "forgot-start" | "forgot-verify"

export function AuthModal({
  open,
  onClose,
  onAuthed,
}: {
  open: boolean
  onClose: () => void
  onAuthed: () => void
}) {
  const [mode, setMode] = useState<Mode>("login")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  // shared field state across steps
  const [identifier, setIdentifier] = useState("")
  const [password, setPassword] = useState("")
  const [remember, setRemember] = useState(false)
  const [email, setEmail] = useState("")
  const [code, setCode] = useState("")
  const [username, setUsername] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [ticket, setTicket] = useState("")

  if (!open) return null

  const reset = () => {
    setMode("login")
    setError(null)
    setInfo(null)
    setIdentifier("")
    setPassword("")
    setRemember(false)
    setEmail("")
    setCode("")
    setUsername("")
    setNewPassword("")
    setTicket("")
  }

  const close = () => {
    reset()
    onClose()
  }

  async function call(url: string, body: unknown) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || "Something went wrong.")
    return data
  }

  const submitLogin = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await call("/api/auth/login", { identifier, password, remember })
      if (data.requires2fa) {
        setTicket(data.ticket)
        setMode("login-2fa")
        setInfo("We texted a 6-digit code to your phone.")
      } else {
        onAuthed()
      }
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const submitLogin2fa = async () => {
    setLoading(true)
    setError(null)
    try {
      await call("/api/auth/login/verify", { ticket, code, remember })
      onAuthed()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const submitRegisterStart = async () => {
    setLoading(true)
    setError(null)
    try {
      await call("/api/auth/register", { email })
      setInfo(`We emailed a 6-digit code to ${email}.`)
      setMode("register-verify")
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const submitRegisterVerify = async () => {
    setLoading(true)
    setError(null)
    try {
      await call("/api/auth/register/verify", { email, code, username, password: newPassword })
      onAuthed()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const submitForgotStart = async () => {
    setLoading(true)
    setError(null)
    try {
      await call("/api/auth/forgot-password", { email })
      setInfo(`If ${email} has an account, we sent a reset code.`)
      setMode("forgot-verify")
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const submitForgotVerify = async () => {
    setLoading(true)
    setError(null)
    try {
      await call("/api/auth/reset-password", { email, code, newPassword })
      setInfo("Password reset. You can log in now.")
      setMode("login")
      setPassword("")
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 pt-16 sm:items-center sm:pt-4">
      <div className="w-full max-w-sm rounded-xl border border-border bg-card p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">{titleFor(mode)}</h2>
          <button type="button" onClick={close} className="text-muted-foreground hover:text-foreground">
            <X className="size-4" />
          </button>
        </div>

        {info && <p className="mb-3 rounded-md bg-secondary px-3 py-2 text-xs text-secondary-foreground">{info}</p>}
        {error && <p className="mb-3 rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>}

        {mode === "login" && (
          <div className="flex flex-col gap-3">
            <Field label="Email or username" value={identifier} onChange={setIdentifier} autoFocus />
            <Field label="Password" value={password} onChange={setPassword} type="password" />
            <Checkbox label="Remember this device" checked={remember} onChange={setRemember} />
            <PrimaryButton onClick={submitLogin} loading={loading} label="Log in" />
            <div className="flex items-center justify-between text-xs">
              <LinkButton
                onClick={() => {
                  setError(null)
                  setInfo(null)
                  setMode("forgot-start")
                }}
              >
                Forgot password?
              </LinkButton>
              <LinkButton
                onClick={() => {
                  setError(null)
                  setInfo(null)
                  setMode("register-start")
                }}
              >
                Register
              </LinkButton>
            </div>
          </div>
        )}

        {mode === "login-2fa" && (
          <div className="flex flex-col gap-3">
            <Field label="6-digit code" value={code} onChange={setCode} autoFocus inputMode="numeric" maxLength={6} />
            <PrimaryButton onClick={submitLogin2fa} loading={loading} label="Verify & log in" />
            <BackButton onClick={() => setMode("login")} />
          </div>
        )}

        {mode === "register-start" && (
          <div className="flex flex-col gap-3">
            <Field label="Email" value={email} onChange={setEmail} autoFocus type="email" />
            <PrimaryButton onClick={submitRegisterStart} loading={loading} label="Send verification code" />
            <BackButton onClick={() => setMode("login")} />
          </div>
        )}

        {mode === "register-verify" && (
          <div className="flex flex-col gap-3">
            <Field label="6-digit code" value={code} onChange={setCode} autoFocus inputMode="numeric" maxLength={6} />
            <Field label="Choose a username" value={username} onChange={setUsername} />
            <Field label="Choose a password" value={newPassword} onChange={setNewPassword} type="password" />
            <PrimaryButton onClick={submitRegisterVerify} loading={loading} label="Create account" />
            <BackButton onClick={() => setMode("register-start")} />
          </div>
        )}

        {mode === "forgot-start" && (
          <div className="flex flex-col gap-3">
            <Field label="Email" value={email} onChange={setEmail} autoFocus type="email" />
            <PrimaryButton onClick={submitForgotStart} loading={loading} label="Send reset code" />
            <BackButton onClick={() => setMode("login")} />
          </div>
        )}

        {mode === "forgot-verify" && (
          <div className="flex flex-col gap-3">
            <Field label="6-digit code" value={code} onChange={setCode} autoFocus inputMode="numeric" maxLength={6} />
            <Field label="New password" value={newPassword} onChange={setNewPassword} type="password" />
            <PrimaryButton onClick={submitForgotVerify} loading={loading} label="Reset password" />
            <BackButton onClick={() => setMode("forgot-start")} />
          </div>
        )}
      </div>
    </div>
  )
}

function titleFor(mode: Mode) {
  switch (mode) {
    case "login":
      return "Log in"
    case "login-2fa":
      return "Enter your 2FA code"
    case "register-start":
      return "Create an account"
    case "register-verify":
      return "Verify your email"
    case "forgot-start":
      return "Reset your password"
    case "forgot-verify":
      return "Enter reset code"
  }
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  autoFocus,
  inputMode,
  maxLength,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
  autoFocus?: boolean
  inputMode?: "numeric"
  maxLength?: number
}) {
  return (
    <label className="flex flex-col gap-1 text-xs text-muted-foreground">
      {label}
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoFocus={autoFocus}
        inputMode={inputMode}
        maxLength={maxLength}
        className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
      />
    </label>
  )
}

function Checkbox({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 text-xs text-muted-foreground">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="size-3.5 rounded border-border" />
      {label}
    </label>
  )
}

function PrimaryButton({ onClick, loading, label }: { onClick: () => void; loading: boolean; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className="flex items-center justify-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
    >
      {loading && <Loader2 className="size-3.5 animate-spin" />}
      {label}
    </button>
  )
}

function LinkButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="text-muted-foreground underline-offset-2 hover:text-primary hover:underline">
      {children}
    </button>
  )
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="text-xs text-muted-foreground hover:text-foreground">
      ← Back
    </button>
  )
}
