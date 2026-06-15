-- Fala Certo — European Portuguese learning bot
-- Supabase (Postgres) schema. Run in the Supabase SQL editor or via migration.
--
-- Mirrors the "Data model" section of CLAUDE.md and the row types in
-- src/db/types.ts. Keep all three in sync.

-- gen_random_uuid() lives in pgcrypto (preinstalled on Supabase).
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- users — one row per Telegram user
-- ---------------------------------------------------------------------------
create table if not exists public.users (
  id              uuid primary key default gen_random_uuid(),
  telegram_id     bigint not null unique,
  native_language text not null default 'uk',          -- UI language pack: 'uk' | 'ru'
  level           text not null default 'A1'
                    check (level in ('A1','A2','B1','B2','C1','C2')),  -- CEFR
  voice_id        text,                                -- chosen TTS voice (e.g. pt-PT-RaquelNeural)
  created_at      timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- vocabulary — pt-PT items the bot teaches
-- ---------------------------------------------------------------------------
create table if not exists public.vocabulary (
  id             uuid primary key default gen_random_uuid(),
  word_pt        text not null,
  translation    text not null,
  stress_pattern text,                 -- e.g. 'o-bri-GA-do'
  audio_ref      text,                 -- path/URL to a cached pronunciation clip
  created_at     timestamptz not null default now(),
  unique (word_pt, translation)
);

-- ---------------------------------------------------------------------------
-- progress — spaced-repetition state per (user, item)
-- ---------------------------------------------------------------------------
create table if not exists public.progress (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.users(id) on delete cascade,
  item_id        uuid not null references public.vocabulary(id) on delete cascade,
  status         text not null default 'new'
                   check (status in ('new','learning','review','mastered')),
  ease           real not null default 2.5,   -- SM-2 style ease factor
  next_review_at timestamptz,                 -- when this item is due again
  updated_at     timestamptz not null default now(),
  unique (user_id, item_id)
);

-- Due-items lookup for the SRS scheduler / reminder cron.
create index if not exists progress_due_idx
  on public.progress (next_review_at)
  where next_review_at is not null;

create index if not exists progress_user_idx
  on public.progress (user_id);

-- ---------------------------------------------------------------------------
-- sessions — dialogue/lesson context per user
-- ---------------------------------------------------------------------------
create table if not exists public.sessions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.users(id) on delete cascade,
  mode       text not null
               check (mode in ('words','sentences','conversation')),
  started_at timestamptz not null default now()
);

create index if not exists sessions_user_idx
  on public.sessions (user_id, started_at desc);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
-- The bot connects with the service-role key, which bypasses RLS. We still
-- enable RLS so that nothing is publicly readable if an anon key ever leaks.
-- Add explicit policies before exposing any client-side (anon) access.
alter table public.users      enable row level security;
alter table public.vocabulary enable row level security;
alter table public.progress   enable row level security;
alter table public.sessions   enable row level security;

-- Idempotent column add, so re-running this file also upgrades an existing DB.
alter table public.users add column if not exists voice_id text;

-- Force PostgREST to refresh its schema cache so the new tables are exposed
-- over the REST API immediately (otherwise you may get PGRST205 "table not
-- found in the schema cache" until the cache reloads on its own).
notify pgrst, 'reload schema';
