update public.user_profiles up
set role = case coalesce(ur.role::text, 'user')
  when 'admin' then 'admin'
  when 'moderator' then 'moderator'
  else 'reader'
end
from public.user_roles ur
where up.auth_user_id = ur.user_id;

update public.user_profiles
set role = 'reader'
where auth_user_id is not null
  and auth_user_id not in (
    select user_id
    from public.user_roles
  );