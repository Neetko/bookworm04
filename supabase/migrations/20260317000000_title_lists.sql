create table if not exists public.title_lists (
  id uuid primary key default gen_random_uuid(),
  user_profile_id uuid not null references public.user_profiles(id) on delete cascade,
  name text not null,
  list_type text not null default 'custom',
  is_public boolean not null default true,
  is_default boolean not null default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create unique index if not exists title_lists_user_type_unique
  on public.title_lists (user_profile_id, list_type);

create table if not exists public.title_list_items (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.title_lists(id) on delete cascade,
  title_id uuid not null references public.titles(id) on delete cascade,
  created_at timestamptz default now()
);

create unique index if not exists title_list_items_list_title_unique
  on public.title_list_items (list_id, title_id);

create table if not exists public.title_list_likes (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.title_lists(id) on delete cascade,
  user_profile_id uuid not null references public.user_profiles(id) on delete cascade,
  created_at timestamptz default now()
);

create unique index if not exists title_list_likes_user_list_unique
  on public.title_list_likes (user_profile_id, list_id);
