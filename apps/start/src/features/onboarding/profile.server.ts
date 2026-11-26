import type { User } from "@supabase/supabase-js"
import { createAdminSupabaseClient } from "../../server/supabase-admin.server"
import { createRequestSupabaseClient } from "../../server/supabase.server"

export type OnboardingProfile = {
  id: string
  auth_user_id: string
  username: string | null
  favorite_genres: unknown
  onboarding_completed_at: string | null
}

type OnboardingIdentity =
  | { status: "unauthorized" }
  | { status: "unavailable" }
  | {
      status: "ok"
      user: User
      admin: NonNullable<ReturnType<typeof createAdminSupabaseClient>>
      profile: OnboardingProfile
    }

async function createProfile(
  admin: NonNullable<ReturnType<typeof createAdminSupabaseClient>>,
  user: User,
) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const suffix = Math.floor(1_000 + Math.random() * 9_000)
    const username = `Bookworm${suffix}`
    const { data, error } = await admin.from("user_profiles")
      .insert({
        auth_user_id: user.id,
        email: user.email ?? null,
        username,
        updated_at: new Date().toISOString(),
      })
      .select("id,auth_user_id,username,favorite_genres,onboarding_completed_at")
      .single()
    if (!error && data) return data as OnboardingProfile

    if (error?.code === "23505") {
      const { data: concurrent } = await admin.from("user_profiles")
        .select("id,auth_user_id,username,favorite_genres,onboarding_completed_at")
        .eq("auth_user_id", user.id)
        .maybeSingle()
      if (concurrent) return concurrent as OnboardingProfile
      continue
    }
    return null
  }
  return null
}

export async function getOnboardingIdentity(): Promise<OnboardingIdentity> {
  const supabase = createRequestSupabaseClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return { status: "unauthorized" }

  const admin = createAdminSupabaseClient()
  if (!admin) return { status: "unavailable" }
  const { data: existing, error: profileError } = await admin.from("user_profiles")
    .select("id,auth_user_id,username,favorite_genres,onboarding_completed_at")
    .eq("auth_user_id", user.id)
    .maybeSingle()
  if (profileError) return { status: "unavailable" }

  const profile = existing as OnboardingProfile | null ?? await createProfile(admin, user)
  if (!profile) return { status: "unavailable" }
  return { status: "ok", user, admin, profile }
}
