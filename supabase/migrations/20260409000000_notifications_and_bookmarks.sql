create table if not exists "review_likes" (
  "id" uuid primary key default gen_random_uuid(),
  "review_id" uuid not null references "reviews"("id") on delete cascade,
  "user_id" uuid not null references "user_profiles"("id") on delete cascade,
  "created_at" timestamp with time zone default now()
);

create unique index if not exists "review_likes_user_review_unique" on "review_likes" ("user_id", "review_id");

create table if not exists "title_bookmarks" (
  "id" uuid primary key default gen_random_uuid(),
  "user_profile_id" uuid not null references "user_profiles"("id") on delete cascade,
  "title_id" uuid not null references "titles"("id") on delete cascade,
  "created_at" timestamp with time zone default now()
);

create unique index if not exists "title_bookmarks_user_title_unique" on "title_bookmarks" ("user_profile_id", "title_id");
create index if not exists "title_bookmarks_user_idx" on "title_bookmarks" ("user_profile_id");
create index if not exists "title_bookmarks_title_idx" on "title_bookmarks" ("title_id");

create table if not exists "notifications" (
  "id" uuid primary key default gen_random_uuid(),
  "recipient_profile_id" uuid not null references "user_profiles"("id") on delete cascade,
  "actor_profile_id" uuid references "user_profiles"("id") on delete set null,
  "title_id" uuid references "titles"("id") on delete set null,
  "post_id" uuid references "discussion_posts"("id") on delete set null,
  "review_id" uuid references "reviews"("id") on delete set null,
  "event_type" text not null,
  "metadata" jsonb,
  "is_read" boolean not null default false,
  "created_at" timestamp with time zone default now()
);

create index if not exists "notifications_recipient_idx" on "notifications" ("recipient_profile_id");
create index if not exists "notifications_read_idx" on "notifications" ("is_read");
create index if not exists "notifications_created_idx" on "notifications" ("created_at");

drop table if exists "bookmarks";
