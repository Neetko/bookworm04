create table if not exists public.club_writer_works (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  author_user_id uuid not null references public.user_profiles(id) on delete cascade,
  title varchar(200) not null,
  content_html text not null default '',
  content_text text not null default '',
  is_public boolean not null default false,
  is_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists club_writer_works_club_idx
  on public.club_writer_works(club_id, updated_at desc);

create index if not exists club_writer_works_author_idx
  on public.club_writer_works(author_user_id, updated_at desc);

create table if not exists public.club_writer_work_likes (
  id uuid primary key default gen_random_uuid(),
  work_id uuid not null references public.club_writer_works(id) on delete cascade,
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create unique index if not exists club_writer_work_likes_user_work_unique
  on public.club_writer_work_likes(user_id, work_id);

create index if not exists club_writer_work_likes_work_idx
  on public.club_writer_work_likes(work_id);

alter table public.club_writer_works enable row level security;
alter table public.club_writer_work_likes enable row level security;

drop policy if exists "club_writer_works_select_visible_or_own" on public.club_writer_works;
create policy "club_writer_works_select_visible_or_own"
on public.club_writer_works
for select
to authenticated
using (
  public.is_current_user_admin()
  or author_user_id = public.current_profile_id()
  or (
    is_public
    and public.is_club_participant(club_id)
  )
);

drop policy if exists "club_writer_works_insert_author" on public.club_writer_works;
create policy "club_writer_works_insert_author"
on public.club_writer_works
for insert
to authenticated
with check (
  public.is_current_user_admin()
  or (
    author_user_id = public.current_profile_id()
    and public.is_club_participant(club_id)
    and exists (
      select 1
      from public.clubs c
      where c.id = club_id
        and c.type = 'writer'
    )
  )
);

drop policy if exists "club_writer_works_update_author" on public.club_writer_works;
create policy "club_writer_works_update_author"
on public.club_writer_works
for update
to authenticated
using (
  public.is_current_user_admin()
  or author_user_id = public.current_profile_id()
)
with check (
  public.is_current_user_admin()
  or (
    author_user_id = public.current_profile_id()
    and exists (
      select 1
      from public.clubs c
      where c.id = club_id
        and c.type = 'writer'
    )
  )
);

drop policy if exists "club_writer_works_delete_author" on public.club_writer_works;
create policy "club_writer_works_delete_author"
on public.club_writer_works
for delete
to authenticated
using (
  public.is_current_user_admin()
  or author_user_id = public.current_profile_id()
);

drop policy if exists "club_writer_work_likes_select_participants" on public.club_writer_work_likes;
create policy "club_writer_work_likes_select_participants"
on public.club_writer_work_likes
for select
to authenticated
using (
  public.is_current_user_admin()
  or exists (
    select 1
    from public.club_writer_works w
    where w.id = work_id
      and (
        w.author_user_id = public.current_profile_id()
        or (w.is_public and public.is_club_participant(w.club_id))
      )
  )
);

drop policy if exists "club_writer_work_likes_insert_own" on public.club_writer_work_likes;
create policy "club_writer_work_likes_insert_own"
on public.club_writer_work_likes
for insert
to authenticated
with check (
  public.is_current_user_admin()
  or (
    user_id = public.current_profile_id()
    and exists (
      select 1
      from public.club_writer_works w
      join public.clubs c on c.id = w.club_id
      where w.id = work_id
        and w.is_public
        and c.type = 'writer'
        and public.is_club_participant(w.club_id)
    )
  )
);

drop policy if exists "club_writer_work_likes_delete_own" on public.club_writer_work_likes;
create policy "club_writer_work_likes_delete_own"
on public.club_writer_work_likes
for delete
to authenticated
using (
  public.is_current_user_admin()
  or user_id = public.current_profile_id()
);
