-- Restrictive. Apply only after the server-side avatar upload actions are live.
-- Public bucket delivery remains available; browser Storage writes are removed.
drop policy if exists "User write own user-avatars" on storage.objects;
drop policy if exists "User update own user-avatars" on storage.objects;
drop policy if exists "User delete own user-avatars" on storage.objects;

drop policy if exists "Club owners write club-avatars" on storage.objects;
drop policy if exists "Club owners update club-avatars" on storage.objects;
drop policy if exists "Club owners delete club-avatars" on storage.objects;

drop policy if exists "Admins write book-covers" on storage.objects;
drop policy if exists "Admins update book-covers" on storage.objects;
drop policy if exists "Admins delete book-covers" on storage.objects;
