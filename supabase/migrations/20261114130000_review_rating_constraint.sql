alter table public.reviews
  drop constraint if exists reviews_rating_between_1_and_10;

alter table public.reviews
  add constraint reviews_rating_between_1_and_10
  check (rating between 1 and 10);
