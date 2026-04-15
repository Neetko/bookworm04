alter table public.suggestions
  add column if not exists suggested_selected_work_ids text[],
  add column if not exists suggested_selected_work_snapshots jsonb,
  add column if not exists admin_final_selected_work_ids text[],
  add column if not exists admin_final_selected_work_snapshots jsonb;

update public.suggestions
set
  suggested_selected_work_ids = case
    when suggested_selected_work_ids is not null then suggested_selected_work_ids
    else (
      select array_agg(value order by ordinality)
      from (
        select distinct on (value) value, ordinality
        from unnest(
          array_remove(
            array_cat(
              array[nullif(btrim(suggested_primary_work_id), '')],
              coalesce(suggested_dupe_work_ids, '{}'::text[])
            ),
            null
          )
        ) with ordinality as entries(value, ordinality)
        where value is not null and btrim(value) <> ''
        order by value, ordinality
      ) deduped
    )
  end,
  suggested_selected_work_snapshots = case
    when suggested_selected_work_snapshots is not null then suggested_selected_work_snapshots
    when suggested_primary_work_snapshot is null and suggested_dupe_work_snapshots is null then null
    when suggested_primary_work_snapshot is null then coalesce(suggested_dupe_work_snapshots, '[]'::jsonb)
    when suggested_dupe_work_snapshots is null then jsonb_build_array(suggested_primary_work_snapshot)
    else jsonb_build_array(suggested_primary_work_snapshot) || suggested_dupe_work_snapshots
  end,
  admin_final_selected_work_ids = case
    when admin_final_selected_work_ids is not null then admin_final_selected_work_ids
    else (
      select array_agg(value order by ordinality)
      from (
        select distinct on (value) value, ordinality
        from unnest(
          array_remove(
            array_cat(
              array[nullif(btrim(admin_final_primary_work_id), '')],
              coalesce(admin_final_dupe_work_ids, '{}'::text[])
            ),
            null
          )
        ) with ordinality as entries(value, ordinality)
        where value is not null and btrim(value) <> ''
        order by value, ordinality
      ) deduped
    )
  end,
  admin_final_selected_work_snapshots = case
    when admin_final_selected_work_snapshots is not null then admin_final_selected_work_snapshots
    when admin_final_primary_work_snapshot is null and admin_final_dupe_work_snapshots is null then null
    when admin_final_primary_work_snapshot is null then coalesce(admin_final_dupe_work_snapshots, '[]'::jsonb)
    when admin_final_dupe_work_snapshots is null then jsonb_build_array(admin_final_primary_work_snapshot)
    else jsonb_build_array(admin_final_primary_work_snapshot) || admin_final_dupe_work_snapshots
  end;

create or replace function public.handle_suggestion_approval()
returns trigger as $$
begin
  if new.status = 'approved' and old.status = 'pending' then
    update public.titles
    set
      genre = coalesce(new.admin_final_genres, genre),
      updated_at = now()
    where id = new.title_id;
  end if;
  return new;
end;
$$ language plpgsql;

alter table public.suggestions
  drop column if exists suggested_primary_work_id,
  drop column if exists suggested_dupe_work_ids,
  drop column if exists suggested_primary_work_snapshot,
  drop column if exists suggested_dupe_work_snapshots,
  drop column if exists admin_final_primary_work_id,
  drop column if exists admin_final_dupe_work_ids,
  drop column if exists admin_final_primary_work_snapshot,
  drop column if exists admin_final_dupe_work_snapshots;
