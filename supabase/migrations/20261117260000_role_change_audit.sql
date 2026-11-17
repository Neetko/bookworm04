-- Additive. Install before deploying the role-management action that calls this RPC.
-- The actor is rechecked in the database, and the audit insert is atomic with
-- the protected role and public label updates.
create table public.role_change_audit (
  id uuid primary key default gen_random_uuid(),
  actor_auth_user_id uuid not null,
  target_auth_user_id uuid not null,
  old_role public.app_role not null,
  new_role public.app_role not null,
  changed_at timestamptz not null default now(),
  constraint role_change_audit_changed check (old_role <> new_role)
);

create index role_change_audit_target_time_idx
on public.role_change_audit (target_auth_user_id, changed_at desc);

alter table public.role_change_audit enable row level security;
revoke all on table public.role_change_audit from public, anon, authenticated, service_role;
grant select, insert on table public.role_change_audit to service_role;

create function public.change_moderator_role(
  p_actor_auth_user_id uuid,
  p_target_auth_user_id uuid,
  p_make_moderator boolean
)
returns table (old_role public.app_role, new_role public.app_role, changed boolean)
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_actor_role public.app_role;
  v_target_profile_id uuid;
  v_old_role public.app_role;
  v_new_role public.app_role;
begin
  if p_actor_auth_user_id is null or p_target_auth_user_id is null or p_make_moderator is null then
    raise exception 'Invalid role change input';
  end if;

  select role into v_actor_role
  from public.user_roles
  where user_id = p_actor_auth_user_id;
  if v_actor_role is distinct from 'admin'::public.app_role then
    raise exception 'Admin access required';
  end if;

  -- Serializes role changes for the same target, including first-time grants.
  select id into v_target_profile_id
  from public.user_profiles
  where auth_user_id = p_target_auth_user_id
  for update;
  if v_target_profile_id is null then
    raise exception 'Target user profile not found';
  end if;

  select coalesce(role, 'user'::public.app_role) into v_old_role
  from public.user_roles
  where user_id = p_target_auth_user_id
  for update;
  v_old_role := coalesce(v_old_role, 'user'::public.app_role);

  if v_old_role = 'admin'::public.app_role then
    raise exception 'Admin accounts are managed separately';
  end if;

  v_new_role := case when p_make_moderator then 'moderator'::public.app_role else 'user'::public.app_role end;
  if v_old_role = v_new_role then
    return query select v_old_role, v_new_role, false;
    return;
  end if;

  insert into public.user_roles (user_id, role)
  values (p_target_auth_user_id, v_new_role)
  on conflict (user_id) do update set role = excluded.role;

  update public.user_profiles
  set role = case when p_make_moderator then 'moderator' else 'reader' end
  where id = v_target_profile_id;

  insert into public.role_change_audit (
    actor_auth_user_id, target_auth_user_id, old_role, new_role
  ) values (
    p_actor_auth_user_id, p_target_auth_user_id, v_old_role, v_new_role
  );

  return query select v_old_role, v_new_role, true;
end;
$$;

revoke all on function public.change_moderator_role(uuid, uuid, boolean) from public, anon, authenticated;
grant execute on function public.change_moderator_role(uuid, uuid, boolean) to service_role;
