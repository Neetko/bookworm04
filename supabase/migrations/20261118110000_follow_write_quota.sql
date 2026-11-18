-- Deploy this migration before the app starts using insert_follow_with_quota.
-- A separate migration revokes browser follow writes after the app is live.
create table public.follow_write_quota (
  follower_profile_id uuid not null references public.user_profiles(id) on delete cascade,
  bucket_kind text not null check (bucket_kind in ('hour', 'day')),
  bucket_start timestamptz not null,
  used integer not null check (used >= 0),
  primary key (follower_profile_id, bucket_kind, bucket_start)
);

create table public.follow_notification_cooldown (
  follower_profile_id uuid not null references public.user_profiles(id) on delete cascade,
  followed_profile_id uuid not null references public.user_profiles(id) on delete cascade,
  last_notified_at timestamptz not null,
  primary key (follower_profile_id, followed_profile_id)
);

alter table public.follow_write_quota enable row level security;
alter table public.follow_notification_cooldown enable row level security;
revoke all on table public.follow_write_quota from public, anon, authenticated;
revoke all on table public.follow_notification_cooldown from public, anon, authenticated;
grant select, insert, update, delete on table public.follow_write_quota to service_role;
grant select, insert, update, delete on table public.follow_notification_cooldown to service_role;

create function public.insert_follow_with_quota(
  p_follower_profile_id uuid,
  p_followed_profile_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  inserted_id uuid;
  allowed boolean;
  should_notify boolean;
  bucket record;
  v_now timestamptz := now();
begin
  if p_follower_profile_id is null
    or p_followed_profile_id is null
    or p_follower_profile_id = p_followed_profile_id then
    raise exception 'invalid_follow_target' using errcode = '22023';
  end if;

  insert into public.user_follows (
    follower_profile_id,
    followed_profile_id,
    is_private,
    is_friend
  ) values (
    p_follower_profile_id,
    p_followed_profile_id,
    true,
    false
  )
  on conflict (follower_profile_id, followed_profile_id) do nothing
  returning id into inserted_id;

  if inserted_id is null then
    return jsonb_build_object('inserted', false, 'notify', false);
  end if;

  -- These upserts serialize concurrent requests for the same account and
  -- rollback the new follow if either limit is exhausted.
  for bucket in
    select 'hour'::text as kind, date_trunc('hour', v_now) as starts_at, 15 as maximum
    union all
    select 'day'::text, date_trunc('day', v_now), 50
  loop
    allowed := null;
    insert into public.follow_write_quota (follower_profile_id, bucket_kind, bucket_start, used)
    values (p_follower_profile_id, bucket.kind, bucket.starts_at, 1)
    on conflict (follower_profile_id, bucket_kind, bucket_start)
    do update set used = public.follow_write_quota.used + 1
      where public.follow_write_quota.used < bucket.maximum
    returning true into allowed;

    if not coalesce(allowed, false) then
      raise exception 'follow_quota_exceeded' using errcode = 'P0001';
    end if;
  end loop;

  -- Re-following someone within a day restores the relationship without
  -- sending another followed or friendship notification.
  insert into public.follow_notification_cooldown (
    follower_profile_id,
    followed_profile_id,
    last_notified_at
  ) values (
    p_follower_profile_id,
    p_followed_profile_id,
    v_now
  )
  on conflict (follower_profile_id, followed_profile_id)
  do update set last_notified_at = excluded.last_notified_at
    where public.follow_notification_cooldown.last_notified_at
      <= excluded.last_notified_at - interval '24 hours'
  returning true into should_notify;

  return jsonb_build_object('inserted', true, 'notify', coalesce(should_notify, false));
end;
$$;

revoke all on function public.insert_follow_with_quota(uuid, uuid) from public, anon, authenticated;
grant execute on function public.insert_follow_with_quota(uuid, uuid) to service_role;
