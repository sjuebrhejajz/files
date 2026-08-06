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
