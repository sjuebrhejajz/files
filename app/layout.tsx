import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import './globals.css'
import { getCurrentUser } from '@/lib/auth'
import { getUserTheme } from '@/lib/theme'
import { ThemeProvider, type ClientTheme } from '@/components/theme-provider'

export const metadata: Metadata = {
  title: 'files.uncertain.uk',
  description: 'Private file hosting with shareable links that embed in Discord. Up to 250MB, auto-deleted after 7 days.',
  generator: 'v0.app',
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
  },
}

export const viewport: Viewport = {
  colorScheme: 'dark',
  themeColor: '#0d1017',
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const user = await getCurrentUser()
  // Root layouts don't re-run on client-side navigation in the App Router, so
  // a theme saved in Settings would never visually apply until a hard reload
  // if this were the only place it got rendered. ThemeProvider is a client
  // component that owns the actual styling and can update reactively — this
  // just supplies its starting value so the very first paint is already
  // correct (no flash of the default theme before JS runs).
  const dbTheme = user ? await getUserTheme(user.id) : { mode: 'default' as const }
  const initial: ClientTheme =
    dbTheme.mode === 'color'
      ? { mode: 'color', color: dbTheme.color }
      : dbTheme.mode === 'image'
        ? { mode: 'image', imageUrl: dbTheme.imageUrl }
        : { mode: 'default' }

  return (
    <html lang="en" className="dark bg-background">
      <body className="antialiased">
        <ThemeProvider initial={initial}>
          {children}
          {process.env.NODE_ENV === 'production' && <Analytics />}
        </ThemeProvider>
      </body>
    </html>
  )
}
