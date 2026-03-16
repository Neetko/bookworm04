alter table if exists public.titles
  add column if not exists work_id text,
  add column if not exists isbn_list jsonb;

alter table if exists public.tracked_books
  add column if not exists work_id text,
  add column if not exists isbn_list jsonb;

create table if not exists public.editions (
  id uuid primary key default gen_random_uuid(),
  work_id text not null,
  isbn_10 text,
  isbn_13 text,
  volume_id text,
  format text,
  saleability text,
  raw_google_data jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create unique index if not exists editions_isbn_13_unique on public.editions (isbn_13);
create unique index if not exists editions_isbn_10_unique on public.editions (isbn_10);
create unique index if not exists editions_volume_id_unique on public.editions (volume_id);
create index if not exists editions_work_id_index on public.editions (work_id);
