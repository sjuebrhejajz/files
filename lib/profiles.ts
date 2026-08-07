import { sql } from "@/lib/db"
import type { Role } from "@/lib/auth"

export type PublicProfile = {
  username: string
  profile_picture_url: string | null
  banner_url: string | null
  role: Role
  bio: string | null
  created_at: string
  // null = owner has links_public off ("User disabled viewing" on the profile page)
  links: { filename: string; url: string; created_at: string }[] | null
}

export async function getPublicProfile(username: string): Promise<PublicProfile | null> {
  const rows = await sql`
    select id, username, profile_picture_url, banner_url, role, bio, links_public, created_at
    from users
    where lower(username) = ${username.toLowerCase()}
  `
  const row = rows[0]
  if (!row) return null

  let links: PublicProfile["links"] = null
  if (row.links_public) {
    const uploadRows = await sql`
      select short_id, filename, created_at
      from uploads
      where user_id = ${row.id} and expires_at > now()
      order by created_at desc
      limit 50
    `
    links = uploadRows.map((r) => ({
      filename: r.filename as string,
      url: `/f/${r.short_id}`,
      created_at: r.created_at as string,
    }))
  }

  return {
    username: row.username,
    profile_picture_url: row.profile_picture_url,
    banner_url: row.banner_url,
    role: row.role,
    bio: row.bio,
    created_at: row.created_at,
    links,
  }
}
