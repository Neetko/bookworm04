alter table if exists public.clubs
add column if not exists categories text[];
