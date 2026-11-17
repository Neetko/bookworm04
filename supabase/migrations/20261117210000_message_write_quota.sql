-- Add the quota before deploying the API change so the existing message path
-- keeps working throughout the rollout.
create table public.message_write_quota (
  profile_id uuid not null references public.user_profiles(id) on delete cascade,
  status text not null check (status in ('sent', 'draft')),
  minute_start timestamptz not null,
  used integer not null check (used >= 0),
  primary key (profile_id, status, minute_start)
);

alter table public.message_write_quota enable row level security;
revoke all on table public.message_write_quota from public, anon, authenticated;
grant select, insert, update, delete on table public.message_write_quota to service_role;

create function public.consume_message_write_quota(p_profile_id uuid, p_status text)
returns boolean
language plpgsql
security invoker
set search_path = public
as $$
declare
  allowed boolean;
  per_minute_limit integer;
begin
  if p_profile_id is null or p_status not in ('sent', 'draft') then
    return false;
  end if;

  per_minute_limit := case p_status when 'sent' then 10 else 30 end;

  insert into public.message_write_quota (profile_id, status, minute_start, used)
  values (p_profile_id, p_status, date_trunc('minute', now()), 1)
  on conflict (profile_id, status, minute_start)
  do update set used = public.message_write_quota.used + 1
  where public.message_write_quota.used < per_minute_limit
  returning true into allowed;

  return coalesce(allowed, false);
end;
$$;

revoke all on function public.consume_message_write_quota(uuid, text) from public, anon, authenticated;
grant execute on function public.consume_message_write_quota(uuid, text) to service_role;
