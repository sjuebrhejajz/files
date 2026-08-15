import type { MetadataRoute } from "next"
import { sql } from "@/lib/db"

const BASE_URL = "https://files.uncertain.uk"

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: BASE_URL, changeFrequency: "daily", priority: 1 },
    { url: `${BASE_URL}/users`, changeFrequency: "daily", priority: 0.5 },
  ]

  // Every public profile page is already reachable at a known URL regardless
  // of whether it's listed here — this only helps search engines discover
  // them faster, it doesn't change who can view them.
  let profileRoutes: MetadataRoute.Sitemap = []
  try {
    const rows = await sql`select username, created_at from users order by created_at desc limit 5000`
    profileRoutes = rows.map((r) => ({
      url: `${BASE_URL}/users/${encodeURIComponent(r.username as string)}`,
      lastModified: new Date(r.created_at as string),
      changeFrequency: "weekly" as const,
      priority: 0.3,
    }))
  } catch (err) {
    // A DB hiccup here shouldn't take down the sitemap entirely — search
    // engines will just see fewer URLs until the next crawl.
    console.error("[sitemap] could not load user profiles:", err)
  }

  return [...staticRoutes, ...profileRoutes]
}
