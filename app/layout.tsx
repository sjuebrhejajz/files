import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import './globals.css'
import { getCurrentUser } from '@/lib/auth'
import { getUserTheme } from '@/lib/theme'

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
  const theme = user ? await getUserTheme(user.id) : { mode: 'default' as const }

  return (
    <html lang="en" className="dark bg-background">
      <body className="antialiased">
        {theme.mode === 'color' && (
          // theme.color is validated against a strict 6-digit hex pattern in
          // lib/theme.ts before it ever reaches here, so this is safe to inline
          // as plain text (no dangerouslySetInnerHTML needed).
          <style>{`:root { --primary: ${theme.color}; --ring: ${theme.color}; --sidebar-primary: ${theme.color}; }`}</style>
        )}
        {theme.mode === 'image' && (
          <div
            aria-hidden
            className="fixed inset-0 -z-10 bg-cover bg-center"
            style={{ backgroundImage: `url(${theme.imageUrl})` }}
          >
            <div className="absolute inset-0 bg-background/85" />
          </div>
        )}
        {children}
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
