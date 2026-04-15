create or replace function public.can_manage_club_avatar_object(object_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select (
    object_name like 'clubs/%'
    and split_part(object_name, '/', 2) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    and public.can_manage_club(split_part(object_name, '/', 2)::uuid)
  )
$$;

revoke all on function public.can_manage_club_avatar_object(text) from public;
grant execute on function public.can_manage_club_avatar_object(text) to authenticated;

drop policy if exists "Auth write club-avatars" on storage.objects;
drop policy if exists "Auth update club-avatars" on storage.objects;
drop policy if exists "Auth delete club-avatars" on storage.objects;
drop policy if exists "Auth write book-covers" on storage.objects;
drop policy if exists "Auth update book-covers" on storage.objects;
drop policy if exists "Auth delete book-covers" on storage.objects;

create policy "Club owners write club-avatars"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'club-avatars'
  and public.can_manage_club_avatar_object(name)
);

create policy "Club owners update club-avatars"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'club-avatars'
  and public.can_manage_club_avatar_object(name)
)
with check (
  bucket_id = 'club-avatars'
  and public.can_manage_club_avatar_object(name)
);

create policy "Club owners delete club-avatars"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'club-avatars'
  and public.can_manage_club_avatar_object(name)
);

create policy "Admins write book-covers"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'book-covers'
  and public.is_current_user_admin()
);

create policy "Admins update book-covers"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'book-covers'
  and public.is_current_user_admin()
)
with check (
  bucket_id = 'book-covers'
  and public.is_current_user_admin()
);

create policy "Admins delete book-covers"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'book-covers'
  and public.is_current_user_admin()
);
