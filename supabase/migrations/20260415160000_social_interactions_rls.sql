create or replace function public.has_finished_title(target_title_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1
    from public.title_lists l
    join public.title_list_items i on i.list_id = l.id
    where l.user_profile_id = public.current_profile_id()
      and l.list_type = 'finished-reading'
      and i.title_id = target_title_id
  )
$$;

revoke all on function public.has_finished_title(uuid) from public;
grant execute on function public.has_finished_title(uuid) to authenticated;

alter table public.user_follows enable row level security;
alter table public.reviews enable row level security;
alter table public.review_likes enable row level security;
alter table public.discussion_posts enable row level security;
alter table public.post_likes enable row level security;
alter table public.title_bookmarks enable row level security;

drop policy if exists "user_follows_select_involved" on public.user_follows;
create policy "user_follows_select_involved"
on public.user_follows
for select
to authenticated
using (
  public.is_current_user_admin()
  or follower_profile_id = public.current_profile_id()
  or followed_profile_id = public.current_profile_id()
);

drop policy if exists "user_follows_insert_own" on public.user_follows;
create policy "user_follows_insert_own"
on public.user_follows
for insert
to authenticated
with check (
  public.is_current_user_admin()
  or follower_profile_id = public.current_profile_id()
);

drop policy if exists "user_follows_update_own" on public.user_follows;
create policy "user_follows_update_own"
on public.user_follows
for update
to authenticated
using (
  public.is_current_user_admin()
  or follower_profile_id = public.current_profile_id()
)
with check (
  public.is_current_user_admin()
  or follower_profile_id = public.current_profile_id()
);

drop policy if exists "user_follows_delete_own" on public.user_follows;
create policy "user_follows_delete_own"
on public.user_follows
for delete
to authenticated
using (
  public.is_current_user_admin()
  or follower_profile_id = public.current_profile_id()
);

drop policy if exists "reviews_select_public" on public.reviews;
create policy "reviews_select_public"
on public.reviews
for select
to anon, authenticated
using (true);

drop policy if exists "reviews_insert_own" on public.reviews;
create policy "reviews_insert_own"
on public.reviews
for insert
to authenticated
with check (
  public.is_current_user_admin()
  or (
    user_id = public.current_profile_id()
    and public.has_finished_title(title_id)
  )
);

drop policy if exists "reviews_update_own" on public.reviews;
create policy "reviews_update_own"
on public.reviews
for update
to authenticated
using (
  public.is_current_user_admin()
  or user_id = public.current_profile_id()
)
with check (
  public.is_current_user_admin()
  or (
    user_id = public.current_profile_id()
    and public.has_finished_title(title_id)
  )
);

drop policy if exists "reviews_delete_own" on public.reviews;
create policy "reviews_delete_own"
on public.reviews
for delete
to authenticated
using (
  public.is_current_user_admin()
  or user_id = public.current_profile_id()
);

drop policy if exists "review_likes_select_public" on public.review_likes;
create policy "review_likes_select_public"
on public.review_likes
for select
to anon, authenticated
using (true);

drop policy if exists "review_likes_insert_own" on public.review_likes;
create policy "review_likes_insert_own"
on public.review_likes
for insert
to authenticated
with check (
  public.is_current_user_admin()
  or (
    user_id = public.current_profile_id()
    and exists (
      select 1
      from public.reviews r
      where r.id = review_likes.review_id
    )
  )
);

drop policy if exists "review_likes_delete_own" on public.review_likes;
create policy "review_likes_delete_own"
on public.review_likes
for delete
to authenticated
using (
  public.is_current_user_admin()
  or user_id = public.current_profile_id()
);

drop policy if exists "discussion_posts_select_finished" on public.discussion_posts;
create policy "discussion_posts_select_finished"
on public.discussion_posts
for select
to authenticated
using (
  public.is_current_user_admin()
  or public.has_finished_title(title_id)
);

drop policy if exists "discussion_posts_insert_finished" on public.discussion_posts;
create policy "discussion_posts_insert_finished"
on public.discussion_posts
for insert
to authenticated
with check (
  public.is_current_user_admin()
  or (
    user_id = public.current_profile_id()
    and public.has_finished_title(title_id)
  )
);

drop policy if exists "discussion_posts_update_own" on public.discussion_posts;
create policy "discussion_posts_update_own"
on public.discussion_posts
for update
to authenticated
using (
  public.is_current_user_admin()
  or user_id = public.current_profile_id()
)
with check (
  public.is_current_user_admin()
  or user_id = public.current_profile_id()
);

drop policy if exists "discussion_posts_delete_own" on public.discussion_posts;
create policy "discussion_posts_delete_own"
on public.discussion_posts
for delete
to authenticated
using (
  public.is_current_user_admin()
  or user_id = public.current_profile_id()
);

drop policy if exists "post_likes_select_own" on public.post_likes;
create policy "post_likes_select_own"
on public.post_likes
for select
to authenticated
using (
  public.is_current_user_admin()
  or user_id = public.current_profile_id()
);

drop policy if exists "post_likes_insert_own" on public.post_likes;
create policy "post_likes_insert_own"
on public.post_likes
for insert
to authenticated
with check (
  public.is_current_user_admin()
  or (
    user_id = public.current_profile_id()
    and exists (
      select 1
      from public.discussion_posts p
      where p.id = post_likes.post_id
        and public.has_finished_title(p.title_id)
    )
  )
);

drop policy if exists "post_likes_delete_own" on public.post_likes;
create policy "post_likes_delete_own"
on public.post_likes
for delete
to authenticated
using (
  public.is_current_user_admin()
  or user_id = public.current_profile_id()
);

drop policy if exists "title_bookmarks_select_own" on public.title_bookmarks;
create policy "title_bookmarks_select_own"
on public.title_bookmarks
for select
to authenticated
using (
  public.is_current_user_admin()
  or user_profile_id = public.current_profile_id()
);

drop policy if exists "title_bookmarks_insert_own" on public.title_bookmarks;
create policy "title_bookmarks_insert_own"
on public.title_bookmarks
for insert
to authenticated
with check (
  public.is_current_user_admin()
  or user_profile_id = public.current_profile_id()
);

drop policy if exists "title_bookmarks_delete_own" on public.title_bookmarks;
create policy "title_bookmarks_delete_own"
on public.title_bookmarks
for delete
to authenticated
using (
  public.is_current_user_admin()
  or user_profile_id = public.current_profile_id()
);
