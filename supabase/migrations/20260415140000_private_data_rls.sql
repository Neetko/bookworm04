create or replace function public.current_profile_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id
  from public.user_profiles
  where auth_user_id = auth.uid()
  limit 1
$$;

create or replace function public.is_current_user_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1
    from public.user_profiles
    where auth_user_id = auth.uid()
      and lower(coalesce(role, '')) = 'admin'
  )
$$;

revoke all on function public.current_profile_id() from public;
grant execute on function public.current_profile_id() to authenticated;

revoke all on function public.is_current_user_admin() from public;
grant execute on function public.is_current_user_admin() to authenticated;

alter table public.messages enable row level security;
alter table public.notifications enable row level security;
alter table public.title_user_progress enable row level security;
alter table public.reading_diary_entries enable row level security;

drop policy if exists "messages_select_own" on public.messages;
create policy "messages_select_own"
on public.messages
for select
to authenticated
using (
  public.is_current_user_admin()
  or (
    sender_profile_id = public.current_profile_id()
    and coalesce(sender_deleted, false) = false
  )
  or (
    recipient_profile_id = public.current_profile_id()
    and coalesce(recipient_deleted, false) = false
  )
);

drop policy if exists "messages_insert_own" on public.messages;
create policy "messages_insert_own"
on public.messages
for insert
to authenticated
with check (
  public.is_current_user_admin()
  or (
    sender_profile_id = public.current_profile_id()
    and status in ('sent', 'draft')
    and coalesce(sender_deleted, false) = false
    and coalesce(recipient_deleted, false) = false
    and (
      (status = 'draft' and coalesce(is_read, false) = true)
      or (
        status = 'sent'
        and coalesce(is_read, false) = false
        and (recipient_profile_id is not null or recipient_username is not null)
      )
    )
  )
);

drop policy if exists "notifications_select_own" on public.notifications;
create policy "notifications_select_own"
on public.notifications
for select
to authenticated
using (
  public.is_current_user_admin()
  or recipient_profile_id = public.current_profile_id()
);

drop policy if exists "title_user_progress_select_own" on public.title_user_progress;
create policy "title_user_progress_select_own"
on public.title_user_progress
for select
to authenticated
using (
  public.is_current_user_admin()
  or user_profile_id = public.current_profile_id()
);

drop policy if exists "title_user_progress_insert_own" on public.title_user_progress;
create policy "title_user_progress_insert_own"
on public.title_user_progress
for insert
to authenticated
with check (
  public.is_current_user_admin()
  or user_profile_id = public.current_profile_id()
);

drop policy if exists "title_user_progress_update_own" on public.title_user_progress;
create policy "title_user_progress_update_own"
on public.title_user_progress
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

drop policy if exists "title_user_progress_delete_own" on public.title_user_progress;
create policy "title_user_progress_delete_own"
on public.title_user_progress
for delete
to authenticated
using (
  public.is_current_user_admin()
  or user_profile_id = public.current_profile_id()
);

drop policy if exists "reading_diary_entries_select_own" on public.reading_diary_entries;
create policy "reading_diary_entries_select_own"
on public.reading_diary_entries
for select
to authenticated
using (
  public.is_current_user_admin()
  or user_profile_id = public.current_profile_id()
);

drop policy if exists "reading_diary_entries_insert_own" on public.reading_diary_entries;
create policy "reading_diary_entries_insert_own"
on public.reading_diary_entries
for insert
to authenticated
with check (
  public.is_current_user_admin()
  or user_profile_id = public.current_profile_id()
);

drop policy if exists "reading_diary_entries_update_own" on public.reading_diary_entries;
create policy "reading_diary_entries_update_own"
on public.reading_diary_entries
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

drop policy if exists "reading_diary_entries_delete_own" on public.reading_diary_entries;
create policy "reading_diary_entries_delete_own"
on public.reading_diary_entries
for delete
to authenticated
using (
  public.is_current_user_admin()
  or user_profile_id = public.current_profile_id()
);
