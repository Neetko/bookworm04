create table if not exists public.title_reference_works (
  id uuid primary key default gen_random_uuid(),
  title_id uuid not null references public.titles(id) on delete cascade,
  work_id text not null,
  source text not null default 'unknown',
  confidence_score integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (title_id, work_id)
);

create index if not exists title_reference_works_title_idx
  on public.title_reference_works (title_id);

create index if not exists title_reference_works_work_idx
  on public.title_reference_works (work_id);

create table if not exists public.reference_isbns (
  id uuid primary key default gen_random_uuid(),
  title_id uuid not null references public.titles(id) on delete cascade,
  work_id text not null,
  isbn text not null,
  source text not null default 'unknown',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (isbn)
);

create index if not exists reference_isbns_title_idx
  on public.reference_isbns (title_id);

create index if not exists reference_isbns_work_idx
  on public.reference_isbns (work_id);
