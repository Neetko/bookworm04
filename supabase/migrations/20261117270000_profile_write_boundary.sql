-- Install after the server-side profile writers are deployed. The Auth trigger
-- creates new profiles, and authenticated application actions use the service
-- client after verifying the user and validating their input.
drop policy if exists "user_profiles_insert_self" on public.user_profiles;
drop policy if exists "user_profiles_update_self" on public.user_profiles;

revoke insert, update, delete on table public.user_profiles from public, anon, authenticated;
grant insert, update, delete on table public.user_profiles to service_role;
