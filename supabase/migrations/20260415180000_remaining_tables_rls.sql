alter table public.titles enable row level security;
alter table public.editions enable row level security;
alter table public.title_list_likes enable row level security;
alter table public.user_genre_points enable row level security;
alter table public.user_experience enable row level security;
alter table public.title_sources enable row level security;
alter table public.title_reference_works enable row level security;
alter table public.reference_isbns enable row level security;
alter table public.work_cover_cache enable row level security;
alter table public.suggestions enable row level security;
alter table public.suggestion_work_matches enable row level security;

drop policy if exists "titles_select_public" on public.titles;
create policy "titles_select_public"
on public.titles
for select
to anon, authenticated
using (true);

drop policy if exists "titles_insert_admin" on public.titles;
create policy "titles_insert_admin"
on public.titles
for insert
to authenticated
with check (public.is_current_user_admin());

drop policy if exists "titles_update_admin" on public.titles;
create policy "titles_update_admin"
on public.titles
for update
to authenticated
using (public.is_current_user_admin())
with check (public.is_current_user_admin());

drop policy if exists "titles_delete_admin" on public.titles;
create policy "titles_delete_admin"
on public.titles
for delete
to authenticated
using (public.is_current_user_admin());

drop policy if exists "editions_select_public" on public.editions;
create policy "editions_select_public"
on public.editions
for select
to anon, authenticated
using (true);

drop policy if exists "editions_insert_admin" on public.editions;
create policy "editions_insert_admin"
on public.editions
for insert
to authenticated
with check (public.is_current_user_admin());

drop policy if exists "editions_update_admin" on public.editions;
create policy "editions_update_admin"
on public.editions
for update
to authenticated
using (public.is_current_user_admin())
with check (public.is_current_user_admin());

drop policy if exists "editions_delete_admin" on public.editions;
create policy "editions_delete_admin"
on public.editions
for delete
to authenticated
using (public.is_current_user_admin());

drop policy if exists "title_list_likes_select_visible" on public.title_list_likes;
create policy "title_list_likes_select_visible"
on public.title_list_likes
for select
to anon, authenticated
using (
	public.is_current_user_admin()
	or exists (
		select 1
		from public.title_lists l
		where l.id = title_list_likes.list_id
			and (
				l.is_public = true
				or l.user_profile_id = public.current_profile_id()
			)
	)
);

drop policy if exists "title_list_likes_insert_own" on public.title_list_likes;
create policy "title_list_likes_insert_own"
on public.title_list_likes
for insert
to authenticated
with check (
	public.is_current_user_admin()
	or (
		user_profile_id = public.current_profile_id()
		and exists (
			select 1
			from public.title_lists l
			where l.id = title_list_likes.list_id
				and (
					l.is_public = true
					or l.user_profile_id = public.current_profile_id()
				)
		)
	)
);

drop policy if exists "title_list_likes_delete_own" on public.title_list_likes;
create policy "title_list_likes_delete_own"
on public.title_list_likes
for delete
to authenticated
using (
	public.is_current_user_admin()
	or user_profile_id = public.current_profile_id()
);

drop policy if exists "user_genre_points_select_public" on public.user_genre_points;
create policy "user_genre_points_select_public"
on public.user_genre_points
for select
to anon, authenticated
using (true);

drop policy if exists "user_genre_points_insert_own" on public.user_genre_points;
create policy "user_genre_points_insert_own"
on public.user_genre_points
for insert
to authenticated
with check (
	public.is_current_user_admin()
	or user_profile_id = public.current_profile_id()
);

drop policy if exists "user_genre_points_update_admin" on public.user_genre_points;
create policy "user_genre_points_update_admin"
on public.user_genre_points
for update
to authenticated
using (public.is_current_user_admin())
with check (public.is_current_user_admin());

drop policy if exists "user_genre_points_delete_admin" on public.user_genre_points;
create policy "user_genre_points_delete_admin"
on public.user_genre_points
for delete
to authenticated
using (public.is_current_user_admin());

drop policy if exists "user_experience_select_self" on public.user_experience;
create policy "user_experience_select_self"
on public.user_experience
for select
to authenticated
using (
	public.is_current_user_admin()
	or user_profile_id = public.current_profile_id()
);

drop policy if exists "user_experience_insert_self" on public.user_experience;
create policy "user_experience_insert_self"
on public.user_experience
for insert
to authenticated
with check (
	public.is_current_user_admin()
	or user_profile_id = public.current_profile_id()
);

drop policy if exists "user_experience_update_self" on public.user_experience;
create policy "user_experience_update_self"
on public.user_experience
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

drop policy if exists "user_experience_delete_self" on public.user_experience;
create policy "user_experience_delete_self"
on public.user_experience
for delete
to authenticated
using (
	public.is_current_user_admin()
	or user_profile_id = public.current_profile_id()
);

drop policy if exists "title_sources_select_admin" on public.title_sources;
create policy "title_sources_select_admin"
on public.title_sources
for select
to authenticated
using (public.is_current_user_admin());

drop policy if exists "title_sources_insert_admin" on public.title_sources;
create policy "title_sources_insert_admin"
on public.title_sources
for insert
to authenticated
with check (public.is_current_user_admin());

drop policy if exists "title_sources_update_admin" on public.title_sources;
create policy "title_sources_update_admin"
on public.title_sources
for update
to authenticated
using (public.is_current_user_admin())
with check (public.is_current_user_admin());

drop policy if exists "title_sources_delete_admin" on public.title_sources;
create policy "title_sources_delete_admin"
on public.title_sources
for delete
to authenticated
using (public.is_current_user_admin());

drop policy if exists "title_reference_works_select_public" on public.title_reference_works;
create policy "title_reference_works_select_public"
on public.title_reference_works
for select
to anon, authenticated
using (true);

drop policy if exists "title_reference_works_insert_admin" on public.title_reference_works;
create policy "title_reference_works_insert_admin"
on public.title_reference_works
for insert
to authenticated
with check (public.is_current_user_admin());

drop policy if exists "title_reference_works_update_admin" on public.title_reference_works;
create policy "title_reference_works_update_admin"
on public.title_reference_works
for update
to authenticated
using (public.is_current_user_admin())
with check (public.is_current_user_admin());

drop policy if exists "title_reference_works_delete_admin" on public.title_reference_works;
create policy "title_reference_works_delete_admin"
on public.title_reference_works
for delete
to authenticated
using (public.is_current_user_admin());

drop policy if exists "reference_isbns_select_public" on public.reference_isbns;
create policy "reference_isbns_select_public"
on public.reference_isbns
for select
to anon, authenticated
using (true);

drop policy if exists "reference_isbns_insert_admin" on public.reference_isbns;
create policy "reference_isbns_insert_admin"
on public.reference_isbns
for insert
to authenticated
with check (public.is_current_user_admin());

drop policy if exists "reference_isbns_update_admin" on public.reference_isbns;
create policy "reference_isbns_update_admin"
on public.reference_isbns
for update
to authenticated
using (public.is_current_user_admin())
with check (public.is_current_user_admin());

drop policy if exists "reference_isbns_delete_admin" on public.reference_isbns;
create policy "reference_isbns_delete_admin"
on public.reference_isbns
for delete
to authenticated
using (public.is_current_user_admin());

drop policy if exists "work_cover_cache_select_admin" on public.work_cover_cache;
create policy "work_cover_cache_select_admin"
on public.work_cover_cache
for select
to authenticated
using (public.is_current_user_admin());

drop policy if exists "work_cover_cache_insert_admin" on public.work_cover_cache;
create policy "work_cover_cache_insert_admin"
on public.work_cover_cache
for insert
to authenticated
with check (public.is_current_user_admin());

drop policy if exists "work_cover_cache_update_admin" on public.work_cover_cache;
create policy "work_cover_cache_update_admin"
on public.work_cover_cache
for update
to authenticated
using (public.is_current_user_admin())
with check (public.is_current_user_admin());

drop policy if exists "work_cover_cache_delete_admin" on public.work_cover_cache;
create policy "work_cover_cache_delete_admin"
on public.work_cover_cache
for delete
to authenticated
using (public.is_current_user_admin());

drop policy if exists "Users can create suggestions" on public.suggestions;
drop policy if exists "Admins have full control" on public.suggestions;
drop policy if exists "Admins can update suggestions" on public.suggestions;
drop policy if exists "Admins can delete suggestions" on public.suggestions;
drop policy if exists "Admins have full control (user_roles)" on public.suggestions;
drop policy if exists "Admins can update suggestions (user_roles)" on public.suggestions;
drop policy if exists "Admins can delete suggestions (user_roles)" on public.suggestions;
drop policy if exists "suggestions_select_self_or_admin" on public.suggestions;
create policy "suggestions_select_self_or_admin"
on public.suggestions
for select
to authenticated
using (
	public.is_current_user_admin()
	or suggested_by_profile_id = public.current_profile_id()
);

drop policy if exists "suggestions_insert_own" on public.suggestions;
create policy "suggestions_insert_own"
on public.suggestions
for insert
to authenticated
with check (
	public.is_current_user_admin()
	or suggested_by_profile_id = public.current_profile_id()
);

drop policy if exists "suggestions_update_admin" on public.suggestions;
create policy "suggestions_update_admin"
on public.suggestions
for update
to authenticated
using (public.is_current_user_admin())
with check (public.is_current_user_admin());

drop policy if exists "suggestions_delete_admin" on public.suggestions;
create policy "suggestions_delete_admin"
on public.suggestions
for delete
to authenticated
using (public.is_current_user_admin());

drop policy if exists "Users can create suggestion work matches" on public.suggestion_work_matches;
drop policy if exists "Admins can read suggestion work matches" on public.suggestion_work_matches;
drop policy if exists "Admins can update suggestion work matches" on public.suggestion_work_matches;
drop policy if exists "Admins can delete suggestion work matches" on public.suggestion_work_matches;
drop policy if exists "suggestion_work_matches_select_self_or_admin" on public.suggestion_work_matches;
create policy "suggestion_work_matches_select_self_or_admin"
on public.suggestion_work_matches
for select
to authenticated
using (
	public.is_current_user_admin()
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
	public.is_current_user_admin()
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
using (public.is_current_user_admin())
with check (public.is_current_user_admin());

drop policy if exists "suggestion_work_matches_delete_admin" on public.suggestion_work_matches;
create policy "suggestion_work_matches_delete_admin"
on public.suggestion_work_matches
for delete
to authenticated
using (public.is_current_user_admin());
