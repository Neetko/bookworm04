create or replace function public.can_manage_club(target_club_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select (
    public.is_current_user_admin()
    or exists(
      select 1
      from public.clubs c
      where c.id = target_club_id
        and c.owner_user_id = public.current_profile_id()
    )
  )
$$;

create or replace function public.is_club_participant(target_club_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select (
    public.is_current_user_admin()
    or exists(
      select 1
      from public.clubs c
      where c.id = target_club_id
        and c.owner_user_id = public.current_profile_id()
    )
    or exists(
      select 1
      from public.club_members m
      where m.club_id = target_club_id
        and m.user_id = public.current_profile_id()
    )
  )
$$;

create or replace function public.can_view_activity_for(target_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select (
    public.is_current_user_admin()
    or target_profile_id = public.current_profile_id()
    or exists(
      select 1
      from public.user_follows f
      where f.follower_profile_id = public.current_profile_id()
        and f.followed_profile_id = target_profile_id
    )
  )
$$;

revoke all on function public.can_manage_club(uuid) from public;
grant execute on function public.can_manage_club(uuid) to authenticated;

revoke all on function public.is_club_participant(uuid) from public;
grant execute on function public.is_club_participant(uuid) to authenticated;

revoke all on function public.can_view_activity_for(uuid) from public;
grant execute on function public.can_view_activity_for(uuid) to authenticated;

alter table public.clubs enable row level security;
alter table public.club_members enable row level security;
alter table public.club_reading_items enable row level security;
alter table public.club_reading_comments enable row level security;
alter table public.club_applications enable row level security;
alter table public.activity_events enable row level security;

drop policy if exists "clubs_select_public" on public.clubs;
create policy "clubs_select_public"
on public.clubs
for select
to anon, authenticated
using (true);

drop policy if exists "clubs_insert_own" on public.clubs;
create policy "clubs_insert_own"
on public.clubs
for insert
to authenticated
with check (
  public.is_current_user_admin()
  or owner_user_id = public.current_profile_id()
);

drop policy if exists "clubs_update_own" on public.clubs;
create policy "clubs_update_own"
on public.clubs
for update
to authenticated
using (
  public.is_current_user_admin()
  or owner_user_id = public.current_profile_id()
)
with check (
  public.is_current_user_admin()
  or owner_user_id = public.current_profile_id()
);

drop policy if exists "clubs_delete_own" on public.clubs;
create policy "clubs_delete_own"
on public.clubs
for delete
to authenticated
using (
  public.is_current_user_admin()
  or owner_user_id = public.current_profile_id()
);

drop policy if exists "club_members_select_public" on public.club_members;
create policy "club_members_select_public"
on public.club_members
for select
to anon, authenticated
using (true);

drop policy if exists "club_members_insert_member_or_owner" on public.club_members;
create policy "club_members_insert_member_or_owner"
on public.club_members
for insert
to authenticated
with check (
  public.is_current_user_admin()
  or user_id = public.current_profile_id()
  or public.can_manage_club(club_id)
);

drop policy if exists "club_members_delete_member_or_owner" on public.club_members;
create policy "club_members_delete_member_or_owner"
on public.club_members
for delete
to authenticated
using (
  public.is_current_user_admin()
  or user_id = public.current_profile_id()
  or public.can_manage_club(club_id)
);

drop policy if exists "club_reading_items_select_public" on public.club_reading_items;
create policy "club_reading_items_select_public"
on public.club_reading_items
for select
to anon, authenticated
using (true);

drop policy if exists "club_reading_items_insert_owner" on public.club_reading_items;
create policy "club_reading_items_insert_owner"
on public.club_reading_items
for insert
to authenticated
with check (
  public.is_current_user_admin()
  or public.can_manage_club(club_id)
);

drop policy if exists "club_reading_items_delete_owner" on public.club_reading_items;
create policy "club_reading_items_delete_owner"
on public.club_reading_items
for delete
to authenticated
using (
  public.is_current_user_admin()
  or public.can_manage_club(club_id)
);

drop policy if exists "club_reading_comments_select_public" on public.club_reading_comments;
create policy "club_reading_comments_select_public"
on public.club_reading_comments
for select
to anon, authenticated
using (true);

drop policy if exists "club_reading_comments_insert_participant" on public.club_reading_comments;
create policy "club_reading_comments_insert_participant"
on public.club_reading_comments
for insert
to authenticated
with check (
  public.is_current_user_admin()
  or (
    user_id = public.current_profile_id()
    and public.is_club_participant(club_id)
  )
);

drop policy if exists "club_applications_select_involved" on public.club_applications;
create policy "club_applications_select_involved"
on public.club_applications
for select
to authenticated
using (
  public.is_current_user_admin()
  or user_id = public.current_profile_id()
  or public.can_manage_club(club_id)
);

drop policy if exists "club_applications_insert_own" on public.club_applications;
create policy "club_applications_insert_own"
on public.club_applications
for insert
to authenticated
with check (
  public.is_current_user_admin()
  or user_id = public.current_profile_id()
);

drop policy if exists "club_applications_update_owner" on public.club_applications;
create policy "club_applications_update_owner"
on public.club_applications
for update
to authenticated
using (
  public.is_current_user_admin()
  or public.can_manage_club(club_id)
)
with check (
  public.is_current_user_admin()
  or public.can_manage_club(club_id)
);

drop policy if exists "club_applications_delete_involved" on public.club_applications;
create policy "club_applications_delete_involved"
on public.club_applications
for delete
to authenticated
using (
  public.is_current_user_admin()
  or user_id = public.current_profile_id()
  or public.can_manage_club(club_id)
);

drop policy if exists "activity_events_select_following_or_self" on public.activity_events;
create policy "activity_events_select_following_or_self"
on public.activity_events
for select
to authenticated
using (
  public.is_current_user_admin()
  or public.can_view_activity_for(user_profile_id)
);

drop policy if exists "activity_events_insert_own" on public.activity_events;
create policy "activity_events_insert_own"
on public.activity_events
for insert
to authenticated
with check (
  public.is_current_user_admin()
  or user_profile_id = public.current_profile_id()
);
