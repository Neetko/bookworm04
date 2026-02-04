-- Track Reading: external source mapping + progress fields

create table if not exists public.external_books (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  external_id text not null,
  book_id uuid not null references public.books(id) on delete cascade,
  created_at timestamptz not null default now()
);

create unique index if not exists external_books_source_external_id_unique
  on public.external_books(source, external_id);

alter table public.user_progress
  add column if not exists total_pages integer,
  add column if not exists minutes_listened integer,
  add column if not exists total_minutes integer,
  add column if not exists progress_percent integer;
