alter table public.user_profiles
  add column if not exists favorite_genres text[] not null default '{}'::text[];

alter table public.user_profiles
  drop constraint if exists user_profiles_favorite_genres_valid;

alter table public.user_profiles
  add constraint user_profiles_favorite_genres_valid
  check (
    cardinality(favorite_genres) <= 7
    and favorite_genres <@ array[
      'HORROR',
      'ROMANCE',
      'FANTASY',
      'SCI-FI',
      'ADVENTURE',
      'MYSTERY',
      'NON-FICTION'
    ]::text[]
  );
