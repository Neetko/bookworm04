-- Apply after the server-side reward writer is deployed. Browser clients must
-- not choose their own score, source, or experience level through PostgREST.
drop policy if exists "user_genre_points_insert_own" on public.user_genre_points;
drop policy if exists "user_genre_points_update_admin" on public.user_genre_points;
drop policy if exists "user_genre_points_delete_admin" on public.user_genre_points;
revoke insert, update, delete on table public.user_genre_points from public, anon, authenticated;
grant insert, update, delete on table public.user_genre_points to service_role;

-- No current application flow writes this legacy table. Keep existing reads,
-- while preventing callers from setting their own level and experience.
drop policy if exists "user_experience_insert_self" on public.user_experience;
drop policy if exists "user_experience_update_self" on public.user_experience;
drop policy if exists "user_experience_delete_self" on public.user_experience;
revoke insert, update, delete on table public.user_experience from public, anon, authenticated;
grant insert, update, delete on table public.user_experience to service_role;
