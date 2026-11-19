-- Apply only after the app is deployed with insert_follow_with_quota.
drop policy if exists "user_follows_insert_own" on public.user_follows;
drop policy if exists "user_follows_update_own" on public.user_follows;
drop policy if exists "user_follows_delete_own" on public.user_follows;

revoke insert, update, delete on table public.user_follows
  from public, anon, authenticated;
grant select, insert, update, delete on table public.user_follows to service_role;
