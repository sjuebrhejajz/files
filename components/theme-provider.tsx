"use client"

import { createContext, useContext, useState, type ReactNode } from "react"

export type ClientTheme = { mode: "default" } | { mode: "color"; color: string } | { mode: "image"; imageUrl: string }

type ThemeContextValue = {
  theme: ClientTheme
  setTheme: (theme: ClientTheme) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

// Kept in sync with lib/theme.ts's HEX_COLOR_PATTERN. Duplicated rather than
// imported because lib/theme.ts pulls in server-only DB code — importing it
// here would drag that into the client bundle.
const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/

export function ThemeProvider({ initial, children }: { initial: ClientTheme; children: ReactNode }) {
  const [theme, setTheme] = useState<ClientTheme>(initial)

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {theme.mode === "color" && HEX_COLOR_PATTERN.test(theme.color) && (
        // Rendered declaratively from state (not injected via useEffect), so a
        // change from settings takes effect the instant setTheme runs — no
        // page reload needed, and the server-rendered value on first load
        // matches immediately with zero flash of the default theme.
        <style>{`:root { --primary: ${theme.color}; --ring: ${theme.color}; --sidebar-primary: ${theme.color}; --sidebar-ring: ${theme.color}; }`}</style>
      )}
      {theme.mode === "image" && (
        <div
          aria-hidden
          className="fixed inset-0 -z-10 bg-cover bg-center"
          style={{ backgroundImage: `url(${theme.imageUrl})` }}
        >
          <div className="absolute inset-0 bg-background/85" />
        </div>
      )}
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider")
  return ctx
}
