import "server-only"

import type { createServerClient } from "@/lib/supabase-server"

type SupabaseServerClient = Awaited<ReturnType<typeof createServerClient>>

export async function requireAuthedProfileId(supabase: SupabaseServerClient) {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) throw new Error("Unauthorized")

  const { data: profile, error: profileError } = await supabase
    .from("user_profiles")
    .select("id,onboarding_completed_at")
    .eq("auth_user_id", user.id)
    .single()

  if (profileError || !profile) throw new Error("Profile not found")
  if (!profile.onboarding_completed_at) throw new Error("Onboarding required")

  return profile.id as string
}

export async function getAuthedProfileId(supabase: SupabaseServerClient) {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) return null

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle()

  return (profile?.id as string | null) ?? null
}
