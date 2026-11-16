# Branch Notes: activity-feed-and-followers

## Summary
This branch introduces a reader activity feed, follow relationships, and a smoother internal search experience. It also improves reviews (prefill + username links), adds seed scripts for demo data, and updates search UI behaviors.

## File-by-file notes

- [app/actions/profile.ts](app/actions/profile.ts)
  - Adds `recentActivity` to the profile payload by querying `activity_events` so profile pages can show recent activity.
  - Keeps existing stats and list aggregation intact; adds a small, safe query with limit 3.

- [app/actions/reviews.ts](app/actions/reviews.ts)
  - Optimizes review fetch by selecting minimal columns and batching profile lookups to reduce query payload.
  - Adds `getMyReview()` to prefill review form state and supports update-on-submit.
  - Reworks `submitReview()` to upsert and award points exactly once per review record.

- [app/actions/search-titles.ts](app/actions/search-titles.ts)
  - Adds `getInitialTitles()` and helper functions to return 50 internal titles alphabetically for the initial search view.
  - Keeps search behavior for structured queries and external sources unchanged while reusing local engagement metadata.

- [app/actions/follow.ts](app/actions/follow.ts)
  - New follow/unfollow server actions with reciprocal friend logic and feed revalidation.
  - Enforces auth profile lookup and self-follow guardrails.

- [app/page.tsx](app/page.tsx)
  - Adds authenticated “Following” feed view that renders `activity_events` with avatars, timestamps, and cover/club badges.
  - Introduces tabs for “Following” and “Trending” placeholder UI plus a progress sidebar.
  - Preserves public landing page behavior for signed-out users.

- [app/profile/page.tsx](app/profile/page.tsx)
  - Replaces synthetic activity list with real `recentActivity` events.
  - Adds activity rendering helper and empty state messaging.

- [app/search-titles/page.tsx](app/search-titles/page.tsx)
  - Wires `SearchTitlesClient` and provides initial internal results for default view.
  - Keeps auth guard and external query behavior intact.

- [app/search-titles/search-titles-client.tsx](app/search-titles/search-titles-client.tsx)
  - New client wrapper for local filtering while typing (title + author), immediate genre filtering, and empty-state rendering.
  - Uses internal results when no query; ensures external mode stays empty until search.

- [app/users/[username]/page.tsx](app/users/[username]/page.tsx)
  - Adds follow button and viewer self-check; reads follow state for accurate initial UI.
  - Extends profile fetch to include `auth_user_id` for proper viewer checks.

- [components/navigation.tsx](components/navigation.tsx)
  - Adds a “Home” link for easier navigation.

- [components/review-form.tsx](components/review-form.tsx)
  - Prefills existing review and swaps button label to “Update Review” when applicable.
  - Avoids clearing editor state on update submit.

- [components/title-engagement-tabs.tsx](components/title-engagement-tabs.tsx)
  - Links reviewer usernames to user profiles for improved discoverability.

- [components/track-reading-search.tsx](components/track-reading-search.tsx)
  - Emits search query state for live client filtering.
  - Adjusts layout so genre toggles stay on one line with horizontal scroll and no clipping.

- [components/track-reading-result-list.tsx](components/track-reading-result-list.tsx)
  - Adds a scroll container for long lists and smoother transition effects.

- [components/follow-button.tsx](components/follow-button.tsx)
  - New client follow/unfollow button with optimistic state and toast feedback.

- [db/schema.ts](db/schema.ts)
  - Adds `user_follows` table definition and constraints.

- [drizzle/0029_user_follows.sql](drizzle/0029_user_follows.sql)
  - New migration creating `user_follows` table.

- [drizzle/0030_activity_event_types.sql](drizzle/0030_activity_event_types.sql)
  - New migration creating `activity_events` with event-type constraint.

- [supabase/migrations/20260401000000_user_follows.sql](supabase/migrations/20260401000000_user_follows.sql)
  - Supabase migration for `user_follows`.

- [supabase/migrations/20260401001000_activity_event_types.sql](supabase/migrations/20260401001000_activity_event_types.sql)
  - Supabase migration for `activity_events` and event-type constraint.

- Historical note: the activity-feed and title-review seed scripts were removed because they changed existing profiles and used shared demo credentials. Local catalog fixtures now live in `supabase/seed.sql`.

## Notes / follow-ups
- No changelog update requested.
- Use only isolated, environment-specific fixtures for future activity-feed demos.
