create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  claims jsonb;
  user_role public.app_role;
begin
  select role into user_role
  from public.user_roles
  where user_id = (event->>'user_id')::uuid;

  claims := event->'claims';
  claims := jsonb_set(claims, '{user_role}', to_jsonb(coalesce(user_role, 'user'::public.app_role)));
  event := jsonb_set(event, '{claims}', claims);
  return event;
end;
$$;

do $$
begin
  if to_regclass('public.title_reads') is not null then
    execute 'alter table public.title_reads enable row level security';

    execute 'drop policy if exists "title_reads_select_self" on public.title_reads';
    execute $policy$
      create policy "title_reads_select_self"
      on public.title_reads
      for select
      to authenticated
      using (
        public.is_current_user_admin()
        or user_profile_id = public.current_profile_id()
      )
    $policy$;

    execute 'drop policy if exists "title_reads_insert_self" on public.title_reads';
    execute $policy$
      create policy "title_reads_insert_self"
      on public.title_reads
      for insert
      to authenticated
      with check (
        public.is_current_user_admin()
        or user_profile_id = public.current_profile_id()
      )
    $policy$;

    execute 'drop policy if exists "title_reads_update_self" on public.title_reads';
    execute $policy$
      create policy "title_reads_update_self"
      on public.title_reads
      for update
      to authenticated
      using (
        public.is_current_user_admin()
        or user_profile_id = public.current_profile_id()
      )
      with check (
        public.is_current_user_admin()
        or user_profile_id = public.current_profile_id()
      )
    $policy$;

    execute 'drop policy if exists "title_reads_delete_self" on public.title_reads';
    execute $policy$
      create policy "title_reads_delete_self"
      on public.title_reads
      for delete
      to authenticated
      using (
        public.is_current_user_admin()
        or user_profile_id = public.current_profile_id()
      )
    $policy$;
  end if;
end
$$;

do $$
begin
  if to_regclass('public.user_roles') is not null then
    execute 'alter table public.user_roles enable row level security';

    execute 'drop policy if exists "user_roles_select_self" on public.user_roles';
    execute $policy$
      create policy "user_roles_select_self"
      on public.user_roles
      for select
      to authenticated
      using (
        public.is_current_user_admin()
        or user_id = auth.uid()
      )
    $policy$;

    execute 'drop policy if exists "user_roles_insert_admin" on public.user_roles';
    execute $policy$
      create policy "user_roles_insert_admin"
      on public.user_roles
      for insert
      to authenticated
      with check (public.is_current_user_admin())
    $policy$;

    execute 'drop policy if exists "user_roles_update_admin" on public.user_roles';
    execute $policy$
      create policy "user_roles_update_admin"
      on public.user_roles
      for update
      to authenticated
      using (public.is_current_user_admin())
      with check (public.is_current_user_admin())
    $policy$;

    execute 'drop policy if exists "user_roles_delete_admin" on public.user_roles';
    execute $policy$
      create policy "user_roles_delete_admin"
      on public.user_roles
      for delete
      to authenticated
      using (public.is_current_user_admin())
    $policy$;
  end if;
end
$$;
