import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { MessageCircle } from "lucide-react"
import { getPublicProfile } from "@/lib/profiles"
import { getCurrentUser, isStaff } from "@/lib/auth"
import { neonFont } from "@/lib/fonts"
import { RoleBadge } from "@/components/role-badge"
import { DonatorBadge } from "@/components/donator-badge"
import { CustomBadge } from "@/components/custom-badge"
import { ProfileAudioPlayer } from "@/components/profile-audio-player"
import { LinkPreview } from "@/components/link-preview"
import { ProfileVideoBackground } from "@/components/profile-video-background"

type Props = { params: Promise<{ username: string }> }

// This page reads live per-user data (video/music toggles, bio, badges,
// links) straight from the database on every request, and none of that
// counts as a Next.js "dynamic API" — without this, Next.js has no signal
// that the page depends on anything request-specific and caches the
// rendered HTML instead of re-running the query on each visit.
export const dynamic = "force-dynamic"

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params
  const profile = await getPublicProfile(username)
  if (!profile) return { title: "User not found" }
  return { title: `${profile.username} — files.uncertain.uk` }
}

// Small pill/tag used for the badge-style facts under the header (Donator,
// Discord, member-since, link count) — replaces plain inline text so they
// read as distinct chips instead of a run-on sentence.
function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary/60 px-2.5 py-1 text-[11px] text-muted-foreground backdrop-blur-sm">
      {children}
    </span>
  )
}

export default async function PublicProfilePage({ params }: Props) {
  const { username } = await params
  const [profile, viewer] = await Promise.all([getPublicProfile(username), getCurrentUser()])
  if (!profile) notFound()

  const memberSince = new Date(profile.created_at).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  })

  // The video background is opt-in per profile (currently admin-only, see
  // lib/profiles.ts) and is always rendered muted — any sound comes from the
  // separate music widget above, never from the background video itself.
  const hasVideoBackground = profile.video_enabled && Boolean(profile.video_url)

  // Owner, staff, and testers see the debug line at the bottom — never the
  // raw src (that's the actual asset path, not something to expose even to
  // trusted-but-non-staff testers), just booleans about what the page decided.
  const canSeeDebug = Boolean(
    viewer &&
      (viewer.username.toLowerCase() === profile.username.toLowerCase() || isStaff(viewer) || viewer.role === "tester"),
  )

  return (
    <>
      {/* Rendered as a sibling of <main>, not a descendant of it. <main> has
          position:relative, which creates its own stacking context — a
          position:fixed child inside that context gets its z-index evaluated
          relative to main's *other* children instead of the page root, which
          is almost certainly why this was invisible even though every value
          checked out correctly (confirmed via the debug line below). The
          working custom-theme background (components/theme-provider.tsx)
          uses this exact same top-level placement, which is what tipped this
          off — same fixed+-z-10 pattern, but never nested inside anything
          positioned. */}
      {hasVideoBackground && <ProfileVideoBackground src={profile.video_url as string} debug={canSeeDebug} />}

      <main className="relative mx-auto flex min-h-screen w-full max-w-2xl flex-col px-4 py-10 lg:max-w-4xl">
        <div
          className={`animate-in fade-in slide-in-from-bottom-2 duration-500 mb-4 overflow-hidden rounded-xl border border-border bg-card transition-shadow ${
            hasVideoBackground ? "bg-card/80 shadow-[0_0_40px_-12px_var(--primary)] backdrop-blur-md" : ""
          }`}
        >
          {profile.banner_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={profile.banner_url} alt="" className="h-32 w-full object-cover lg:h-48" />
          ) : (
            <div className="h-24 w-full bg-secondary lg:h-32" />
          )}
          {/* Only the avatar+username overlaps the banner via -mt-8 (the classic
              profile-header look) — everything else lives in the content
              section below, which has no negative margin, so nothing else can
              ever ride up over the banner. */}
          <div className="-mt-8 flex items-end gap-4 px-5">
            {profile.profile_picture_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={profile.profile_picture_url}
                alt={profile.username}
                className="size-16 rounded-full border-4 border-card object-cover shadow-[0_0_24px_-4px_var(--primary)] transition-shadow duration-300 hover:shadow-[0_0_32px_-2px_var(--primary)]"
              />
            ) : (
              <div className="flex size-16 items-center justify-center rounded-full border-4 border-card bg-secondary text-xl font-semibold text-secondary-foreground shadow-[0_0_24px_-4px_var(--primary)]">
                {profile.username.slice(0, 1).toUpperCase()}
              </div>
            )}
            <div className="flex flex-wrap items-center gap-1.5 pb-1">
              <h1
                className={`${neonFont.className} text-lg tracking-wide text-foreground [text-shadow:0_0_18px_var(--primary)]`}
              >
                {profile.username}
              </h1>
              <RoleBadge role={profile.role} />
              {profile.badges.map((badge) => (
                <CustomBadge key={badge.id} name={badge.name} imageUrl={badge.imageUrl} />
              ))}
            </div>
          </div>

          <div className="px-5 pb-5 pt-3">
            {/* Donator/Discord kept on the right, member-since/links on the
                left — same row, split with justify-between. Still fully
                inside this un-shifted content section (no negative margin
                anywhere here), so it can't ride up into the banner no matter
                how it's arranged left-to-right. */}
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <Pill>Member since {memberSince}</Pill>
                {profile.links !== null && (
                  <Pill>
                    {profile.links.length} link{profile.links.length === 1 ? "" : "s"} shared
                  </Pill>
                )}
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                {profile.is_donator && (
                  <Pill>
                    Donator
                    <DonatorBadge />
                  </Pill>
                )}
                {profile.discord_username && (
                  <Pill>
                    {profile.discord_username} on Discord
                    {profile.discord_avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={profile.discord_avatar_url} alt="" className="size-4 rounded-full" />
                    ) : (
                      <MessageCircle className="size-3.5" />
                    )}
                  </Pill>
                )}
              </div>
            </div>

            {profile.bio && <p className="whitespace-pre-wrap text-sm text-foreground">{profile.bio}</p>}
          </div>
        </div>

        {/* Player lives below the profile card now, not squeezed inside the bio area. */}
        {profile.music_enabled && profile.music_url && (
          <div
            className="animate-in fade-in slide-in-from-bottom-2 duration-500 mb-6"
            style={{ animationDelay: "100ms", animationFillMode: "backwards" }}
          >
            <ProfileAudioPlayer src={profile.music_url} title={profile.music_title} />
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_260px]">
          <div>
            <h2 className={`${neonFont.className} mb-3 text-sm tracking-wide text-foreground`}>Links</h2>
            {profile.links === null ? (
              <p className="text-xs text-muted-foreground">User disabled viewing.</p>
            ) : profile.links.length === 0 ? (
              <p className="text-xs text-muted-foreground">No active links.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {profile.links.map((link, i) => (
                  <li
                    key={link.url}
                    className="animate-in fade-in slide-in-from-bottom-1 duration-300"
                    style={{ animationDelay: `${i * 40}ms`, animationFillMode: "backwards" }}
                  >
                    <a
                      href={link.viewUrl}
                      className="flex items-center gap-3 rounded-lg border border-border bg-card p-2.5 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-[0_0_16px_-6px_var(--primary)]"
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
            <div className="rounded-xl border border-border bg-card p-4 transition-colors duration-200 hover:border-primary/30">
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
              className="rounded-xl border border-border bg-card p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40"
            >
              <h3 className="mb-1 text-xs font-medium text-foreground">Get your own profile</h3>
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                Upload a file on files.uncertain.uk to create an account and claim your own public page.
              </p>
            </a>
          </aside>
        </div>

        {canSeeDebug && (
          <p className="mt-10 rounded-md border border-border bg-secondary/40 px-3 py-2 font-mono text-[10px] text-muted-foreground">
            [debug, only you/staff/testers see this] video_enabled={String(profile.video_enabled)} · has_video_source=
            {String(Boolean(profile.video_url))} · resolved=<b className="text-foreground">{String(hasVideoBackground)}</b>
          </p>
        )}
      </main>
    </>
  )
}
