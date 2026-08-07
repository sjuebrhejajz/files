import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { MessageCircle, Play, FileIcon } from "lucide-react"
import { getPublicProfile } from "@/lib/profiles"
import { RoleBadge } from "@/components/role-badge"
import { DonatorBadge } from "@/components/donator-badge"
import { ProfileAudioPlayer } from "@/components/profile-audio-player"

type Props = { params: Promise<{ username: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params
  const profile = await getPublicProfile(username)
  if (!profile) return { title: "User not found" }
  return { title: `${profile.username} — files.uncertain.uk` }
}

export default async function PublicProfilePage({ params }: Props) {
  const { username } = await params
  const profile = await getPublicProfile(username)
  if (!profile) notFound()

  const memberSince = new Date(profile.created_at).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  })

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col px-4 py-10 lg:max-w-4xl">
      <div className="mb-4 overflow-hidden rounded-xl border border-border bg-card">
        {profile.banner_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={profile.banner_url} alt="" className="h-32 w-full object-cover lg:h-48" />
        ) : (
          <div className="h-24 w-full bg-secondary lg:h-32" />
        )}
        {/* Only the avatar+username block is meant to overlap the banner via
            -mt-8 (the classic profile-header look). The badges on the right
            counteract that with their own mt-8, so they sit flush below the
            banner instead of riding up over it. */}
        <div className="-mt-8 flex items-end justify-between gap-4 px-5">
          <div className="flex items-end gap-4">
            {profile.profile_picture_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={profile.profile_picture_url}
                alt={profile.username}
                className="size-16 rounded-full border-4 border-card object-cover shadow-[0_0_24px_-4px_var(--primary)]"
              />
            ) : (
              <div className="flex size-16 items-center justify-center rounded-full border-4 border-card bg-secondary text-xl font-semibold text-secondary-foreground shadow-[0_0_24px_-4px_var(--primary)]">
                {profile.username.slice(0, 1).toUpperCase()}
              </div>
            )}
            <div className="flex items-center gap-1.5 pb-1">
              <h1 className="text-lg font-semibold text-foreground">{profile.username}</h1>
              <RoleBadge role={profile.role} />
            </div>
          </div>

          {(profile.is_donator || profile.discord_username) && (
            <div className="mt-8 flex flex-col items-end gap-1 pb-1">
              {profile.is_donator && (
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-muted-foreground">Donator</span>
                  <DonatorBadge />
                </div>
              )}
              {profile.discord_username && (
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-muted-foreground">{profile.discord_username} on Discord</span>
                  {profile.discord_avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={profile.discord_avatar_url} alt="" className="size-4 rounded-full" />
                  ) : (
                    <MessageCircle className="size-3.5 text-muted-foreground" />
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="px-5 pb-5 pt-3">
          <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
            <span>Member since {memberSince}</span>
            {profile.links !== null && (
              <span>
                {profile.links.length} link{profile.links.length === 1 ? "" : "s"} shared
              </span>
            )}
          </div>

          {profile.bio && <p className="whitespace-pre-wrap text-sm text-foreground">{profile.bio}</p>}
        </div>
      </div>

      {/* Player lives below the profile card now, not squeezed inside the bio area. */}
      {profile.music_enabled && profile.music_url && (
        <div className="mb-6">
          <ProfileAudioPlayer src={profile.music_url} />
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_260px]">
        <div>
          <h2 className="mb-3 text-sm font-medium text-foreground">Links</h2>
          {profile.links === null ? (
            <p className="text-xs text-muted-foreground">User disabled viewing.</p>
          ) : profile.links.length === 0 ? (
            <p className="text-xs text-muted-foreground">No active links.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {profile.links.map((link) => (
                <li key={link.url}>
                  <a
                    href={link.viewUrl}
                    className="flex items-center gap-3 rounded-lg border border-border bg-card p-2.5 transition-colors hover:border-primary/40"
                  >
                    <LinkPreview url={link.url} contentType={link.contentType} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-foreground">{link.filename}</p>
                      <p className="truncate text-[11px] text-muted-foreground">{link.url}</p>
                    </div>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Desktop-only sidebar — keeps the wider lg: layout from looking sparse
            next to a short bio and a handful of links. */}
        <aside className="hidden flex-col gap-4 lg:flex">
          <div className="rounded-xl border border-border bg-card p-4">
            <h3 className="mb-2 text-xs font-medium text-foreground">About this profile</h3>
            <dl className="flex flex-col gap-1.5 text-xs text-muted-foreground">
              <div className="flex justify-between gap-3">
                <dt>Member since</dt>
                <dd className="text-foreground">{memberSince}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt>Role</dt>
                <dd className="text-foreground capitalize">{profile.role}</dd>
              </div>
              {profile.discord_username && (
                <div className="flex justify-between gap-3">
                  <dt>Discord</dt>
                  <dd className="truncate text-foreground">{profile.discord_username}</dd>
                </div>
              )}
              {profile.links !== null && (
                <div className="flex justify-between gap-3">
                  <dt>Shared links</dt>
                  <dd className="text-foreground">{profile.links.length}</dd>
                </div>
              )}
            </dl>
          </div>

          <a
            href="/"
            className="rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/40"
          >
            <h3 className="mb-1 text-xs font-medium text-foreground">Get your own profile</h3>
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              Upload a file on files.uncertain.uk to create an account and claim your own public page.
            </p>
          </a>
        </aside>
      </div>
    </main>
  )
}

function LinkPreview({ url, contentType }: { url: string; contentType: string | null }) {
  const isImage = contentType?.startsWith("image/") ?? false
  const isVideo = contentType?.startsWith("video/") ?? false

  if (isImage) {
    return (
      <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-md bg-secondary">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt="" className="size-full object-cover" />
      </div>
    )
  }

  if (isVideo) {
    return (
      <div className="relative flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-md bg-secondary">
        {/* preload="metadata" only grabs a frame for the thumbnail — it never
            autoplays here, so a page with many video links doesn't turn into
            several videos playing at once. */}
        <video src={url} muted playsInline preload="metadata" className="size-full object-cover" />
        <span className="absolute inset-0 flex items-center justify-center bg-black/30">
          <Play className="size-3.5 fill-white text-white" />
        </span>
      </div>
    )
  }

  return (
    <div className="flex size-12 shrink-0 items-center justify-center rounded-md bg-secondary">
      <FileIcon className="size-4 text-muted-foreground" />
    </div>
  )
}
