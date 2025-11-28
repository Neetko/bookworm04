-- Supabase production-safe migration (does not create auth.users)
-- Enables gen_random_uuid and creates app tables + auth trigger

create extension if not exists "pgcrypto";

-- Books
create table if not exists public.books (
  id uuid primary key default gen_random_uuid(),
  title varchar(255) not null,
  author varchar(255) not null,
  description text,
  cover_image_url text,
  genre varchar(100),
  published_year integer,
  isbn varchar(20),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- User profiles (FK to auth.users)
create table if not exists public.user_profiles (
  id uuid primary key default gen_random_uuid(),
  username varchar(100),
  email varchar(255),
  avatar_url text,
  bio text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  auth_user_id uuid references auth.users(id) on delete cascade
);
create unique index if not exists user_profiles_auth_user_id_unique
  on public.user_profiles(auth_user_id);

-- Reviews
create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.user_profiles(id) on delete cascade,
  book_id uuid references public.books(id) on delete cascade,
  rating integer not null,
  review_text text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create unique index if not exists reviews_user_book_unique
  on public.reviews(user_id, book_id);

-- Bookmarks
create table if not exists public.bookmarks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.user_profiles(id) on delete cascade,
  book_id uuid references public.books(id) on delete cascade,
  created_at timestamptz default now()
);
create unique index if not exists bookmarks_user_book_unique
  on public.bookmarks(user_id, book_id);

-- Favorites
create table if not exists public.favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.user_profiles(id) on delete cascade,
  book_id uuid references public.books(id) on delete cascade,
  created_at timestamptz default now()
);
create unique index if not exists favorites_user_book_unique
  on public.favorites(user_id, book_id);

-- Auto-provision profile after auth signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.user_profiles (auth_user_id, username, email)
  values (new.id, new.email, new.email)
  on conflict do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
