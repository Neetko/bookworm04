with ranked_applications as (
  select
    id,
    row_number() over (
      partition by club_id, user_id
      order by
        case when status = 'pending' then 0 else 1 end,
        created_at desc nulls last,
        reviewed_at desc nulls last,
        id desc
    ) as row_rank
  from public.club_applications
),
duplicate_applications as (
  select id
  from ranked_applications
  where row_rank > 1
)
delete from public.club_applications
where id in (select id from duplicate_applications);

with ranked_invitations as (
  select
    id,
    row_number() over (
      partition by club_id, invitee_user_id
      order by
        case when status = 'pending' then 0 else 1 end,
        created_at desc nulls last,
        responded_at desc nulls last,
        id desc
    ) as row_rank
  from public.club_invitations
),
duplicate_invitations as (
  select id
  from ranked_invitations
  where row_rank > 1
)
delete from public.club_invitations
where id in (select id from duplicate_invitations);

drop index if exists public.club_applications_user_club_unique;
create unique index club_applications_user_club_unique
  on public.club_applications(user_id, club_id);

drop index if exists public.club_invitations_invitee_club_unique;
create unique index club_invitations_invitee_club_unique
  on public.club_invitations(invitee_user_id, club_id);

create or replace function public.generate_placeholder_username()
returns text as $$
declare
  candidate text;
  attempt integer := 0;
begin
  loop
    candidate := 'Bookworm' || lpad((floor(random() * 9000)::int + 1000)::text, 4, '0');

    if not exists (
      select 1
      from public.user_profiles
      where lower(username) = lower(candidate)
    ) then
      return candidate;
    end if;

    attempt := attempt + 1;
    exit when attempt >= 20;
  end loop;

  return 'Bookworm' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);
end;
$$ language plpgsql;

do $$
declare
  target_profile record;
begin
  for target_profile in
    select id
    from public.user_profiles
    where username is null or btrim(username) = ''
  loop
    update public.user_profiles
    set username = public.generate_placeholder_username(),
        updated_at = now()
    where id = target_profile.id;
  end loop;
end
$$;

alter table public.user_profiles
  alter column username set not null;

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.user_profiles (auth_user_id, username, email)
  values (new.id, public.generate_placeholder_username(), new.email)
  on conflict (auth_user_id) do update
    set email = excluded.email;
  return new;
end;
$$ language plpgsql security definer;