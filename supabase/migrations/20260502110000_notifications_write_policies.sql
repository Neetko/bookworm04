drop policy if exists "notifications_insert_actor" on public.notifications;
create policy "notifications_insert_actor"
on public.notifications
for insert
to authenticated
with check (
  public.is_current_user_admin()
  or actor_profile_id = public.current_profile_id()
);

drop policy if exists "notifications_update_recipient" on public.notifications;
create policy "notifications_update_recipient"
on public.notifications
for update
to authenticated
using (
  public.is_current_user_admin()
  or recipient_profile_id = public.current_profile_id()
)
with check (
  public.is_current_user_admin()
  or recipient_profile_id = public.current_profile_id()
);
