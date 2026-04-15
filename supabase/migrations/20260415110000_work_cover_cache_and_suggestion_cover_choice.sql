create table if not exists public.work_cover_cache (
  id uuid primary key default gen_random_uuid(),
  work_id text not null,
  source text not null check (source in ('openlibrary', 'google')),
  source_cover_key text not null,
  remote_url text not null,
  cached_file_path text,
  cached_public_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists work_cover_cache_work_source_key_unique
  on public.work_cover_cache (work_id, source, source_cover_key);

create index if not exists work_cover_cache_work_idx
  on public.work_cover_cache (work_id);

alter table public.suggestions
  add column if not exists admin_final_cover_selection jsonb;
