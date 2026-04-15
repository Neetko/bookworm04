do $$
begin
  if not exists (select 1 from pg_type where typname = 'suggestion_match_type') then
    create type public.suggestion_match_type as enum ('exact_auto_dupe', 'bookworm_suggested');
  end if;
end $$;

create table if not exists public.suggestion_work_matches (
  id uuid primary key default gen_random_uuid(),
  suggestion_id uuid not null references public.suggestions(id) on delete cascade,
  work_id text not null,
  match_type public.suggestion_match_type not null,
  confidence_score integer,
  reason text,
  work_snapshot jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (suggestion_id, work_id, match_type)
);

create index if not exists suggestion_work_matches_suggestion_idx
  on public.suggestion_work_matches (suggestion_id);

alter table public.suggestion_work_matches enable row level security;

drop policy if exists "Users can create suggestion work matches" on public.suggestion_work_matches;
create policy "Users can create suggestion work matches"
  on public.suggestion_work_matches for insert
  to authenticated
  with check (true);

drop policy if exists "Admins can read suggestion work matches" on public.suggestion_work_matches;
create policy "Admins can read suggestion work matches"
  on public.suggestion_work_matches for select
  to authenticated
  using (
    exists (
      select 1
      from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.role = 'admin'
    )
  );

drop policy if exists "Admins can update suggestion work matches" on public.suggestion_work_matches;
create policy "Admins can update suggestion work matches"
  on public.suggestion_work_matches for update
  to authenticated
  using (
    exists (
      select 1
      from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.role = 'admin'
    )
  )
  with check (
    exists (
      select 1
      from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.role = 'admin'
    )
  );

drop policy if exists "Admins can delete suggestion work matches" on public.suggestion_work_matches;
create policy "Admins can delete suggestion work matches"
  on public.suggestion_work_matches for delete
  to authenticated
  using (
    exists (
      select 1
      from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.role = 'admin'
    )
  );
