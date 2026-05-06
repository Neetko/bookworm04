create or replace function public.get_club_member_current_progress(target_club_id uuid)
returns table (
  user_id uuid,
  progress_percent integer,
  current_page integer,
  total_pages integer,
  minutes_listened integer,
  total_minutes integer,
  is_completed boolean
)
language sql
stable
security definer
set search_path = public
as $$
  with authorized as (
    select public.is_club_participant(target_club_id) as allowed
  ),
  club_title as (
    select c.current_title_id
    from public.clubs c
    where c.id = target_club_id
  ),
  member_ids as (
    select c.owner_user_id as user_id
    from public.clubs c
    where c.id = target_club_id

    union

    select m.user_id
    from public.club_members m
    where m.club_id = target_club_id
  ),
  explicit_progress as (
    select
      tup.user_profile_id as user_id,
      tup.progress_percent,
      tup.current_page,
      tup.total_pages,
      tup.minutes_listened,
      tup.total_minutes,
      tup.is_completed
    from public.title_user_progress tup
    join club_title ct on ct.current_title_id = tup.title_id
    join member_ids members on members.user_id = tup.user_profile_id
  ),
  finished_members as (
    select distinct members.user_id
    from member_ids members
    join club_title ct on ct.current_title_id is not null
    join public.title_lists lists
      on lists.user_profile_id = members.user_id
     and lists.list_type = 'finished-reading'
    join public.title_list_items items
      on items.list_id = lists.id
     and items.title_id = ct.current_title_id
    left join explicit_progress progress on progress.user_id = members.user_id
    where progress.user_id is null
  )
  select
    progress.user_id,
    coalesce(progress.progress_percent, 0) as progress_percent,
    progress.current_page,
    progress.total_pages,
    progress.minutes_listened,
    progress.total_minutes,
    coalesce(progress.is_completed, false) as is_completed
  from explicit_progress progress
  cross join authorized authz
  where authz.allowed

  union all

  select
    finished.user_id,
    100 as progress_percent,
    null::integer as current_page,
    null::integer as total_pages,
    null::integer as minutes_listened,
    null::integer as total_minutes,
    true as is_completed
  from finished_members finished
  cross join authorized authz
  where authz.allowed
$$;

revoke all on function public.get_club_member_current_progress(uuid) from public;
grant execute on function public.get_club_member_current_progress(uuid) to authenticated;
