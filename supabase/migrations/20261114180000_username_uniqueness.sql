-- Username availability checks improve the interface, but the database must be
-- the final authority when two readers choose the same name concurrently.
-- Keep the earliest profile's spelling and deterministically rename later rows
-- before installing case-insensitive, whitespace-insensitive uniqueness.

update public.user_profiles
set username = 'Bookworm-' || replace(id::text, '-', ''),
    updated_at = now()
where username is null
   or btrim(username) = '';

update public.user_profiles
set username = btrim(username),
    updated_at = now()
where username <> btrim(username);

do $$
declare
  duplicate_profile record;
  candidate_base text;
  candidate text;
  attempt integer;
begin
  for duplicate_profile in
    select id, username
    from (
      select
        id,
        username,
        row_number() over (
          partition by lower(btrim(username))
          order by created_at asc nulls last, id asc
        ) as duplicate_rank
      from public.user_profiles
    ) ranked_profiles
    where duplicate_rank > 1
    order by lower(btrim(username)), id
  loop
    candidate_base := left(btrim(duplicate_profile.username), 50);
    candidate := candidate_base || '-' || replace(duplicate_profile.id::text, '-', '');
    attempt := 0;

    while exists (
      select 1
      from public.user_profiles
      where id <> duplicate_profile.id
        and lower(btrim(username)) = lower(candidate)
    ) loop
      attempt := attempt + 1;
      candidate := candidate_base
        || '-'
        || replace(duplicate_profile.id::text, '-', '')
        || '-'
        || attempt::text;
    end loop;

    update public.user_profiles
    set username = candidate,
        updated_at = now()
    where id = duplicate_profile.id;
  end loop;
end
$$;

create unique index user_profiles_username_normalized_unique
  on public.user_profiles ((lower(btrim(username))));
