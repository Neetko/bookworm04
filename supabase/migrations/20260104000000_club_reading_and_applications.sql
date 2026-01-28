-- Adds club reading list items + membership applications

create table if not exists public.club_reading_items (
  id uuid primary key default gen_random_uuid() not null,
  club_id uuid not null,
  book_id uuid,
  title text,
  author text,
  created_at timestamp with time zone default now()
);

alter table public.club_reading_items
  add constraint club_reading_items_club_id_clubs_id_fk
  foreign key (club_id) references public.clubs(id)
  on delete cascade;

alter table public.club_reading_items
  add constraint club_reading_items_book_id_books_id_fk
  foreign key (book_id) references public.books(id)
  on delete set null;

create table if not exists public.club_applications (
  id uuid primary key default gen_random_uuid() not null,
  club_id uuid not null,
  user_id uuid not null,
  status varchar(20) not null default 'pending',
  created_at timestamp with time zone default now()
);

alter table public.club_applications
  add constraint club_applications_club_id_clubs_id_fk
  foreign key (club_id) references public.clubs(id)
  on delete cascade;

alter table public.club_applications
  add constraint club_applications_user_id_user_profiles_id_fk
  foreign key (user_id) references public.user_profiles(id)
  on delete cascade;

create unique index if not exists club_applications_user_club_unique
  on public.club_applications (user_id, club_id);
