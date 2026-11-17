-- Editing a discussion post remains restricted to its author and, like
-- creating or liking a post, requires that the title is still marked read.
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
  or (
    user_id = public.current_profile_id()
    and public.has_finished_title(title_id)
  )
);
