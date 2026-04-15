alter table public.suggestions
  add column if not exists admin_final_genres text[],
  add column if not exists admin_final_primary_work_id text,
  add column if not exists admin_final_dupe_work_ids text[],
  add column if not exists admin_final_primary_work_snapshot jsonb,
  add column if not exists admin_final_dupe_work_snapshots jsonb,
  add column if not exists admin_reviewed_at timestamptz,
  add column if not exists admin_reviewed_by_profile_id uuid references public.user_profiles(id) on delete set null;

create or replace function public.handle_suggestion_approval()
returns trigger as $$
begin
  if new.status = 'approved' and old.status = 'pending' then
    update public.titles
    set
      genre = coalesce(new.admin_final_genres, genre),
      work_id = coalesce(new.admin_final_primary_work_id, work_id),
      dupe_work_ids = coalesce(new.admin_final_dupe_work_ids, dupe_work_ids),
      updated_at = now()
    where id = new.title_id;
  end if;
  return new;
end;
$$ language plpgsql;