import type { MetadataRoute } from "next"

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Nothing under these paths is useful to have indexed — API routes
        // aren't pages, /dashboard is private, and file view/download pages
        // are ephemeral (7-day expiry) so indexing them just sends search
        // traffic to dead links once they expire.
        disallow: ["/api/", "/dashboard/", "/f/", "/v/", "/a/"],
      },
    ],
    sitemap: "https://files.uncertain.uk/sitemap.xml",
  }
}
