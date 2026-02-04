alter table if exists public.club_reading_items
add column if not exists title_id uuid references public.titles(id) on delete set null;
