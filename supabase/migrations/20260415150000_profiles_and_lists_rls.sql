create or replace view public.public_profiles as
select
  id,
  username,
  avatar_url,
  bio,
  role,
  created_at,
  updated_at
from public.user_profiles;

grant select on public.public_profiles to anon, authenticated;

alter table public.user_profiles enable row level security;
alter table public.title_lists enable row level security;
alter table public.title_list_items enable row level security;

drop policy if exists "user_profiles_select_self" on public.user_profiles;
create policy "user_profiles_select_self"
on public.user_profiles
for select
to authenticated
using (
  public.is_current_user_admin()
  or id = public.current_profile_id()
  or auth_user_id = auth.uid()
);

drop policy if exists "user_profiles_insert_self" on public.user_profiles;
create policy "user_profiles_insert_self"
on public.user_profiles
for insert
to authenticated
with check (
  public.is_current_user_admin()
  or auth_user_id = auth.uid()
);

drop policy if exists "user_profiles_update_self" on public.user_profiles;
create policy "user_profiles_update_self"
on public.user_profiles
for update
to authenticated
using (
  public.is_current_user_admin()
  or id = public.current_profile_id()
  or auth_user_id = auth.uid()
)
with check (
  public.is_current_user_admin()
  or auth_user_id = auth.uid()
);

drop policy if exists "title_lists_select_visible" on public.title_lists;
create policy "title_lists_select_visible"
on public.title_lists
for select
to authenticated, anon
using (
  public.is_current_user_admin()
  or is_public = true
  or user_profile_id = public.current_profile_id()
);

drop policy if exists "title_lists_insert_own" on public.title_lists;
create policy "title_lists_insert_own"
on public.title_lists
for insert
to authenticated
with check (
  public.is_current_user_admin()
  or user_profile_id = public.current_profile_id()
);

drop policy if exists "title_lists_update_own" on public.title_lists;
create policy "title_lists_update_own"
on public.title_lists
for update
to authenticated
using (
  public.is_current_user_admin()
  or user_profile_id = public.current_profile_id()
)
with check (
  public.is_current_user_admin()
  or user_profile_id = public.current_profile_id()
);

drop policy if exists "title_lists_delete_own" on public.title_lists;
create policy "title_lists_delete_own"
on public.title_lists
for delete
to authenticated
using (
  public.is_current_user_admin()
  or user_profile_id = public.current_profile_id()
);

drop policy if exists "title_list_items_select_visible" on public.title_list_items;
create policy "title_list_items_select_visible"
on public.title_list_items
for select
to authenticated, anon
using (
  public.is_current_user_admin()
  or exists (
    select 1
    from public.title_lists l
    where l.id = title_list_items.list_id
      and (
        l.is_public = true
        or l.user_profile_id = public.current_profile_id()
      )
  )
);

drop policy if exists "title_list_items_insert_own" on public.title_list_items;
create policy "title_list_items_insert_own"
on public.title_list_items
for insert
to authenticated
with check (
  public.is_current_user_admin()
  or exists (
    select 1
    from public.title_lists l
    where l.id = title_list_items.list_id
      and l.user_profile_id = public.current_profile_id()
  )
);

drop policy if exists "title_list_items_update_own" on public.title_list_items;
create policy "title_list_items_update_own"
on public.title_list_items
for update
to authenticated
using (
  public.is_current_user_admin()
  or exists (
    select 1
    from public.title_lists l
    where l.id = title_list_items.list_id
      and l.user_profile_id = public.current_profile_id()
  )
)
with check (
  public.is_current_user_admin()
  or exists (
    select 1
    from public.title_lists l
    where l.id = title_list_items.list_id
      and l.user_profile_id = public.current_profile_id()
  )
);

drop policy if exists "title_list_items_delete_own" on public.title_list_items;
create policy "title_list_items_delete_own"
on public.title_list_items
for delete
to authenticated
using (
  public.is_current_user_admin()
  or exists (
    select 1
    from public.title_lists l
    where l.id = title_list_items.list_id
      and l.user_profile_id = public.current_profile_id()
  )
);
