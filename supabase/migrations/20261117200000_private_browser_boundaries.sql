-- Browser sessions, including admin sessions, only see their own private data.
-- Server-side staff workflows use the service role after an application-level
-- authorization check; they do not need blanket RLS exceptions in user JWTs.

drop policy if exists "messages_select_own" on public.messages;
create policy "messages_select_own"
on public.messages
for select
to authenticated
using (
  (
    sender_profile_id = public.current_profile_id()
    and coalesce(sender_deleted, false) = false
  )
  or (
    recipient_profile_id = public.current_profile_id()
    and status = 'sent'
    and coalesce(recipient_deleted, false) = false
  )
);

-- A draft with a selected recipient remains private to its sender. Admin
-- sessions must not be able to spoof another sender through direct REST writes.
drop policy if exists "messages_insert_own" on public.messages;
create policy "messages_insert_own"
on public.messages
for insert
to authenticated
with check (
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
);

drop policy if exists "notifications_select_own" on public.notifications;
create policy "notifications_select_own"
on public.notifications
for select
to authenticated
using (recipient_profile_id = public.current_profile_id());

drop policy if exists "user_profiles_select_self" on public.user_profiles;
create policy "user_profiles_select_self"
on public.user_profiles
for select
to authenticated
using (auth_user_id = auth.uid());

drop policy if exists "user_profiles_insert_self" on public.user_profiles;
create policy "user_profiles_insert_self"
on public.user_profiles
for insert
to authenticated
with check (auth_user_id = auth.uid());

drop policy if exists "user_profiles_update_self" on public.user_profiles;
create policy "user_profiles_update_self"
on public.user_profiles
for update
to authenticated
using (auth_user_id = auth.uid())
with check (auth_user_id = auth.uid());

drop policy if exists "user_roles_select_self" on public.user_roles;
create policy "user_roles_select_self"
on public.user_roles
for select
to authenticated
using (user_id = auth.uid());

-- RLS and SQL privileges both deny role writes from any browser session.
drop policy if exists "user_roles_insert_admin" on public.user_roles;
drop policy if exists "user_roles_update_admin" on public.user_roles;
drop policy if exists "user_roles_delete_admin" on public.user_roles;

revoke insert, update, delete on table public.user_roles from public, anon, authenticated;
grant select on table public.user_roles to authenticated;
grant insert, update, delete on table public.user_roles to service_role;
