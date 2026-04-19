insert into public.user_roles (user_id, role)
select
  auth_user_id,
  case
    when lower(coalesce(role, '')) = 'admin' then 'admin'::public.app_role
    when lower(coalesce(role, '')) = 'moderator' then 'moderator'::public.app_role
    else 'user'::public.app_role
  end
from public.user_profiles
where auth_user_id is not null
  and lower(coalesce(role, '')) in ('admin', 'moderator')
on conflict (user_id) do update
set role = excluded.role;

create or replace function public.is_current_user_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1
    from public.user_roles
    where user_id = auth.uid()
      and role = 'admin'
  )
$$;

create or replace function public.is_current_user_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1
    from public.user_roles
    where user_id = auth.uid()
      and role in ('admin', 'moderator')
  )
$$;

revoke all on function public.is_current_user_admin() from public;
grant execute on function public.is_current_user_admin() to authenticated;

revoke all on function public.is_current_user_staff() from public;
grant execute on function public.is_current_user_staff() to authenticated;

drop policy if exists "suggestions_select_self_or_admin" on public.suggestions;
create policy "suggestions_select_self_or_admin"
on public.suggestions
for select
to authenticated
using (
	public.is_current_user_staff()
	or suggested_by_profile_id = public.current_profile_id()
);

drop policy if exists "suggestions_insert_own" on public.suggestions;
create policy "suggestions_insert_own"
on public.suggestions
for insert
to authenticated
with check (
	public.is_current_user_staff()
	or suggested_by_profile_id = public.current_profile_id()
);

drop policy if exists "suggestions_update_admin" on public.suggestions;
create policy "suggestions_update_admin"
on public.suggestions
for update
to authenticated
using (public.is_current_user_staff())
with check (public.is_current_user_staff());

drop policy if exists "suggestions_delete_admin" on public.suggestions;
create policy "suggestions_delete_admin"
on public.suggestions
for delete
to authenticated
using (public.is_current_user_staff());

drop policy if exists "suggestion_work_matches_select_self_or_admin" on public.suggestion_work_matches;
create policy "suggestion_work_matches_select_self_or_admin"
on public.suggestion_work_matches
for select
to authenticated
using (
	public.is_current_user_staff()
	or exists (
		select 1
		from public.suggestions s
		where s.id = suggestion_work_matches.suggestion_id
			and s.suggested_by_profile_id = public.current_profile_id()
	)
);

drop policy if exists "suggestion_work_matches_insert_own" on public.suggestion_work_matches;
create policy "suggestion_work_matches_insert_own"
on public.suggestion_work_matches
for insert
to authenticated
with check (
	public.is_current_user_staff()
	or exists (
		select 1
		from public.suggestions s
		where s.id = suggestion_work_matches.suggestion_id
			and s.suggested_by_profile_id = public.current_profile_id()
	)
);

drop policy if exists "suggestion_work_matches_update_admin" on public.suggestion_work_matches;
create policy "suggestion_work_matches_update_admin"
on public.suggestion_work_matches
for update
to authenticated
using (public.is_current_user_staff())
with check (public.is_current_user_staff());

drop policy if exists "suggestion_work_matches_delete_admin" on public.suggestion_work_matches;
create policy "suggestion_work_matches_delete_admin"
on public.suggestion_work_matches
for delete
to authenticated
using (public.is_current_user_staff());