-- Anyone may read title discussions. Creating a post remains read-gated by
-- discussion_posts_insert_finished and the server-side requireTitleRead check.
drop policy if exists "discussion_posts_select_finished" on public.discussion_posts;
drop policy if exists "discussion_posts_select_public" on public.discussion_posts;

create policy "discussion_posts_select_public"
on public.discussion_posts
for select
to anon, authenticated
using (true);
