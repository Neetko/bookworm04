alter table club_reading_items
add column if not exists title_id uuid references titles(id) on delete set null;
