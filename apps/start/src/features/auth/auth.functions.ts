import { createServerFn } from "@tanstack/react-start"
import { createRequestSupabaseClient } from "../../server/supabase.server"

export const getAuthStatus = createServerFn({ method: "GET" }).handler(async () => {
  const supabase = createRequestSupabaseClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return { signedIn: false as const, onboarded: false }
  const { data: profile } = await supabase.from("user_profiles")
    .select("onboarding_completed_at").eq("auth_user_id", user.id).maybeSingle()
  return { signedIn: true as const, onboarded: Boolean(profile?.onboarding_completed_at) }
})
