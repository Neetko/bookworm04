-- Keep ingest previews available across Vercel instances for a short window.
create table if not exists public.google_ingest_previews (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.user_profiles(id) on delete cascade,
  volume_id text not null,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz
);

create index if not exists google_ingest_previews_profile_expiry_idx
  on public.google_ingest_previews (profile_id, expires_at);

alter table public.google_ingest_previews enable row level security;

drop policy if exists "google_ingest_previews_select_own" on public.google_ingest_previews;
create policy "google_ingest_previews_select_own"
on public.google_ingest_previews
for select
to authenticated
using (profile_id = public.current_profile_id());

drop policy if exists "google_ingest_previews_insert_own" on public.google_ingest_previews;
create policy "google_ingest_previews_insert_own"
on public.google_ingest_previews
for insert
to authenticated
with check (profile_id = public.current_profile_id());

drop policy if exists "google_ingest_previews_update_own" on public.google_ingest_previews;
create policy "google_ingest_previews_update_own"
on public.google_ingest_previews
for update
to authenticated
using (profile_id = public.current_profile_id())
with check (profile_id = public.current_profile_id());

drop policy if exists "google_ingest_previews_delete_own" on public.google_ingest_previews;
create policy "google_ingest_previews_delete_own"
on public.google_ingest_previews
for delete
to authenticated
using (profile_id = public.current_profile_id());
