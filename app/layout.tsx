import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import './globals.css'
import { getCurrentUser } from '@/lib/auth'
import { getUserTheme } from '@/lib/theme'
import { ThemeProvider, type ClientTheme } from '@/components/theme-provider'

const SITE_URL = 'https://files.uncertain.uk'
const SITE_DESCRIPTION =
  'Private file hosting with shareable links that embed in Discord. Up to 250MB, auto-deleted after 7 days.'

export const metadata: Metadata = {
  // Required for Next.js to resolve relative URLs (icons, OG tags) into
  // absolute ones — without this, some crawlers and link-preview bots that
  // don't resolve relative URLs themselves would see broken links.
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'files.uncertain.uk',
    // Lets nested pages set their own <title> (already happening on public
    // profile pages) while keeping "files.uncertain.uk" appended, so search
    // results and browser tabs stay identifiable as this site.
    template: '%s — files.uncertain.uk',
  },
  description: SITE_DESCRIPTION,
  keywords: ['file hosting', 'file sharing', 'discord file embed', 'free file upload', 'temporary file host'],
  generator: 'v0.app',
  // Explicit rather than relying on defaults — this is the actual signal
  // that gets Google to crawl and index the site at all; app/robots.ts
  // covers which specific paths to skip.
  robots: { index: true, follow: true },
  openGraph: {
    type: 'website',
    url: SITE_URL,
    siteName: 'files.uncertain.uk',
    title: 'files.uncertain.uk',
    description: SITE_DESCRIPTION,
  },
  twitter: {
    card: 'summary',
    title: 'files.uncertain.uk',
    description: SITE_DESCRIPTION,
  },
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
