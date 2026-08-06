"use client"

import { useState } from "react"
import { Heart, Loader2 } from "lucide-react"

const PRESETS = [3, 5, 10]

export function DonateBox() {
  const [amount, setAmount] = useState<number>(5)
  const [custom, setCustom] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const activeAmount = custom ? Number(custom) : amount

  const donate = async () => {
    setError(null)
    if (!activeAmount || activeAmount < 1) {
      setError("Enter at least £1")
      return
    }
    setLoading(true)
    try {
      const res = await fetch("/api/donate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: activeAmount }),
      })
      const data = await res.json()
      if (!res.ok || !data.url) throw new Error(data.error || "Something went wrong")
      window.location.href = data.url
    } catch (err) {
      setError((err as Error).message)
      setLoading(false)
    }
  }

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-500 mt-6 rounded-xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center gap-2">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-secondary text-primary">
          <Heart className="size-4" />
        </span>
        <div>
          <p className="text-sm font-medium text-foreground">Support this site</p>
          <p className="text-xs text-muted-foreground">Covers R2 storage &amp; hosting costs.</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {PRESETS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => {
              setAmount(p)
              setCustom("")
            }}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              !custom && amount === p
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-secondary-foreground hover:bg-accent"
            }`}
          >
            £{p}
          </button>
        ))}
        <input
          type="number"
          min={1}
          placeholder="Custom"
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          className="w-20 rounded-md border border-border bg-background px-2 py-1.5 text-xs text-foreground outline-none focus:border-primary"
        />
        <button
          type="button"
          onClick={donate}
          disabled={loading}
          className="ml-auto inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {loading && <Loader2 className="size-3.5 animate-spin" />}
          Donate
        </button>
      </div>

      {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
    </div>
  )
}
