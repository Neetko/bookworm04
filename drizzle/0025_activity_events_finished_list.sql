-- Finished Reading list + backfill from activity events

insert into title_lists (user_profile_id, name, list_type, is_public, is_default)
select up.id, 'Finished Reading', 'finished-reading', false, true
from user_profiles up
on conflict (user_profile_id, list_type) do nothing;

insert into title_list_items (list_id, title_id, created_at)
select tl.id, ae.title_id, ae.created_at
from activity_events ae
join title_lists tl
  on tl.user_profile_id = ae.user_profile_id
  and tl.list_type = 'finished-reading'
where ae.event_type = 'title_read'
  and ae.title_id is not null
on conflict (list_id, title_id) do nothing;
