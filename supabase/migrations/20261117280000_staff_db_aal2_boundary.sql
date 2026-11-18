-- RLS policies delegate staff privileges to these functions. Require an
-- authenticator-verified session there too, so direct PostgREST and Storage
-- requests cannot bypass the application gate with an AAL1 staff session.
-- The self-select policy on user_roles remains available at AAL1 so the app
-- can identify staff and offer authenticator enrollment.
create or replace function public.is_current_user_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
    and exists (
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
set search_path = ''
as $$
  select coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
    and exists (
      select 1
      from public.user_roles
      where user_id = auth.uid()
        and role in ('admin', 'moderator')
    )
$$;
