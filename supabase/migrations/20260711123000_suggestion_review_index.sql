-- Narrow admin review helper: pending suggestions are loaded newest-first.
create index if not exists suggestions_status_created_at_idx
  on public.suggestions (status, created_at desc);
