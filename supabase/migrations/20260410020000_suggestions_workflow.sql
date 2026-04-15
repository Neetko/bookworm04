-- Suggestion workflow, RBAC, and admin-only approvals

-- Roles (admin/user only)
do $$
begin
  if not exists (select 1 from pg_type where typname = 'app_role') then
    create type public.app_role as enum ('admin', 'user');
  end if;
end $$;

create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  role public.app_role default 'user',
  unique (user_id)
);

create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb language plpgsql stable as $$
  declare
    claims jsonb;
    user_role public.app_role;
  begin
    select role into user_role from public.user_roles where user_id = (event->>'user_id')::uuid;
    claims := event->'claims';
    claims := jsonb_set(claims, '{user_role}', to_jsonb(coalesce(user_role, 'user'::public.app_role)));
    event := jsonb_set(event, '{claims}', claims);
    return event;
  end;
$$;

do $$
begin
  if to_regprocedure('auth.set_custom_access_token_hook(text)') is not null then
    perform auth.set_custom_access_token_hook('public.custom_access_token_hook');
  end if;
end $$;

-- Suggestions

do $$
begin
  if not exists (select 1 from pg_type where typname = 'suggestion_status') then
    create type public.suggestion_status as enum ('pending', 'approved', 'dismissed');
  end if;
end $$;

create table if not exists public.suggestions (
  id uuid primary key default gen_random_uuid(),
  title_id uuid not null references public.titles(id) on delete cascade,
  suggested_genres text[],
  suggested_primary_work_id text,
  suggested_dupe_work_ids text[],
  suggested_by_profile_id uuid references public.user_profiles(id) on delete set null,
  status public.suggestion_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.suggestions enable row level security;

drop policy if exists "Users can create suggestions" on public.suggestions;
create policy "Users can create suggestions"
  on public.suggestions for insert
  to authenticated
  with check (true);

drop policy if exists "Admins have full control" on public.suggestions;
create policy "Admins have full control"
  on public.suggestions for select
  to authenticated
  using (
    exists (
      select 1
      from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.role = 'admin'
    )
  );

create policy "Admins can update suggestions"
  on public.suggestions for update
  to authenticated
  using (
    exists (
      select 1
      from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.role = 'admin'
    )
  )
  with check (
    exists (
      select 1
      from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.role = 'admin'
    )
  );

create policy "Admins can delete suggestions"
  on public.suggestions for delete
  to authenticated
  using (
    exists (
      select 1
      from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.role = 'admin'
    )
  );

create or replace function public.handle_suggestion_approval()
returns trigger as $$
begin
  if new.status = 'approved' and old.status = 'pending' then
    update public.titles
    set
      genre = coalesce(new.suggested_genres, genre),
      work_id = coalesce(new.suggested_primary_work_id, work_id),
      dupe_work_ids = coalesce(new.suggested_dupe_work_ids, dupe_work_ids),
      updated_at = now()
    where id = new.title_id;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists on_suggestion_approved on public.suggestions;
create trigger on_suggestion_approved
  after update on public.suggestions
  for each row execute function public.handle_suggestion_approval();
