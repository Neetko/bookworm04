-- Additive. Apply before deploying the server-side avatar upload actions.
create table if not exists public.avatar_upload_quota (
  profile_id uuid not null references public.user_profiles(id) on delete cascade,
  window_start timestamptz not null,
  attempts integer not null check (attempts > 0),
  primary key (profile_id, window_start)
);

alter table public.avatar_upload_quota enable row level security;
revoke all on public.avatar_upload_quota from public, anon, authenticated;
grant select, insert, update, delete on public.avatar_upload_quota to service_role;

create or replace function public.consume_avatar_upload_quota(p_profile_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  accepted boolean;
begin
  insert into public.avatar_upload_quota (profile_id, window_start, attempts)
  values (p_profile_id, date_trunc('day', now()), 1)
  on conflict (profile_id, window_start) do update
    set attempts = public.avatar_upload_quota.attempts + 1
    where public.avatar_upload_quota.attempts < 12
  returning true into accepted;

  return coalesce(accepted, false);
end;
$$;

revoke all on function public.consume_avatar_upload_quota(uuid) from public, anon, authenticated;
grant execute on function public.consume_avatar_upload_quota(uuid) to service_role;
