-- The Auth service is the only caller of this security-definer hook.
-- PostgreSQL grants EXECUTE on new functions to PUBLIC by default, which
-- otherwise exposes this role lookup through the Data API.
revoke execute on function public.custom_access_token_hook(jsonb)
  from public, anon, authenticated;

grant usage on schema public to supabase_auth_admin;
grant execute on function public.custom_access_token_hook(jsonb)
  to supabase_auth_admin;
