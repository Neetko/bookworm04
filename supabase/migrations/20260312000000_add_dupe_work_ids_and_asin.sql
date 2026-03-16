alter table if exists public.titles
  add column if not exists dupe_work_ids jsonb;

alter table if exists public.tracked_books
  add column if not exists dupe_work_ids jsonb;

alter table if exists public.editions
  add column if not exists asin text;
