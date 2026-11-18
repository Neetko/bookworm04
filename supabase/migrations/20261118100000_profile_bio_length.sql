-- Existing profile text is left untouched. PostgreSQL enforces the bound on
-- new writes; validate the constraint after checking any older long bios.
alter table public.user_profiles
  add constraint user_profiles_bio_length_check
  check (bio is null or char_length(bio) <= 2000)
  not valid;
