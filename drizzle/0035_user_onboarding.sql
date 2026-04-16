alter table "user_profiles"
add column if not exists "onboarding_completed_at" timestamp with time zone;

update "user_profiles"
set "onboarding_completed_at" = coalesce("onboarding_completed_at", now())
where "onboarding_completed_at" is null;
