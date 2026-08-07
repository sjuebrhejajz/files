-- Run this once against your Neon/Vercel Postgres database.
-- psql "$DATABASE_URL" -f lib/schema.sql

create extension if not exists pgcrypto;

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  username text unique not null,
  password_hash text not null,
  profile_picture_url text,
  phone_number text,
  phone_verified boolean not null default false,
  two_fa_enabled boolean not null default false,
  email_verified boolean not null default true, -- true because email is verified before the account row is created
  created_at timestamptz not null default now()
);

-- Holds an email that has requested registration but hasn't verified + picked a username/password yet.
create table if not exists pending_registrations (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  code_hash text not null,
  expires_at timestamptz not null,
  attempts int not null default 0,
  created_at timestamptz not null default now()
);

-- Generic one-time codes: login 2FA, password reset, phone verification, email change.
create table if not exists verification_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  purpose text not null, -- 'login_2fa' | 'password_reset' | 'phone_2fa' | 'email_change'
  code_hash text not null,
  destination text,
  metadata jsonb,
  expires_at timestamptz not null,
  attempts int not null default 0,
  used boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  token_hash text unique not null,
  user_id uuid not null references users(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

-- "Remember this device" — lets a verified device skip 2FA until it expires.
create table if not exists trusted_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  device_token_hash text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique(user_id, device_token_hash)
);

create table if not exists donations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete set null,
  amount_cents int not null,
  stripe_session_id text unique,
  created_at timestamptz not null default now()
);

-- Tracks every uploaded file so the dashboard can list/delete a user's own links.
-- user_id is nullable: uploads from logged-out visitors still work, they just
-- won't show up on anyone's dashboard.
create table if not exists uploads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete set null,
  short_id text unique not null,
  object_key text not null,
  filename text not null,
  content_type text,
  size_bytes bigint,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create index if not exists idx_donations_user on donations(user_id);
create index if not exists idx_sessions_token on sessions(token_hash);
create index if not exists idx_verification_codes_lookup on verification_codes(user_id, purpose);
create index if not exists idx_uploads_user on uploads(user_id);
create index if not exists idx_uploads_short_id on uploads(short_id);

-- TOTP (authenticator app) 2FA. Run this if your users table predates this migration:
alter table users add column if not exists two_fa_secret text;

-- ============================================================================
-- Roles, blacklist, and image moderation.
-- Safe to run against a database that already has the tables/columns above.
-- ============================================================================

alter table users add column if not exists role text not null default 'user';

do $$
begin
  if exists (select 1 from pg_constraint where conname = 'users_role_check') then
    alter table users drop constraint users_role_check;
  end if;
  alter table users add constraint users_role_check check (role in ('user', 'moderator', 'admin', 'tester'));
end $$;

alter table users add column if not exists bio text;
alter table users add column if not exists banner_url text;
alter table users add column if not exists links_public boolean not null default false;

-- The account named "admin" is always the site admin.
update users set role = 'admin' where lower(username) = 'admin';

-- Bans/blocks by IP, username, or email. Enforced at register, login, and upload.
create table if not exists blacklist (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('ip', 'username', 'email')),
  value text not null,
  reason text,
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique(type, value)
);

-- Every avatar/banner upload lands here as 'pending' until staff approve, deny, or ban it.
-- Only 'approved' rows are ever served publicly (see app/a/[...path]/route.ts).
create table if not exists image_moderation (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  kind text not null check (kind in ('avatar', 'banner')),
  object_key text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'denied', 'banned')),
  reason text,
  reviewed_by uuid references users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_image_moderation_status on image_moderation(status);
create index if not exists idx_image_moderation_user_kind on image_moderation(user_id, kind);
create index if not exists idx_image_moderation_object_key on image_moderation(object_key);

-- Tracks which IPs each account has logged in from, so staff can see and
-- blacklist them from the backend panel. Starts populating going forward —
-- there's no way to retroactively know IPs from before this table existed.
create table if not exists user_ips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  ip text not null,
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  unique(user_id, ip)
);

create index if not exists idx_user_ips_user on user_ips(user_id);

-- Donation-gated profile music widget. Eligibility now lives on users.is_donator
-- (see below) rather than being checked against the donations table each time.
alter table users add column if not exists music_object_key text;
alter table users add column if not exists music_enabled boolean not null default false;

-- Cleanup: IP tracking ended up living on user_ips instead (populated by every
-- login/register path). An earlier migration added sessions.ip_address but
-- nothing ever actually wrote to it, so it was permanently null — drop it if
-- present. This also drops idx_sessions_ip, since that index exists only on
-- this column.
alter table sessions drop column if exists ip_address;

-- Donator status. Set automatically by the Stripe webhook on a completed
-- donation, or can be granted/revoked manually by an admin (moderators can't —
-- enforced in app/api/admin/users/[username]/role/route.ts). Backfills anyone
-- who already has a donation on file.
alter table users add column if not exists is_donator boolean not null default false;
update users set is_donator = true where id in (select distinct user_id from donations where user_id is not null);

-- Donator-only custom site theme: a single accent color, or a private
-- background image (never shown to anyone but the owner and staff — see
-- app/a/[...path]/route.ts). 'default' means no override (site neon theme).
alter table users add column if not exists theme_mode text not null default 'default';

do $$
begin
  if exists (select 1 from pg_constraint where conname = 'users_theme_mode_check') then
    alter table users drop constraint users_theme_mode_check;
  end if;
  alter table users add constraint users_theme_mode_check check (theme_mode in ('default', 'color', 'image'));
end $$;

alter table users add column if not exists theme_color text;
alter table users add column if not exists theme_image_key text;

-- Discord account linking (OAuth2, "identify" scope only — no email, no guilds).
-- Shown on the public profile page if connected. One Discord account can only
-- ever be linked to one site account (the partial unique index below).
alter table users add column if not exists discord_id text;
alter table users add column if not exists discord_username text;
alter table users add column if not exists discord_avatar_url text;

create unique index if not exists idx_users_discord_id on users(discord_id) where discord_id is not null;

-- Optional display name for the profile music track, shown instead of the
-- generic "Profile music" label. Purely cosmetic — no validation beyond length.
alter table users add column if not exists music_title text;

-- Admin-only full-page background video for a profile. Silent by design —
-- the app always renders it muted regardless of the source file, and the
-- settings UI only exposes this section to role = 'admin'.
alter table users add column if not exists video_object_key text;
alter table users add column if not exists video_enabled boolean not null default false;
