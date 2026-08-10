import { sql } from "@/lib/db"
import type { Role } from "@/lib/auth"

export type ProfileLink = {
  filename: string
  url: string
  viewUrl: string
  contentType: string | null
  created_at: string
}

export type ProfileBadge = {
  id: string
  name: string
  imageUrl: string
}

export type PublicProfile = {
  username: string
  profile_picture_url: string | null
  banner_url: string | null
  role: Role
  is_donator: boolean
  bio: string | null
  created_at: string
  music_url: string | null
  music_enabled: boolean
  music_title: string | null
  discord_username: string | null
  discord_avatar_url: string | null
  // Admin-granted custom badges — see custom_badges/user_badges in schema.sql.
  badges: ProfileBadge[]
  // null = owner has links_public off ("User disabled viewing" on the profile page)
  links: ProfileLink[] | null
}

export async function getPublicProfile(username: string): Promise<PublicProfile | null> {
  const rows = await sql`
    select id, username, profile_picture_url, banner_url, role, is_donator, bio, links_public, created_at,
           music_object_key, music_enabled, music_title,
           discord_username, discord_avatar_url
    from users
    where lower(username) = ${username.toLowerCase()}
  `
  const row = rows[0]
  if (!row) return null

  const [uploadRows, badgeRows] = await Promise.all([
    row.links_public
      ? sql`
          select short_id, filename, content_type, created_at
          from uploads
          where user_id = ${row.id} and expires_at > now()
          order by created_at desc
          limit 50
        `
      : Promise.resolve([]),
    sql`
      select cb.id, cb.name, cb.image_key
      from user_badges ub
      join custom_badges cb on cb.id = ub.badge_id
      where ub.user_id = ${row.id}
      order by ub.granted_at asc
    `,
  ])

  const links: PublicProfile["links"] = row.links_public
    ? uploadRows.map((r) => ({
        filename: r.filename as string,
        url: `/f/${r.short_id}`,
        viewUrl: `/v/${r.short_id}`,
        contentType: r.content_type as string | null,
        created_at: r.created_at as string,
      }))
    : null

  const badges: ProfileBadge[] = badgeRows.map((b) => ({
    id: b.id as string,
    name: b.name as string,
    imageUrl: `/a/${b.image_key}`,
  }))

  return {
    username: row.username,
    profile_picture_url: row.profile_picture_url,
    banner_url: row.banner_url,
    role: row.role,
    is_donator: Boolean(row.is_donator),
    bio: row.bio,
    created_at: row.created_at,
    music_url: row.music_object_key ? `/a/${row.music_object_key}` : null,
    music_enabled: Boolean(row.music_enabled),
    music_title: row.music_title,
    discord_username: row.discord_username,
    discord_avatar_url: row.discord_avatar_url,
    badges,
    links,
  }
}
