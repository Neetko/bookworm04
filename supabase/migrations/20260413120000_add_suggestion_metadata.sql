-- Add algorithm metadata and work snapshots to suggestions

alter table public.suggestions
  add column if not exists algorithm_suggested_genres text[],
  add column if not exists suggested_primary_work_snapshot jsonb,
  add column if not exists suggested_dupe_work_snapshots jsonb;
