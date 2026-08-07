import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { MessageCircle } from "lucide-react"
import { getPublicProfile } from "@/lib/profiles"
import { RoleBadge } from "@/components/role-badge"
import { DonatorBadge } from "@/components/donator-badge"

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
      <div className="mb-6 overflow-hidden rounded-xl border border-border bg-card">
        {profile.banner_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={profile.banner_url} alt="" className="h-32 w-full object-cover lg:h-48" />
        ) : (
          <div className="h-24 w-full bg-secondary lg:h-32" />
        )}
        {/* This row overlaps the banner via -mt-8, so it must stay exactly one
            line tall — anything else (like the donator badge) belongs in the
            section below instead, or it visually rides up over the banner. */}
        <div className="-mt-8 flex items-end gap-4 px-5">
          {profile.profile_picture_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profile.profile_picture_url}
              alt={profile.username}
              className="size-16 rounded-full border-4 border-card object-cover"
            />
          ) : (
            <div className="flex size-16 items-center justify-center rounded-full border-4 border-card bg-secondary text-xl font-semibold text-secondary-foreground">
              {profile.username.slice(0, 1).toUpperCase()}
            </div>
          )}
          <div className="flex items-center gap-1.5 pb-1">
            <h1 className="text-lg font-semibold text-foreground">{profile.username}</h1>
            <RoleBadge role={profile.role} />
          </div>
        </div>

        <div className="px-5 pb-5 pt-3">
          {profile.is_donator && (
            <div className="mb-2 flex items-center gap-1.5">
              <DonatorBadge />
              <span className="text-[11px] text-muted-foreground">Donator</span>
            </div>
          )}

          {profile.discord_username && (
            <div className="mb-2 flex items-center gap-1.5">
              {profile.discord_avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={profile.discord_avatar_url} alt="" className="size-4 rounded-full" />
              ) : (
                <MessageCircle className="size-3.5 text-muted-foreground" />
              )}
              <span className="text-[11px] text-foreground">{profile.discord_username}</span>
              <span className="text-[11px] text-muted-foreground">on Discord</span>
            </div>
          )}

          <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
            <span>Member since {memberSince}</span>
            {profile.links !== null && (
              <span>
                {profile.links.length} link{profile.links.length === 1 ? "" : "s"} shared
              </span>
            )}
          </div>

          {profile.bio && <p className="whitespace-pre-wrap text-sm text-foreground">{profile.bio}</p>}
          {profile.music_enabled && profile.music_url && (
            // Autoplay-with-sound is blocked by most browsers until the visitor
            // has interacted with the page at least once — that's a browser
            // policy, not something a site can override. Controls are shown so
            // playback is still one click away if autoplay gets blocked.
            <audio controls autoPlay loop src={profile.music_url} className="mt-3 w-full" />
          )}
        </div>
      </div>

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
                <li
                  key={link.url}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-3"
                >
                  <span className="truncate text-sm text-foreground">{link.filename}</span>
                  <a href={link.url} className="shrink-0 text-xs text-primary hover:underline">
                    {link.url}
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
